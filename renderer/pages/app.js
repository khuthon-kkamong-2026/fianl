/* ─── 찾으라우저 Renderer App ───────────────────────────────────────────────── */

const api = window.slowbro

// ─── 🟢 눈 아이콘 생성 (캔버스 직접 드로잉) ────────────────────────────────────
;(function applyIcon() {
  const S = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')

  // ── 1. 라운드 사각형 배경 (연두색) ──────────────────────────────────────────
  const R = S * 0.22
  ctx.beginPath()
  ctx.moveTo(R, 0); ctx.lineTo(S - R, 0)
  ctx.arcTo(S, 0, S, R, R)
  ctx.lineTo(S, S - R)
  ctx.arcTo(S, S, S - R, S, R)
  ctx.lineTo(R, S)
  ctx.arcTo(0, S, 0, S - R, R)
  ctx.lineTo(0, R)
  ctx.arcTo(0, 0, R, 0, R)
  ctx.closePath()
  // 연두 그라디언트
  const bgGrad = ctx.createLinearGradient(0, 0, S, S)
  bgGrad.addColorStop(0, '#a8eeac')
  bgGrad.addColorStop(1, '#7dd687')
  ctx.fillStyle = bgGrad
  ctx.fill()

  // 살짝 광택 (상단 밝은 하이라이트)
  const hlGrad = ctx.createLinearGradient(0, 0, 0, S * 0.55)
  hlGrad.addColorStop(0, 'rgba(255,255,255,0.28)')
  hlGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hlGrad
  ctx.beginPath()
  ctx.moveTo(R, 0); ctx.lineTo(S - R, 0)
  ctx.arcTo(S, 0, S, R, R)
  ctx.lineTo(S, S * 0.55)
  ctx.lineTo(0, S * 0.55)
  ctx.lineTo(0, R)
  ctx.arcTo(0, 0, R, 0, R)
  ctx.closePath()
  ctx.fill()

  // ── 2. 흰자 (흰 원) ──────────────────────────────────────────────────────────
  const cx = S * 0.52, cy = S * 0.44, eyeR = S * 0.30
  ctx.beginPath()
  ctx.arc(cx, cy, eyeR, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.18)'
  ctx.shadowBlur = S * 0.05
  ctx.fill()
  ctx.shadowBlur = 0

  // ── 3. 동공 (짙은 초록) ───────────────────────────────────────────────────────
  const irisR = S * 0.195
  const irisGrad = ctx.createRadialGradient(cx - S*0.03, cy - S*0.03, 0, cx, cy, irisR)
  irisGrad.addColorStop(0, '#2d5a35')
  irisGrad.addColorStop(0.6, '#1b3a20')
  irisGrad.addColorStop(1, '#0d2212')
  ctx.beginPath()
  ctx.arc(cx, cy + S * 0.025, irisR, 0, Math.PI * 2)
  ctx.fillStyle = irisGrad
  ctx.fill()

  // ── 4. 눈 반사 (초승달 형태 흰 하이라이트) ────────────────────────────────────
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy + S * 0.025, irisR, 0, Math.PI * 2)
  ctx.clip()
  // 왼쪽 위 흰 초승달
  ctx.beginPath()
  ctx.arc(cx - S*0.07, cy - S*0.06, S * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fill()
  // 작은 흰 별 반짝이
  ctx.beginPath()
  ctx.arc(cx + S*0.07, cy - S*0.07, S * 0.03, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fill()
  ctx.restore()

  // ── 5. 속눈썹 / 반짝임 선 (왼쪽 위) ─────────────────────────────────────────
  ctx.strokeStyle = '#1b3a20'
  ctx.lineWidth = S * 0.028
  ctx.lineCap = 'round'
  const lashOrigin = { x: S * 0.25, y: S * 0.28 }
  const lashes = [
    { dx: -0.06, dy: -0.09 },
    { dx:  0.00, dy: -0.10 },
    { dx:  0.07, dy: -0.07 },
  ]
  lashes.forEach(({ dx, dy }) => {
    ctx.beginPath()
    ctx.moveTo(lashOrigin.x, lashOrigin.y)
    ctx.lineTo(lashOrigin.x + dx * S, lashOrigin.y + dy * S)
    ctx.stroke()
  })
  // 점 두 개
  ctx.fillStyle = '#1b3a20'
  ctx.beginPath(); ctx.arc(S * 0.21, S * 0.18, S * 0.018, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(S * 0.29, S * 0.15, S * 0.012, 0, Math.PI * 2); ctx.fill()

  // ── 6. 입 (미소 곡선) ────────────────────────────────────────────────────────
  ctx.beginPath()
  ctx.arc(cx, S * 0.655, S * 0.095, Math.PI * 0.12, Math.PI * 0.88)
  ctx.strokeStyle = '#1b3a20'
  ctx.lineWidth = S * 0.032
  ctx.lineCap = 'round'
  ctx.stroke()

  // ── 7. 하단 작은 받침대 (초록 pill) ─────────────────────────────────────────
  const pw = S * 0.18, ph = S * 0.05
  const px = (S - pw) / 2, py = S * 0.875
  ctx.beginPath()
  ctx.roundRect(px, py, pw, ph, ph / 2)
  ctx.fillStyle = '#7dd687'
  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = S * 0.02
  ctx.fill()
  ctx.shadowBlur = 0

  api.setIcon(canvas.toDataURL('image/png'))
})()

// ─── 상태 ────────────────────────────────────────────────────────────────────
const state = {
  fontLevel:      0,
  browserOpen:    false,   // BrowserView 열려 있는지
  discoveryItems: [],
  currentCardIdx: 0,       // 틴더 카드 현재 인덱스
}

// ─── Spotify 미리듣기 오디오 (단일 인스턴스) ─────────────────────────────────
let _previewAudio = null
function playPreview(url) {
  stopPreview()
  if (!url) return
  _previewAudio = new Audio(url)
  _previewAudio.play().catch(() => {})
}
function stopPreview() {
  if (_previewAudio) {
    _previewAudio.pause()
    _previewAudio.src = ''
    _previewAudio = null
  }
}

// ─── DOM 참조 ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id)

const homeScreen    = $('home-screen')
const guideScreen   = $('guide-screen')
const guideContent  = $('guide-content')
const urlInput      = $('url-input')
const browserNavbar = $('browser-navbar')
const bvUrlDisplay  = $('bv-url-display')
const bvLoading     = $('bv-loading')

// ─── 화면 전환 ───────────────────────────────────────────────────────────────
function showScreen(name) {
  homeScreen.classList.add('hidden')
  guideScreen.classList.add('hidden')
  if (name === 'home') homeScreen.classList.remove('hidden')
  if (name === 'guide') guideScreen.classList.remove('hidden')
}

// ─── BrowserView 열기 / 닫기 ─────────────────────────────────────────────────
function getBrowserBounds() {
  const navbar = browserNavbar.getBoundingClientRect()
  return {
    x: 0,
    y: Math.round(navbar.bottom),
    width:  Math.round(window.innerWidth),
    height: Math.round(window.innerHeight) - Math.round(navbar.bottom),
  }
}

async function openBrowser(url) {
  // navbar 먼저 표시
  browserNavbar.classList.remove('hidden')
  document.getElementById('app').classList.add('browser-mode')
  showScreen('home')   // 홈을 뒤에 깔아두기 (BrowserView가 덮음)

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  await api.browser.open(url, getBrowserBounds())
  state.browserOpen = true
}

async function closeBrowser() {
  if (!state.browserOpen) return
  await api.browser.close()
  state.browserOpen = false
  browserNavbar.classList.add('hidden')
  document.getElementById('app').classList.remove('browser-mode')
}

window.addEventListener('resize', () => {
  if (state.browserOpen) api.browser.setBounds(getBrowserBounds())
})

// ─── BrowserView 이벤트 구독 ──────────────────────────────────────────────────
api.browser.onUrlChanged((url) => {
  urlInput.value = url
  bvUrlDisplay.textContent = url
})
api.browser.onTitleChanged((title) => {
  document.title = `찾으라우저 — ${title}`
})
api.browser.onLoading((loading) => {
  bvLoading.classList.toggle('spin', loading)
  $('bv-reload').textContent = loading ? '✕' : '↻'
})

// ─── 네비게이션 ──────────────────────────────────────────────────────────────
async function navigate(url) {
  if (!url) return
  if (!url.startsWith('http')) url = 'https://' + url
  urlInput.value = url

  if (state.browserOpen) {
    bvUrlDisplay.textContent = url
    await api.browser.navigate(url)
  } else {
    await openBrowser(url)
  }
}

$('btn-go').addEventListener('click', () => navigate(urlInput.value.trim()))
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(urlInput.value.trim()) })

// 플랫폼 바로가기 버튼
document.querySelectorAll('.platform-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Spotify는 카드 추출 대신 Web API 경로를 타도록 우회
    // (DOM에는 preview_url이 없어서 인앱 재생이 안 됨)
    if (btn.dataset.url === 'https://open.spotify.com') {
      openSpotifyDiscovery()
      return
    }
    navigate(btn.dataset.url)
  })
})

// 저장된 자격증명이 있으면 바로 탐색, 없으면 폼을 보여줌
function openSpotifyDiscovery() {
  const id     = localStorage.getItem('sp_client_id')
  const secret = localStorage.getItem('sp_client_secret')
  if (id && secret) {
    runSpotifyDiscovery(id, secret)
  } else {
    const credForm = $('spotify-cred-form')
    credForm?.classList.remove('hidden')
    credForm?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    $('sp-client-id')?.focus()
  }
}

// ─── 브라우저 네비게이션 버튼 ────────────────────────────────────────────────
$('bv-back').addEventListener('click',    () => api.browser.back())
$('bv-forward').addEventListener('click', () => api.browser.forward())
$('bv-reload').addEventListener('click',  () => api.browser.reload())
$('bv-home').addEventListener('click',   async () => {
  await closeBrowser()
  showScreen('home')
})

// 로고 클릭 → 홈으로
$('logo-text').style.cursor = 'pointer'
$('logo-text').addEventListener('click', async () => {
  await closeBrowser()
  showScreen('home')
})

// ─── 👁 찾아보자 버튼 ─────────────────────────────────────────────────────────
$('bv-slow-mode').addEventListener('click', async () => {
  const btn = $('bv-slow-mode')
  btn.classList.add('loading')
  btn.textContent = '⏳ 추출 중...'

  // 1순위: 콘텐츠 추출 → 찾으라우저 카드 UI
  const extracted = await api.browser.extractContent()

  if (extracted?.ok && extracted.items.length > 0) {
    btn.classList.remove('loading')
    btn.textContent = '👁 찾아보자'
    await closeBrowser()
    renderDiscoveryCards(extracted.items, extracted.siteName, extracted.siteUrl)
    return
  }

  // 2순위: fetch 인터셉션 (원본 디자인 유지)
  const fetchResult = await api.browser.interceptFetch()
  if (fetchResult?.ok) {
    btn.classList.remove('loading')
    btn.textContent = '🔀 다시 섞기'
    return
  }

  // 3순위: DOM 셔플 폴백
  const { ok, count } = await api.browser.shuffleDom()
  btn.classList.remove('loading')
  if (!ok || count < 2) {
    btn.textContent = '👁 찾아보자'
    return
  }
  btn.textContent = '🔀 다시 섞기'
})

// ─── 접근성 버튼 ─────────────────────────────────────────────────────────────
$('btn-font-up').addEventListener('click', () => {
  if (state.fontLevel < 2) { state.fontLevel++; applyFontLevel() }
})
$('btn-font-down').addEventListener('click', () => {
  if (state.fontLevel > 0) { state.fontLevel--; applyFontLevel() }
})
function applyFontLevel() {
  document.body.classList.remove('font-xl', 'font-xxl')
  if (state.fontLevel === 1) document.body.classList.add('font-xl')
  if (state.fontLevel === 2) document.body.classList.add('font-xxl')
}

// ─── Spotify 탐색 실행 (자격증명으로 API 호출 → 카드 렌더링) ─────────────────
async function runSpotifyDiscovery(id, secret) {
  const credForm = $('spotify-cred-form')
  credForm?.classList.add('hidden')

  showScreen('guide')
  guideContent.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:#fff">
      <div style="font-size:2.5em;margin-bottom:16px">🎵</div>
      <div style="font-size:1.1em;font-weight:700;color:#1DB954;margin-bottom:8px">Spotify 카탈로그 탐색 중...</div>
      <div style="font-size:0.85em;color:#888">전체 DB에서 랜덤으로 가져오는 중이에요</div>
    </div>`

  const result = await api.spotifyDiscover(id, secret)
  if (!result.ok) {
    guideContent.innerHTML = `
      <div style="padding:24px;color:#fff">
        <p style="color:#ff4444;font-weight:700;margin-bottom:8px">❌ 연결 실패</p>
        <p style="font-size:0.85em;color:#aaa;margin-bottom:12px">${result.error}</p>
        <button id="link-sp-reset" style="background:none;border:none;color:#1DB954;font-size:0.85em;cursor:pointer">🔑 다시 입력하기</button>
      </div>`
    document.getElementById('link-sp-reset')?.addEventListener('click', () => {
      localStorage.removeItem('sp_client_id')
      localStorage.removeItem('sp_client_secret')
      showScreen('home')
      credForm?.classList.remove('hidden')
    })
    return
  }

  renderDiscoveryCards(result.items.map(i => ({
    title:      i.title,
    subtitle:   i.artist,
    image:      i.imageUrl,
    url:        i.externalUrl || null,
    previewUrl: i.previewUrl || null,
    color:      null,
    hidden:     false,
  })), 'Spotify', 'https://open.spotify.com')
}

// ─── Spotify 자격증명 폼 핸들러 ───────────────────────────────────────────────
;(function initSpotifyCred() {
  const credForm = $('spotify-cred-form')
  const devLink  = $('spotify-dev-link')

  devLink?.addEventListener('click', (e) => {
    e.preventDefault()
    api.openExternal('https://developer.spotify.com/dashboard')
  })

  $('sp-cancel')?.addEventListener('click', () => credForm?.classList.add('hidden'))

  $('sp-confirm')?.addEventListener('click', async () => {
    const id     = $('sp-client-id')?.value.trim()
    const secret = $('sp-client-secret')?.value.trim()
    if (!id || !secret) return
    localStorage.setItem('sp_client_id',     id)
    localStorage.setItem('sp_client_secret', secret)
    runSpotifyDiscovery(id, secret)
  })
})()

// ─── 발견 탐색 통일 카드 UI ───────────────────────────────────────────────────
function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── 틴더 스타일 카드 스와이프 UI ────────────────────────────────────────────
function renderDiscoveryCards(rawItems, siteName = '', siteUrl = '') {
  state.discoveryItems = shuffleArray(rawItems)
  state.currentCardIdx = 0
  showScreen('guide')

  const total    = state.discoveryItems.length
  const hiddenCnt = rawItems.filter(i => i.hidden).length

  const compareBox = hiddenCnt > 0 ? `
    <div class="td-compare">
      <div class="td-cbox">
        <div class="td-clabel">알고리즘이 보여준 것</div>
        <div class="td-ccount td-cc-gray">${total - hiddenCnt}<span class="td-cunit">개</span></div>
        <div class="td-cdesc">인기 콘텐츠만</div>
      </div>
      <div class="td-carrow">→</div>
      <div class="td-cbox">
        <div class="td-clabel">👁 찾으라우저</div>
        <div class="td-ccount td-cc-purple">${total}<span class="td-cunit">개</span></div>
        <div class="td-cdesc">indie 포함 전체</div>
      </div>
    </div>` : ''

  const realNote = hiddenCnt === 0 && siteName && siteName !== 'Spotify' ? `
    <div class="td-note">
      ⚠️ <strong>${siteName}</strong>은 공개 API가 없어요.
      알고리즘이 이미 고른 ${total}개의 순서만 무력화해요.
    </div>` : ''

  guideContent.innerHTML = `
    <style>
      /* ── 레이아웃 ── */
      .td-wrap { display:flex; flex-direction:column; align-items:center;
        padding:14px 16px 20px; min-height:100%; color:#fff; box-sizing:border-box;
        background:#0e0e16 }

      /* ── 알고리즘 비교 박스 ── */
      .td-compare { display:flex; align-items:center; gap:10px;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
        border-radius:14px; padding:10px 18px; margin-bottom:10px;
        width:100%; max-width:360px; box-sizing:border-box }
      .td-cbox { flex:1; text-align:center }
      .td-clabel { font-size:0.68em; color:#777; margin-bottom:2px }
      .td-ccount { font-size:2em; font-weight:900; line-height:1 }
      .td-cunit  { font-size:0.45em; font-weight:600; margin-left:1px }
      .td-cc-gray   { color:#4a4a5a }
      .td-cc-purple { color:#a855f7 }
      .td-cdesc { font-size:0.66em; color:#555; margin-top:3px }
      .td-carrow { font-size:1.3em; color:#444; flex-shrink:0 }

      /* ── API 없음 노트 ── */
      .td-note { font-size:0.72em; color:#777; background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.07); border-radius:8px;
        padding:7px 12px; margin-bottom:10px; line-height:1.6;
        width:100%; max-width:360px; box-sizing:border-box }
      .td-note strong { color:#a855f7 }

      /* ── 소스 + 카운터 ── */
      .td-meta { display:flex; align-items:center; justify-content:space-between;
        width:100%; max-width:360px; margin-bottom:10px }
      .td-source { font-size:0.73em; color:#888;
        background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12);
        padding:3px 10px; border-radius:20px }
      .td-counter { font-size:0.88em; font-weight:800;
        background:linear-gradient(135deg,#7b00d4,#a855f7);
        -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text }

      /* ── 카드 스택 ── */
      .td-stack { position:relative; width:300px; height:420px;
        margin-bottom:14px; flex-shrink:0 }

      .td-card { position:absolute; inset:0; border-radius:22px; overflow:hidden;
        will-change:transform; backface-visibility:hidden;
        box-shadow:0 12px 48px rgba(0,0,0,.65);
        cursor:grab; user-select:none; touch-action:none }
      .td-card:active { cursor:grabbing }
      .td-card-bg { position:absolute; inset:0;
        background-size:cover; background-position:center; background-repeat:no-repeat }
      .td-card-d0 { z-index:3; transform:rotate(0deg)   scale(1)    translateY(0px) }
      .td-card-d1 { z-index:2; transform:rotate(3deg)   scale(0.95) translateY(14px);
        pointer-events:none }
      .td-card-d2 { z-index:1; transform:rotate(-3deg)  scale(0.90) translateY(26px);
        pointer-events:none }

      .td-overlay { position:absolute; inset:0;
        background:linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.1) 55%, transparent 100%) }
      .td-card-info { position:absolute; bottom:0; left:0; right:0; padding:22px 20px }
      .td-indie-tag { display:inline-block; background:rgba(123,0,212,.9); color:#fff;
        font-size:0.63em; font-weight:800; padding:2px 9px; border-radius:8px; margin-bottom:8px }
      .td-card-title { font-size:1.08em; font-weight:900; color:#fff; line-height:1.35;
        text-shadow:0 2px 8px rgba(0,0,0,.9) }
      .td-card-sub { font-size:0.78em; color:rgba(255,255,255,.72); margin-top:5px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis }

      /* ── 드래그 스탬프 ── */
      .td-stamp { position:absolute; top:22px; font-size:1.1em; font-weight:900;
        padding:5px 14px; border-radius:8px; border:3px solid;
        opacity:0; transition:opacity .12s; pointer-events:none; z-index:10 }
      .td-stamp-skip { left:18px; color:#ff5555; border-color:#ff5555;
        transform:rotate(-18deg) }
      .td-stamp-go   { right:18px; color:#55ff88; border-color:#55ff88;
        transform:rotate(18deg) }
      .td-card.hint-left  .td-stamp-skip { opacity:1 }
      .td-card.hint-right .td-stamp-go   { opacity:1 }

      /* ── 스와이프 애니메이션 ── */
      @keyframes td-out-l { to { transform:translateX(-130vw) rotate(-28deg); opacity:0 } }
      @keyframes td-out-r { to { transform:translateX(130vw)  rotate(28deg);  opacity:0 } }
      .td-swipe-l { animation:td-out-l .38s cubic-bezier(.4,0,.2,1) forwards !important;
        pointer-events:none }
      .td-swipe-r { animation:td-out-r .38s cubic-bezier(.4,0,.2,1) forwards !important;
        pointer-events:none }

      /* ── 다 봤을 때 ── */
      .td-empty { display:flex; flex-direction:column; align-items:center;
        justify-content:center; height:100%; gap:10px; text-align:center;
        background:rgba(255,255,255,.03); border-radius:22px;
        border:1px solid rgba(255,255,255,.08) }
      .td-empty-icon { font-size:3.2em }
      .td-empty-msg  { font-size:0.95em; font-weight:700; color:#ccc }
      .td-empty-sub  { font-size:0.78em; color:#555 }

      /* ── 힌트 ── */
      .td-hint { font-size:0.72em; color:#444; text-align:center; margin-bottom:12px;
        letter-spacing:.02em }

      /* ── 액션 버튼 ── */
      .td-actions { display:flex; gap:22px; align-items:center; margin-bottom:14px }
      .td-btn { width:62px; height:62px; border-radius:50%; border:none; cursor:pointer;
        font-size:1.35em; display:flex; align-items:center; justify-content:center;
        box-shadow:0 4px 20px rgba(0,0,0,.45);
        transition:transform .15s, box-shadow .15s }
      .td-btn:hover  { transform:scale(1.13) }
      .td-btn:active { transform:scale(.95) }
      .td-btn-skip { background:#1c1c28; color:#ff5555;
        border:2px solid rgba(255,85,85,.25);
        box-shadow:0 4px 20px rgba(255,85,85,.15) }
      .td-btn-goto { background:linear-gradient(135deg,#5500aa,#a855f7); color:#fff;
        box-shadow:0 4px 24px rgba(123,0,212,.55) }

      /* ── 푸터 ── */
      .td-footer { display:flex; gap:8px; width:100%; max-width:360px }
      .td-reshuffle { flex:1; padding:10px 0;
        background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12);
        color:#bbb; border-radius:12px; font-size:0.88em; cursor:pointer;
        transition:background .15s, color .15s }
      .td-reshuffle:hover { background:rgba(255,255,255,.14); color:#fff }
      .td-back { padding:10px 14px;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
        color:#666; border-radius:12px; font-size:0.82em; cursor:pointer;
        white-space:nowrap; transition:background .15s }
      .td-back:hover { background:rgba(255,255,255,.1); color:#bbb }
    </style>

    <div class="td-wrap">
      ${compareBox}
      ${realNote}
      <div class="td-meta">
        ${siteName ? `<span class="td-source">📺 ${siteName}</span>` : '<span></span>'}
        <div class="td-counter" id="td-counter">1 / ${total}</div>
      </div>
      <div class="td-stack" id="td-stack"></div>
      <div class="td-hint">← 건너뛰기 &nbsp;·&nbsp; 바로가기 →</div>
      <div class="td-actions">
        <button class="td-btn td-btn-skip" id="td-skip" title="건너뛰기">✕</button>
        <button class="td-btn td-btn-goto" id="td-goto" title="바로가기">♥</button>
      </div>
      <div class="td-footer">
        <button class="td-reshuffle" id="td-reshuffle">🔀 다시 섞기</button>
        ${siteUrl ? `<button class="td-back" id="td-back">← 돌아가기</button>` : ''}
      </div>
    </div>`

  setupTinderCards(siteUrl)
}

// ─── 틴더 인터랙션 ──────────────────────────────────────────────────────────
function setupTinderCards(siteUrl) {
  const FALLBACKS = ['#0d1b3e','#0f2d0f','#0a1e30','#251425','#2a1100','#0a2010','#1e1e08']

  function renderStack() {
    const stack   = document.getElementById('td-stack')
    const counter = document.getElementById('td-counter')
    if (!stack) return

    const items = state.discoveryItems
    const idx   = state.currentCardIdx
    const rem   = items.length - idx

    if (counter) counter.textContent = rem > 0 ? `${idx + 1} / ${items.length}` : '완료!'

    if (rem <= 0) {
      stack.innerHTML = `
        <div class="td-empty">
          <div class="td-empty-icon">👁</div>
          <div class="td-empty-msg">모든 콘텐츠를 탐색했어요</div>
          <div class="td-empty-sub">다시 섞기를 눌러 처음부터!</div>
        </div>`
      return
    }

    // 뒤에서부터 렌더링 (앞 카드가 마지막에 → DOM 최상단)
    let html = ''
    const visible = Math.min(3, rem)
    for (let d = visible - 1; d >= 0; d--) {
      const item   = items[idx + d]
      const isTop  = d === 0
      const hasImg = item.image && item.image.startsWith('http')
      const bgStyle = hasImg
        ? `background-image:url('${item.image}')`
        : `background:${item.color || FALLBACKS[(idx + d) % FALLBACKS.length]}`

      html += `
        <div class="td-card td-card-d${d}" ${isTop ? 'id="td-top"' : ''}>
          <div class="td-card-bg" style="${bgStyle}"></div>
          <div class="td-overlay"></div>
          ${isTop ? `
            <div class="td-stamp td-stamp-skip">건너뛰기</div>
            <div class="td-stamp td-stamp-go">바로가기!</div>` : ''}
          <div class="td-card-info">
            ${item.hidden ? '<span class="td-indie-tag">🔍 indie</span>' : ''}
            <div class="td-card-title">${item.title}</div>
            ${item.subtitle ? `<div class="td-card-sub">${item.subtitle}</div>` : ''}
          </div>
        </div>`
    }
    stack.innerHTML = html

    const topCard = document.getElementById('td-top')
    if (topCard) attachDrag(topCard)
  }

  function doSwipe(dir) {
    const topCard = document.getElementById('td-top')
    if (!topCard) return
    const item = state.discoveryItems[state.currentCardIdx]

    topCard.removeAttribute('id')   // 중복 스와이프 방지
    topCard.classList.add(dir === 'right' ? 'td-swipe-r' : 'td-swipe-l')

    // 하트(오른쪽) → 미리듣기(30초 MP3) 인앱 재생, 없으면 페이지 열기 폴백
    let openUrl = null
    if (dir === 'right') {
      console.log('[♥] item:', { title: item?.title, previewUrl: item?.previewUrl, url: item?.url })
      if (item?.previewUrl) playPreview(item.previewUrl)
      else if (item?.url)   openUrl = item.url
    }

    setTimeout(async () => {
      state.currentCardIdx++
      renderStack()
      if (openUrl) await openBrowser(openUrl)
    }, 360)
  }

  function attachDrag(card) {
    let sx = 0, sy = 0, dragging = false, dx = 0

    function onDown(e) {
      dragging = true; dx = 0
      const p = e.touches?.[0] || e
      sx = p.clientX; sy = p.clientY
      card.style.transition = 'none'
      e.preventDefault()
    }
    function onMove(e) {
      if (!dragging) return
      const p = e.touches?.[0] || e
      dx = p.clientX - sx
      const dy = (p.clientY - sy) * 0.2
      const rot = dx * 0.07
      card.style.transform = `translateX(${dx}px) translateY(${dy}px) rotate(${rot}deg)`
      card.classList.toggle('hint-right', dx >  60)
      card.classList.toggle('hint-left',  dx < -60)
    }
    function onUp() {
      if (!dragging) return
      dragging = false
      document.removeEventListener('mousemove',  onMove)
      document.removeEventListener('touchmove',  onMove)
      document.removeEventListener('mouseup',    onUp)
      document.removeEventListener('touchend',   onUp)
      card.classList.remove('hint-right', 'hint-left')
      if (dx > 90)       doSwipe('right')
      else if (dx < -90) doSwipe('left')
      else {
        card.style.transition = 'transform .32s cubic-bezier(.25,.46,.45,.94)'
        card.style.transform  = ''
      }
    }

    card.addEventListener('mousedown',  onDown)
    card.addEventListener('touchstart', onDown, { passive: false })
    document.addEventListener('mousemove',  onMove)
    document.addEventListener('touchmove',  onMove, { passive: false })
    document.addEventListener('mouseup',    onUp)
    document.addEventListener('touchend',   onUp)
  }

  renderStack()

  document.getElementById('td-skip')?.addEventListener('click', () => doSwipe('left'))
  document.getElementById('td-goto')?.addEventListener('click', () => doSwipe('right'))
  document.getElementById('td-reshuffle')?.addEventListener('click', () => {
    stopPreview()
    state.discoveryItems = shuffleArray(state.discoveryItems)
    state.currentCardIdx = 0
    renderStack()
  })
  document.getElementById('td-back')?.addEventListener('click', async () => {
    stopPreview()
    siteUrl ? await openBrowser(siteUrl) : showScreen('home')
  })
}
