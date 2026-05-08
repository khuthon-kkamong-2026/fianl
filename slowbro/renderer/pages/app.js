/* ─── SlowBro Renderer App ─────────────────────────────────────────────────── */

// slowbro API는 preload에서 window.slowbro 로 주입됨
const api = window.slowbro

// ─── 🐢 거북이 아이콘 생성 ────────────────────────────────────────────────────
;(function applyTurtleIcon() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')

  // 배경 원 (SlowBro 블루)
  ctx.fillStyle = '#3B5AC6'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()

  // 거북이 이모지
  ctx.font = `${Math.round(size * 0.65)}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🐢', size / 2, size / 2 + size * 0.04)

  api.setIcon(canvas.toDataURL('image/png'))
})()

// ─── 상태 ────────────────────────────────────────────────────────────────────
const state = {
  steps:       [],
  currentStep: 0,
  answers:     {},
  sessionId:   `sess_${Date.now()}`,
  userId:      'demo_user',
  ttsEnabled:  true,
  fontLevel:   0,
  browserMode: false,    // true = 원본 사이트 BrowserView 표시 중
}

// ─── DOM 참조 ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id)

const homeScreen   = $('home-screen')
const guideScreen  = $('guide-screen')
const doneScreen   = $('done-screen')
const guideContent = $('guide-content')
const urlInput     = $('url-input')
const browserNavbar = $('browser-navbar')
const bvUrlDisplay  = $('bv-url-display')
const bvLoading     = $('bv-loading')

// ─── 사이트 테마 적용 ─────────────────────────────────────────────────────────
function applyTheme(theme) {
  const root = document.documentElement
  const logoText  = $('logo-text')
  const logoBadge = $('logo-sb-badge')

  if (!theme) {
    document.body.classList.remove('site-themed')
    root.style.removeProperty('--site-primary')
    root.style.removeProperty('--site-accent')
    root.style.removeProperty('--site-bg')
    logoText.textContent = '🐢 SlowBro'
    logoText.style.fontStyle  = 'normal'
    logoText.style.fontWeight = '600'
    logoText.style.color      = ''
    logoBadge.classList.add('hidden')
    return
  }

  root.style.setProperty('--site-primary', theme.primary)
  root.style.setProperty('--site-accent',  theme.accent)
  root.style.setProperty('--site-bg',      theme.bg)
  document.body.classList.add('site-themed')

  logoText.textContent      = theme.name
  logoText.style.fontStyle  = theme.italic ? 'italic' : 'normal'
  logoText.style.fontWeight = '900'
  logoText.style.color      = 'white'
  logoText.style.fontSize   = '22px'
  logoBadge.classList.remove('hidden')
}

// ─── 화면 전환 ───────────────────────────────────────────────────────────────
function showScreen(name) {
  homeScreen.classList.add('hidden')
  guideScreen.classList.add('hidden')
  doneScreen.classList.add('hidden')
  $(`${name}-screen`).classList.remove('hidden')
  if (name === 'home') applyTheme(null)
}

// ─── 모드 전환 ───────────────────────────────────────────────────────────────
$('btn-mode-slow').addEventListener('click', () => switchMode('slow'))
$('btn-mode-orig').addEventListener('click', () => switchMode('orig'))

async function switchMode(mode) {
  if (mode === 'orig' && !state.browserMode) {
    state.browserMode = true
    $('btn-mode-orig').classList.add('mode-btn--orig-active')
    $('btn-mode-slow').classList.remove('mode-btn--active')
    browserNavbar.classList.remove('hidden')
    document.getElementById('app').classList.add('browser-mode')

    const url = urlInput.value.trim() || 'https://www.naver.com'
    urlInput.value = url
    await openBrowserView(url)

  } else if (mode === 'slow' && state.browserMode) {
    state.browserMode = false
    $('btn-mode-slow').classList.add('mode-btn--active')
    $('btn-mode-orig').classList.remove('mode-btn--orig-active')
    browserNavbar.classList.add('hidden')
    document.getElementById('app').classList.remove('browser-mode')

    await api.browser.close()
  }
}

// BrowserView를 navbar 아래 ~ 창 하단까지 꽉 채우기
function getBrowserBounds() {
  const navbar = document.getElementById('browser-navbar').getBoundingClientRect()
  const y = Math.round(navbar.bottom)
  return {
    x: 0,
    y,
    width:  Math.round(window.innerWidth),
    height: Math.round(window.innerHeight) - y,
  }
}

async function openBrowserView(url) {
  // DOM 변경(navbar 표시) 후 레이아웃이 확정될 때까지 두 프레임 대기
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  await api.browser.open(url, getBrowserBounds())
}

// 창 크기 바뀌면 BrowserView 위치도 재조정
window.addEventListener('resize', () => {
  if (!state.browserMode) return
  api.browser.setBounds(getBrowserBounds())
})

// BrowserView 이벤트 구독
api.browser.onUrlChanged((url) => {
  urlInput.value = url
  bvUrlDisplay.textContent = url

})
api.browser.onTitleChanged((title) => {
  document.title = `SlowBro — ${title}`
})
api.browser.onLoading((loading) => {
  bvLoading.classList.toggle('spin', loading)
  $('bv-reload').textContent = loading ? '✕' : '↻'
})

// 브라우저 네비게이션 버튼
$('bv-back').addEventListener('click',    () => api.browser.back())
$('bv-forward').addEventListener('click', () => api.browser.forward())
$('bv-reload').addEventListener('click',  () => api.browser.reload())

// ─── 네비게이션 ──────────────────────────────────────────────────────────────
$('btn-go').addEventListener('click', () => navigate(urlInput.value.trim()))
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(urlInput.value.trim()) })

document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.url))
})

$('btn-back').addEventListener('click', () => {
  if (state.currentStep > 0) {
    state.currentStep--
    renderStep()
  } else {
    showScreen('home')
  }
})

$('btn-reset').addEventListener('click', () => {
  state.steps = []
  state.currentStep = 0
  state.answers = {}
  showScreen('home')
})

$('btn-help').addEventListener('click', () => {
  speak('가족에게 도움을 요청하시겠어요? 연결 기능은 준비 중이에요.')
  alert('가족 연결 기능은 준비 중이에요.\n가까이 있는 분께 도움을 요청해보세요.')
})

$('btn-home').addEventListener('click', () => showScreen('home'))

// ─── 접근성 버튼 ─────────────────────────────────────────────────────────────
$('btn-tts-toggle').addEventListener('click', () => {
  state.ttsEnabled = !state.ttsEnabled
  $('btn-tts-toggle').textContent = state.ttsEnabled ? '🔊' : '🔇'
  speak(state.ttsEnabled ? '음성 안내를 켰어요' : '음성 안내를 껐어요')
})

$('btn-font-up').addEventListener('click', () => {
  if (state.fontLevel < 2) {
    state.fontLevel++
    applyFontLevel()
    speak('글씨를 크게 했어요')
  }
})

$('btn-font-down').addEventListener('click', () => {
  if (state.fontLevel > 0) {
    state.fontLevel--
    applyFontLevel()
    speak('글씨를 작게 했어요')
  }
})

function applyFontLevel() {
  document.body.classList.remove('font-xl', 'font-xxl')
  if (state.fontLevel === 1) document.body.classList.add('font-xl')
  if (state.fontLevel === 2) document.body.classList.add('font-xxl')
}

// ─── TTS ──────────────────────────────────────────────────────────────────────
function speak(text) {
  if (!state.ttsEnabled) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'ko-KR'
  utter.rate = 0.9
  utter.pitch = 1.0
  window.speechSynthesis.speak(utter)
  api.speak(text)  // main 프로세스에도 알림 (로깅 등)
}

// ─── 페이지 로드 & 파싱 ──────────────────────────────────────────────────────
async function navigate(url) {
  if (!url) return
  urlInput.value = url

  // 원본 보기 모드 — BrowserView로 그냥 이동
  if (state.browserMode) {
    bvUrlDisplay.textContent = url
    await api.browser.navigate(url)
    return
  }

  // 로딩 표시
  showScreen('guide')
  guideContent.innerHTML = `
    <div class="loading-wrap">
      <p class="loading-text">잠깐만요, 준비하고 있어요 🌿</p>
    </div>`

  const result = await api.loadPage(url)

  if (!result.ok) {
    guideContent.innerHTML = `<div class="step-card"><p>${result.error}</p></div>`
    speak('페이지를 불러오지 못했어요.')
    return
  }

  const data = result.data

  if (data.raw) {
    guideContent.innerHTML = `<div class="step-card"><p>${data.message}</p></div>`
    speak(data.message)
    return
  }

  // 플로우 시작
  state.steps = data.steps
  state.currentStep = 0
  state.answers = {}
  applyTheme(data.theme ?? null)
  speak(`${data.title ?? '예매'} 화면이에요. 차근차근 안내해 드릴게요.`)
  renderStep()
}

// ─── 스텝 렌더링 ─────────────────────────────────────────────────────────────
function renderStep() {
  const step = state.steps[state.currentStep]
  if (!step) return

  // 진행 점
  const dots = state.steps.map((_, i) => {
    let cls = 'progress-dot'
    if (i < state.currentStep) cls += ' done'
    else if (i === state.currentStep) cls += ' active'
    return `<div class="${cls}"></div>`
  }).join('')

  let bodyHTML = ''

  switch (step.type) {
    case 'select':
      bodyHTML = renderSelect(step)
      break
    case 'counter':
      bodyHTML = renderCounter(step)
      break
    case 'route':
      bodyHTML = renderRoute(step)
      break
    case 'datepicker':
      bodyHTML = renderDatepicker(step)
      break
    case 'discount':
      bodyHTML = renderSelect(step)  // 구조 동일
      break
    case 'trainlist':
      bodyHTML = renderTrainList(step)
      break
    case 'confirm':
      bodyHTML = renderConfirm(step)
      break
    default:
      bodyHTML = `<p>알 수 없는 스텝이에요.</p>`
  }

  guideContent.innerHTML = `
    <div class="progress-bar">${dots}</div>
    <div class="step-card">
      <div class="step-card-header">
        <div class="step-num-tag">STEP ${state.currentStep + 1} / ${state.steps.length}</div>
        <div class="step-title">${step.label}</div>
      </div>
      <div class="step-hint">${step.hint ?? ''}</div>
      ${bodyHTML}
      <div class="guard-warning" id="guard-warning">
        ⚠️ 너무 빠르게 클릭되었어요. 잠깐 기다렸다가 다시 눌러주세요.
      </div>
    </div>`

  speak(step.label + (step.hint ? '. ' + step.hint : ''))
  attachHandlers(step)
}

// ─── 스텝별 HTML 생성 ────────────────────────────────────────────────────────
function renderSelect(step) {
  const opts = step.options.map(opt =>
    `<button class="option-btn" data-value="${opt.value}">${opt.text}</button>`
  ).join('')
  return `
    <div class="option-list">${opts}</div>
    <button class="btn-next" id="btn-next" disabled>다음으로 →</button>`
}

function renderCounter(step) {
  const val = state.answers[step.id] ?? step.default ?? 1
  return `
    <div class="counter-wrap">
      <button class="counter-btn" id="counter-minus">−</button>
      <span class="counter-value" id="counter-val">${val}</span>
      <button class="counter-btn" id="counter-plus">+</button>
    </div>
    <button class="btn-next" id="btn-next">다음으로 →</button>`
}

function renderRoute(step) {
  const stationOpts = step.stations.map(s =>
    `<option value="${s}">${s}</option>`
  ).join('')
  return `
    <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:8px;">
      <label style="font-weight:600;font-size:0.95em;color:var(--text-sub)">출발역</label>
      <select id="sel-depart" class="option-btn" style="cursor:pointer;">${stationOpts}</select>
      <label style="font-weight:600;font-size:0.95em;color:var(--text-sub)">도착역</label>
      <select id="sel-arrive" class="option-btn" style="cursor:pointer;">${stationOpts}</select>
    </div>
    <button class="btn-next" id="btn-next">다음으로 →</button>`
}

function renderDatepicker(step) {
  const today = new Date().toISOString().split('T')[0]
  return `
    <div style="margin-bottom:8px;">
      <input type="date" id="date-pick" class="option-btn"
        value="${today}" min="${today}"
        style="font-size:1em;cursor:pointer;text-align:center;" />
    </div>
    <button class="btn-next" id="btn-next">다음으로 →</button>`
}

function renderTrainList(step) {
  // 해커톤 Mock 데이터
  const trains = [
    { id: 'KTX101', time: '07:30', arrive: '10:05', duration: '2시간 35분', price: '59,800원', seats: '여유 있음' },
    { id: 'KTX103', time: '09:00', arrive: '11:32', duration: '2시간 32분', price: '59,800원', seats: '여유 있음' },
    { id: 'KTX105', time: '11:30', arrive: '14:02', duration: '2시간 32분', price: '59,800원', seats: '적음' },
    { id: 'KTX107', time: '14:00', arrive: '16:35', duration: '2시간 35분', price: '59,800원', seats: '여유 있음' },
  ]
  const items = trains.map(t => `
    <button class="option-btn" data-value="${t.id}">
      <strong>${t.time} 출발</strong> → ${t.arrive} 도착
      &nbsp;·&nbsp; ${t.duration} &nbsp;·&nbsp; ${t.price}
      &nbsp;·&nbsp; <span style="color:var(--text-hint);font-size:0.9em">${t.seats}</span>
    </button>`).join('')
  return `
    <div class="option-list">${items}</div>
    <button class="btn-next" id="btn-next" disabled>다음으로 →</button>`
}

function renderConfirm(step) {
  const rows = Object.entries(state.answers).map(([key, val]) => {
    const label = state.steps.find(s => s.id === key)?.label ?? key
    return `<li><span class="confirm-key">${label}</span><span class="confirm-value">${val}</span></li>`
  }).join('')
  return `
    <ul class="confirm-list">${rows}</ul>
    <button class="btn-submit" id="btn-submit">${step.submitLabel ?? '예매하기'}</button>`
}

// ─── 이벤트 핸들러 연결 ──────────────────────────────────────────────────────
function attachHandlers(step) {

  const next = $('btn-next')

  // 옵션 선택
  document.querySelectorAll('.option-btn[data-value]').forEach(btn => {
    btn.addEventListener('click', async () => {
      // 악용 방지 체크
      const { safe } = await api.guard.checkClick({
        sessionId: state.sessionId,
        timestamp: Date.now(),
      })
      if (!safe) {
        $('guard-warning').classList.add('show')
        speak('너무 빠르게 클릭되었어요. 잠깐 기다려 주세요.')
        return
      }
      $('guard-warning')?.classList.remove('show')

      document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      state.answers[step.id] = btn.dataset.value
      if (next) next.disabled = false
      speak(btn.textContent.trim())
    })
  })

  // 다음 버튼
  if (next) {
    next.addEventListener('click', async () => {
      const { safe } = await api.guard.checkClick({
        sessionId: state.sessionId,
        timestamp: Date.now(),
      })
      if (!safe) {
        $('guard-warning').classList.add('show')
        speak('잠깐, 너무 빠르게 눌렸어요.')
        return
      }

      // 선택 저장 (counter, datepicker, route 등)
      if (step.type === 'counter') {
        state.answers[step.id] = $('counter-val')?.textContent ?? '2'
      } else if (step.type === 'datepicker') {
        const d = $('date-pick')?.value
        if (d) state.answers[step.id] = d
      } else if (step.type === 'route') {
        const dep = $('sel-depart')?.value
        const arr = $('sel-arrive')?.value
        if (dep && arr) state.answers[step.id] = `${dep} → ${arr}`
      }

      state.currentStep++
      if (state.currentStep < state.steps.length) {
        renderStep()
      } else {
        finishFlow()
      }
    })
  }

  // 카운터 버튼
  const counterVal = $('counter-val')
  $('counter-minus')?.addEventListener('click', () => {
    const cur = parseInt(counterVal.textContent)
    const min = step.min ?? 1
    if (cur > min) counterVal.textContent = cur - 1
  })
  $('counter-plus')?.addEventListener('click', () => {
    const cur = parseInt(counterVal.textContent)
    const max = step.max ?? 10
    if (cur < max) counterVal.textContent = cur + 1
  })

  // 최종 제출
  $('btn-submit')?.addEventListener('click', async () => {
    const { allowed } = await api.guard.checkSession({
      userId: state.userId,
      eventId: Object.values(state.answers).join('_'),
    })
    if (!allowed) {
      speak('이미 이 예매를 시도하셨어요.')
      alert('이미 예매를 시도하셨어요.\n중복 예매는 제한됩니다.')
      return
    }
    finishFlow()
  })
}

// ─── 완료 ─────────────────────────────────────────────────────────────────────
async function finishFlow() {
  // 데모 서버에 예매 데이터 전송
  const bookingResult = await api.submitBooking({
    date:  state.answers.date  ?? state.answers.train ?? '-',
    grade: state.answers.grade ?? state.answers.discount ?? '-',
    count: state.answers.count ?? '2',
  }).catch(() => null)

  showScreen('done')

  const doneTitle = document.querySelector('.done-title')
  const doneDesc  = document.querySelector('.done-desc')

  if (bookingResult?.ok && bookingResult?.bookingId) {
    if (doneTitle) doneTitle.textContent = '예매가 완료됐어요! 🎉'
    if (doneDesc) doneDesc.innerHTML = `
      예매 번호 <strong style="color:var(--site-accent,#3B5AC6)">${bookingResult.bookingId}</strong>
      <br>
      <span style="display:inline-block;margin-top:10px;font-size:14px;color:#666">
        크롬에서 예매 내역 확인 →
        <a href="#" id="link-bookings"
           style="color:#3B5AC6;text-decoration:underline">
          localhost:3000/bookings
        </a>
      </span>`
    // 링크 클릭 → 외부 브라우저 열기
    setTimeout(() => {
      document.getElementById('link-bookings')?.addEventListener('click', (e) => {
        e.preventDefault()
        api.openExternal('http://localhost:3000/bookings')
      })
    }, 50)
  } else {
    if (doneTitle) doneTitle.textContent = '예매가 완료됐어요! 🎉'
    if (doneDesc) doneDesc.textContent  = '잠시 후 확인 문자가 올 거예요'
  }

  speak('예매가 완료됐어요! 잠시 후 확인 문자가 올 거예요.')
}
