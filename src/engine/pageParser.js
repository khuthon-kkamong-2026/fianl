const cheerio = require('cheerio')
const https = require('https')
const http = require('http')
const path = require('path')
const fs = require('fs')

// ─── 사이트별 테마 (SlowBro UI가 원본 사이트 디자인을 따라감) ─────────────────
const SITE_THEMES = {
  'giants':     { primary: '#0b1e45', accent: '#d4002a', bg: '#f2f2f2', name: 'Giants',       italic: true  },
  'giants-web': { primary: '#0b1e45', accent: '#d4002a', bg: '#f2f2f2', name: 'Giants',       italic: true  },
  'interpark':  { primary: '#1e2d9e', accent: '#e85d04', bg: '#f8f8f8', name: 'interpark',    italic: false },
  'ticketlink': { primary: '#c0392b', accent: '#c0392b', bg: '#f8f8f8', name: 'Ticketlink',   italic: false },
  'korail':     { primary: '#003580', accent: '#e31837', bg: '#f5f5f5', name: 'Korail',       italic: false },
  'demo':       { primary: '#003087', accent: '#c0392b', bg: '#f8f9fc', name: 'Lotte Ticket', italic: false },
}

// ─── 사이트별 파싱 룰셋 ──────────────────────────────────────────────────────
// 각 사이트마다 "어디서 날짜, 좌석, 제출 버튼을 찾는지" 정의
const SITE_RULES = {
  'giants': {
    name: '롯데자이언츠 티켓',
    type: 'baseball',
    selectors: {
      title:      ['.header-main .logo', 'title'],
      dateOptions:['.game-item .game-date', '.game-item'],
      seatGrades: ['.grade-badge', '.grade-table tbody tr td:nth-child(2)'],
      submitBtn:  ['.btn-book'],
    },
  },
  'giants-web': {
    name: '롯데자이언츠',
    type: 'baseball',
    selectors: {
      title:      ['title', 'h1', '.tit', '.logo'],
      dateOptions:['.schedule-list li', '.game-list li', 'select[name*="date"] option',
                   '.schedule-item', '.list_game li', '.game-item .game-date'],
      seatGrades: ['.grade-list li', '.seat-grade', 'select[name*="grade"] option',
                   '.area_grade .item', '.grade-badge'],
      submitBtn:  ['.btn-book', '.btn-buy', '.btn_buy', 'button[type="submit"]'],
      loginBtn:   ['.login-btn', 'a[href*="login"]', '.btn-login', '#loginBtn'],
    },
  },
  'interpark': {
    name: '인터파크',
    type: 'baseball',
    selectors: {
      title:      ['h1.product-title', '.goods-name', 'title'],
      dateOptions:['select[name*="date"] option', '.date-list li', '.schedule-item'],
      seatGrades: ['.grade-list li', '.seat-grade', 'select[name*="grade"] option'],
      submitBtn:  ['button.btn-buy', '.purchase-btn', 'button[type="submit"]'],
      loginBtn:   ['#loginBtn', '.btn-login', 'a[href*="login"]', 'a[href*="member"]'],
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
      loginBtn:   ['.btn_login', 'a[href*="login"]', '#headerLogin'],
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
      loginBtn:   ['.btn-login', '#loginBtn', 'a[href*="login"]', '.login_btn'],
    },
  },
  'mock': {
    name: 'Mock 데모',
    type: 'mock',
  },
  // ── 데모 서버 (localhost:3000) ──────────────────────────────────
  'demo': {
    name: '롯데 티켓',
    type: 'baseball',
    selectors: {
      title:       ['.site-logo', 'title'],
      dateOptions: ['.game-date-item'],
      seatGrades:  ['.seat-grade-item'],
      submitBtn:   ['.btn-purchase'],
      loginBtn:    ['a.btn-login', 'a[href="/login"]', '.btn-login'],
    },
  },
}

// ─── 사이트 감지 ─────────────────────────────────────────────────────────────
function detectSite(url) {
  if (url.startsWith('mock://') || url.startsWith('file://')) return 'mock'
  if (url.includes('localhost:3000')) return 'demo'         // 데모 서버
  if (url.includes('giantsclub') || url.includes('lottegiantsticket')) return 'giants-web'
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
  // mock://giants/baseball  →  mock-sites/giants/index.html
  const parts = url.replace('mock://', '').split('/')
  const mockPath = path.join(__dirname, '../../mock-sites', parts[0], 'index.html')
  if (fs.existsSync(mockPath)) {
    return fs.readFileSync(mockPath, 'utf-8')
  }
  return null
}

// ─── 파일 경로 URL 로드 ──────────────────────────────────────────────────────
function loadFileUrl(url) {
  // file:///C:/path/to/file.html
  const filePath = url.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '')
  const decoded = decodeURIComponent(filePath)
  if (fs.existsSync(decoded)) {
    return fs.readFileSync(decoded, 'utf-8')
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
      siteKey: 'unknown', type: 'baseball', title: '티켓 예매',
      steps: getMockSteps('baseball'), theme: null,
    }
  }

  // Mock or file:// → 로컬 HTML 파싱
  let html
  if (siteKey === 'mock') {
    const site = url.replace('mock://', '').split('/')[0]  // 'giants', 'interpark', ...
    const mockHtml = loadMockPage(url)
    // 해당 사이트 룰이 있으면 실제 HTML을 파싱
    if (mockHtml && SITE_RULES[site]?.selectors) {
      const $ = cheerio.load(mockHtml)
      const rules = SITE_RULES[site]
      const titleEl = findFirst($, rules.selectors.title)
      const title = titleEl ? titleEl.text().trim() : rules.name
      if (rules.type === 'baseball') return parseBaseballPage($, rules, title, site, url)
      if (rules.type === 'ktx')      return parseKtxPage($, rules, title, site, url)
    }
    // 룰 없으면 하드코딩 Mock 데이터 사용
    const steps = getMockSteps(url)
    const type  = url.includes('korail') ? 'ktx' : 'baseball'
    const title = getMockTitle(url)
    return { siteKey: 'mock', type, title, steps, theme: SITE_THEMES[site] ?? null }
  } else if (url.startsWith('file://')) {
    const localHtml = loadFileUrl(url)
    if (!localHtml) return { raw: true, message: '파일을 찾을 수 없어요.', theme: null }
    const guessKey = Object.keys(SITE_RULES).find(k => url.toLowerCase().includes(k))
    if (guessKey && SITE_RULES[guessKey]?.selectors) {
      const $ = cheerio.load(localHtml)
      const rules = SITE_RULES[guessKey]
      const title = findFirst($, rules.selectors.title)?.text().trim() ?? rules.name
      if (rules.type === 'baseball') return parseBaseballPage($, rules, title, guessKey)
      if (rules.type === 'ktx')      return parseKtxPage($, rules, title, guessKey)
    }
    const steps = getMockSteps(url)
    return { siteKey: 'file', type: 'baseball', title: '로컬 페이지', steps, theme: null }
  } else {
    html = await fetchHtml(url)
  }

  const $ = cheerio.load(html)
  const rules = SITE_RULES[siteKey] ?? {}

  // selectors 없으면 Mock 데이터로 폴백
  if (!rules.selectors) {
    const steps = getMockSteps(url)
    const type  = url.includes('korail') ? 'ktx' : 'baseball'
    return { siteKey, type, title: rules.name ?? 'Mock 데모', steps, theme: SITE_THEMES[siteKey] ?? null }
  }

  // 공통 추출
  const titleEl = findFirst($, rules.selectors.title)
  const title = titleEl ? titleEl.text().trim() : rules.name

  if (rules.type === 'baseball') {
    return parseBaseballPage($, rules, title, siteKey, url)
  } else if (rules.type === 'ktx') {
    return parseKtxPage($, rules, title, siteKey, url)
  }

  return { siteKey, type: rules.type, title }
}

// ─── 로그인 필요 여부 감지 ────────────────────────────────────────────────────
function detectLoginRequired($, rules, siteUrl) {
  // 데모 서버: body에 data-sb-needs-login 속성
  const bodyAttr = $('body').attr('data-sb-needs-login')
  if (bodyAttr === 'true') {
    return {
      needed: true,
      loginUrl: $('body').attr('data-sb-login-url') || siteUrl,
      selectors: rules.selectors?.loginBtn ?? ['a[href*="login"]', '.btn-login'],
    }
  }
  // 실제 사이트: URL이 로그인 페이지거나 로그인 폼이 있는 경우
  if (siteUrl && (siteUrl.includes('/login') || siteUrl.includes('/signin'))) {
    return {
      needed: true,
      loginUrl: siteUrl,
      selectors: rules.selectors?.loginBtn ?? ['button[type="submit"]'],
    }
  }
  // 로그인 폼이 페이지 메인에 있는 경우 (input[type=password] 가 있으면)
  if ($('input[type="password"]').length > 0 && $('form').length > 0) {
    return {
      needed: true,
      loginUrl: siteUrl,
      selectors: ['button[type="submit"]', '.btn-login', 'input[type="submit"]'],
    }
  }
  return { needed: false }
}

// ─── 야구 티켓 파싱 ──────────────────────────────────────────────────────────
function parseBaseballPage($, rules, title, siteKey, siteUrl = '') {
  const dateEls = findAll($, rules.selectors.dateOptions)
  const gradeEls = findAll($, rules.selectors.seatGrades)

  const dates = []
  if (dateEls) {
    dateEls.each((i, el) => {
      const $el = $(el)
      // Giants mock / demo: .game-date + .game-match 조합
      const dateSpan  = $el.find('.game-date').text().trim()
      const matchSpan = $el.find('.game-match').text().trim().replace(/\s+/g, ' ')
      if (dateSpan && matchSpan) {
        // match 텍스트가 너무 길면 앞 30자만 (데모 서버 텍스트 정리)
        const shortMatch = matchSpan.length > 35
          ? matchSpan.slice(0, 35).replace(/\|.*$/, '').trim()
          : matchSpan
        dates.push({ text: `${dateSpan} · ${shortMatch}`, value: dateSpan })
        return
      }
      const text = $el.text().trim().replace(/\s+/g, ' ')
      const value = $el.attr('value') || text
      if (text && i < 8) dates.push({ text, value })
    })
  }

  const grades = []
  if (gradeEls) {
    gradeEls.each((i, el) => {
      const $el = $(el)
      const badge = $el.find('.grade-badge').text().trim()
      // Giants mock: 배지 텍스트 + 같은 행의 가격
      if (badge) {
        const price = $el.closest('tr').find('td:nth-child(3)').text().trim()
        const text  = price ? `${badge}  —  ${price}` : badge
        grades.push({ text, value: badge })
        return
      }
      const text = $el.text().trim().replace(/\s+/g, ' ')
      if (text) grades.push({ text, value: $el.attr('value') || text })
    })
  }

  const submitBtn = findFirst($, rules.selectors.submitBtn)
  const submitText = submitBtn ? submitBtn.text().trim() : '예매하기'

  // 파싱 결과가 부족하면 Giants mock 데이터로 폴백 (로그인 필요 사이트 등)
  const finalDates  = dates.length  >= 2 ? dates  : MOCK_BASEBALL_DATES
  const finalGrades = grades.length >= 2 ? grades : MOCK_SEAT_GRADES

  return {
    siteKey,
    type: 'baseball',
    title,
    theme: SITE_THEMES[siteKey] ?? null,
    steps: [
      {
        id: 'date',
        label: '날짜를 골라주세요',
        type: 'select',
        options: finalDates,
        hint: '원하는 경기 날짜를 하나만 고르면 돼요',
      },
      {
        id: 'grade',
        label: '어떤 자리로 할까요?',
        type: 'select',
        options: finalGrades,
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
    theme: SITE_THEMES[siteKey] ?? null,
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

function getMockTitle(url) {
  if (url.includes('korail')) return 'KTX 예매'
  if (url.includes('giants')) return '롯데자이언츠 홈경기 예매'
  return 'LG vs KT | 잠실야구장'
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
