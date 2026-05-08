const cheerio = require('cheerio')
const https = require('https')
const http = require('http')
const path = require('path')
const fs = require('fs')

// ─── 사이트별 파싱 룰셋 ──────────────────────────────────────────────────────
// 각 사이트마다 "어디서 날짜, 좌석, 제출 버튼을 찾는지" 정의
const SITE_RULES = {
  'interpark': {
    name: '인터파크',
    type: 'baseball',
    selectors: {
      title:      ['h1.product-title', '.goods-name', 'title'],
      dateOptions:['select[name*="date"] option', '.date-list li', '.schedule-item'],
      seatGrades: ['.grade-list li', '.seat-grade', 'select[name*="grade"] option'],
      submitBtn:  ['button.btn-buy', '.purchase-btn', 'button[type="submit"]'],
    },
  },
  'ticketlink': {
    name: '티켓링크',
    type: 'baseball',
    selectors: {
      title:      ['.tit_product', 'h2.title'],
      dateOptions:['.list_schedule .item', 'select[name="performDate"] option'],
      seatGrades: ['.area_grade .item', '.grade_area li'],
      submitBtn:  ['.btn_buy', 'button.purchase'],
    },
  },
  'korail': {
    name: '코레일',
    type: 'ktx',
    selectors: {
      title:      ['.h1_tit', 'h1'],
      departure:  ['#dptRsStnCd', 'input[name*="depart"]', '#txtDptRsStn'],
      arrival:    ['#arvRsStnCd', 'input[name*="arrive"]', '#txtArvRsStn'],
      dateInput:  ['#dptDt', 'input[name*="date"]'],
      submitBtn:  ['#btnSearch', '.btn_search', 'button[type="submit"]'],
    },
  },
  'mock': {
    name: 'Mock 데모',
    type: 'mock',
  },
}

// ─── 사이트 감지 ─────────────────────────────────────────────────────────────
function detectSite(url) {
  if (url.startsWith('mock://') || url.startsWith('file://')) return 'mock'
  if (url.includes('interpark')) return 'interpark'
  if (url.includes('ticketlink')) return 'ticketlink'
  if (url.includes('letskorail') || url.includes('korail')) return 'korail'
  return null
}

// ─── HTML 페치 ───────────────────────────────────────────────────────────────
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

// ─── Mock 페이지 로드 ────────────────────────────────────────────────────────
function loadMockPage(url) {
  // mock://interpark/baseball  →  mock-sites/interpark/index.html
  const parts = url.replace('mock://', '').split('/')
  const mockPath = path.join(__dirname, '../../mock-sites', parts[0], 'index.html')
  if (fs.existsSync(mockPath)) {
    return fs.readFileSync(mockPath, 'utf-8')
  }
  return null
}

// ─── 셀렉터 폴백 헬퍼 ───────────────────────────────────────────────────────
function findFirst($, selectors) {
  for (const sel of selectors) {
    const el = $(sel).first()
    if (el.length) return el
  }
  return null
}

function findAll($, selectors) {
  for (const sel of selectors) {
    const els = $(sel)
    if (els.length) return els
  }
  return null
}

// ─── 메인 파서 ───────────────────────────────────────────────────────────────
async function parsePageForSeniors(url) {
  const siteKey = detectSite(url)

  if (!siteKey) {
    return {
      siteKey: 'unknown',
      type: 'unknown',
      raw: true,  // 모르는 사이트 → 원본 표시
      message: '이 사이트는 아직 지원되지 않아요.',
    }
  }

  // Mock or real fetch
  let html
  if (siteKey === 'mock') {
    const steps = getMockSteps(url)
    const type  = url.includes('korail') ? 'ktx' : 'baseball'
    const title = type === 'ktx' ? 'KTX 예매' : 'LG vs KT | 잠실야구장'
    return { siteKey: 'mock', type, title, steps }
  } else {
    html = await fetchHtml(url)
  }

  const $ = cheerio.load(html)
  const rules = SITE_RULES[siteKey] ?? {}

  // selectors 없으면 Mock 데이터로 폴백
  if (!rules.selectors) {
    const steps = getMockSteps(url)
    const type  = url.includes('korail') ? 'ktx' : 'baseball'
    return { siteKey, type, title: rules.name ?? 'Mock 데모', steps }
  }

  // 공통 추출
  const titleEl = findFirst($, rules.selectors.title)
  const title = titleEl ? titleEl.text().trim() : rules.name

  if (rules.type === 'baseball') {
    return parseBaseballPage($, rules, title, siteKey)
  } else if (rules.type === 'ktx') {
    return parseKtxPage($, rules, title, siteKey)
  }

  return { siteKey, type: rules.type, title }
}

// ─── 야구 티켓 파싱 ──────────────────────────────────────────────────────────
function parseBaseballPage($, rules, title, siteKey) {
  const dateEls = findAll($, rules.selectors.dateOptions)
  const gradeEls = findAll($, rules.selectors.seatGrades)

  const dates = []
  if (dateEls) {
    dateEls.each((i, el) => {
      const text = $(el).text().trim()
      const value = $(el).attr('value') || text
      if (text && i < 10) dates.push({ text, value })
    })
  }

  const grades = []
  if (gradeEls) {
    gradeEls.each((i, el) => {
      const text = $(el).text().trim()
      if (text) grades.push({ text, value: $(el).attr('value') || text })
    })
  }

  const submitBtn = findFirst($, rules.selectors.submitBtn)
  const submitText = submitBtn ? submitBtn.text().trim() : '예매하기'

  return {
    siteKey,
    type: 'baseball',
    title,
    steps: [
      {
        id: 'date',
        label: '날짜를 골라주세요',
        type: 'select',
        options: dates.length > 0 ? dates : MOCK_BASEBALL_DATES,
        hint: '원하는 경기 날짜를 하나만 고르면 돼요',
      },
      {
        id: 'grade',
        label: '어떤 자리로 할까요?',
        type: 'select',
        options: grades.length > 0 ? grades : MOCK_SEAT_GRADES,
        hint: '가격이 다르지만 어느 자리든 경기는 잘 보여요',
      },
      {
        id: 'count',
        label: '몇 명이 가세요?',
        type: 'counter',
        min: 1,
        max: 4,
        default: 2,
        hint: '어르신 할인은 나중에 자동으로 적용돼요',
      },
      {
        id: 'confirm',
        label: '이렇게 예매할게요',
        type: 'confirm',
        submitLabel: submitText,
      },
    ],
  }
}

// ─── KTX 파싱 ────────────────────────────────────────────────────────────────
function parseKtxPage($, rules, title, siteKey) {
  return {
    siteKey,
    type: 'ktx',
    title,
    steps: [
      {
        id: 'route',
        label: '어디서 어디로 가세요?',
        type: 'route',
        stations: KTX_MAJOR_STATIONS,
        hint: '출발역과 도착역을 하나씩 골라주세요',
      },
      {
        id: 'date',
        label: '언제 출발하실 건가요?',
        type: 'datepicker',
        hint: '날짜를 고르면 기차 목록이 나와요',
      },
      {
        id: 'discount',
        label: '할인을 받으실 수 있어요',
        type: 'discount',
        options: KTX_DISCOUNTS,
        hint: '해당되는 할인을 골라주세요. 모르면 "없음"을 선택해도 괜찮아요',
      },
      {
        id: 'train',
        label: '기차를 골라주세요',
        type: 'trainlist',
        hint: '원하는 시간의 기차를 하나만 누르면 돼요',
      },
      {
        id: 'confirm',
        label: '이렇게 예매할게요',
        type: 'confirm',
        submitLabel: '기차표 예매하기',
      },
    ],
  }
}

// ─── Mock 데이터 (해커톤 데모용) ─────────────────────────────────────────────
function getMockSteps(url) {
  if (url.includes('korail')) {
    return [
      { id:'route', label:'어디서 어디로 가세요?', type:'route', stations: KTX_MAJOR_STATIONS, hint:'출발역과 도착역을 하나씩 골라주세요' },
      { id:'date',  label:'언제 출발하실 건가요?', type:'datepicker', hint:'날짜를 고르면 기차 목록이 나와요' },
      { id:'discount', label:'할인을 받으실 수 있어요', type:'discount', options: KTX_DISCOUNTS, hint:'해당되는 할인을 골라주세요. 모르면 없음을 선택해도 괜찮아요' },
      { id:'train', label:'기차를 골라주세요', type:'trainlist', hint:'원하는 시간의 기차를 하나만 누르면 돼요' },
      { id:'confirm', label:'이렇게 예매할게요', type:'confirm', submitLabel:'기차표 예매하기' },
    ]
  }
  return [
    { id:'date',    label:'날짜를 골라주세요', type:'select', options: MOCK_BASEBALL_DATES, hint:'원하는 경기 날짜를 하나만 고르면 돼요' },
    { id:'grade',   label:'어떤 자리로 할까요?', type:'select', options: MOCK_SEAT_GRADES, hint:'가격이 다르지만 어느 자리든 경기는 잘 보여요' },
    { id:'count',   label:'몇 명이 가세요?', type:'counter', min:1, max:4, default:2, hint:'어르신 할인은 나중에 자동으로 적용돼요' },
    { id:'confirm', label:'이렇게 예매할게요', type:'confirm', submitLabel:'예매하기' },
  ]
}

const MOCK_BASEBALL_DATES = [
  { text: '5월 10일 (토) 오후 2시', value: '20250510' },
  { text: '5월 11일 (일) 오후 5시', value: '20250511' },
  { text: '5월 14일 (수) 오후 6시 30분', value: '20250514' },
  { text: '5월 17일 (토) 오후 2시', value: '20250517' },
]

const MOCK_SEAT_GRADES = [
  { text: '1루 지정석  —  35,000원', value: 'first_base' },
  { text: '3루 지정석  —  35,000원', value: 'third_base' },
  { text: '외야 응원석  —  12,000원', value: 'outfield' },
  { text: '중앙 프리미엄  —  55,000원', value: 'premium' },
]

const KTX_MAJOR_STATIONS = [
  '서울', '수원', '천안아산', '오송', '대전', '김천구미',
  '동대구', '경주', '울산', '부산', '광주송정', '목포',
]

const KTX_DISCOUNTS = [
  { text: '없음', value: 'none' },
  { text: '경로 (만 65세 이상)  —  30% 할인', value: 'senior' },
  { text: '장애인 할인', value: 'disabled' },
  { text: '다자녀 할인', value: 'family' },
]

module.exports = { parsePageForSeniors }
