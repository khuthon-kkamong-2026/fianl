const { app, BrowserWindow, BrowserView, ipcMain, nativeImage, session } = require('electron')
const path = require('path')
const http = require('http')
const { parsePageForSeniors } = require('../engine/pageParser')
const { checkClickSpeed, checkSessionLimit } = require('../guard/antiAbuse')
const spotifyApi = require('../engine/spotifyApi')

const isDev = process.argv.includes('--dev')

// ─── 메인 윈도우 (SlowBro UI) ───────────────────────────────────────────────
let mainWindow
let browserView = null   // 원본 사이트 임베드용

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: '찾으라우저',
    backgroundColor: '#FAFAF8',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,   // 보안: renderer 에서 Node 직접 접근 차단
      nodeIntegration: false,   // 보안: Node API renderer 노출 차단
      sandbox: false,           // preload 에서 require 허용 (contextIsolation과 함께)
    },
  })

  mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'))

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })
}

// ─── 임베드 WebView 세션 — 광고/트래커 차단 ───────────────────────────────
function setupAdBlockSession() {
  const filter = { urls: ['*://*.doubleclick.net/*', '*://*.googlesyndication.com/*', '*://*.adnxs.com/*'] }
  session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    callback({ cancel: true })
  })
}

// ─── IPC 핸들러 ─────────────────────────────────────────────────────────────

// renderer가 URL 로드 요청 → 파싱 후 단순화된 데이터 반환
ipcMain.handle('page:load', async (event, url) => {
  try {
    const result = await parsePageForSeniors(url)
    return { ok: true, data: result }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// 클릭 속도 검사 (매크로 방지)
ipcMain.handle('guard:checkClick', async (event, { sessionId, timestamp }) => {
  const safe = checkClickSpeed(sessionId, timestamp)
  return { safe }
})

// 세션(예매) 중복 제한
ipcMain.handle('guard:checkSession', async (event, { userId, eventId }) => {
  const allowed = checkSessionLimit(userId, eventId)
  return { allowed }
})


// 예매 데이터를 데모 서버(localhost:3000)에 전송
ipcMain.handle('book:submit', async (event, bookingData) => {
  return new Promise((resolve) => {
    const body = JSON.stringify(bookingData)
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/book',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve({ ok: false, error: '응답 파싱 실패' }) }
      })
    })
    req.on('error', (e) => {
      console.warn('[book:submit] 데모 서버 연결 실패 — 서버가 실행 중인지 확인하세요:', e.message)
      resolve({ ok: false, error: '서버에 연결할 수 없어요' })
    })
    req.write(body)
    req.end()
  })
})

// renderer가 canvas로 그린 이모지 PNG를 창 아이콘으로 설정
ipcMain.on('window:set-icon', (event, dataUrl) => {
  const icon = nativeImage.createFromDataURL(dataUrl)
  mainWindow?.setIcon(icon)
})

// ─── BrowserView (원본 사이트 임베드) ─────────────────────────────────────────

// URL을 BrowserView에 열기 — bounds는 renderer에서 계산해서 넘겨줌
ipcMain.handle('browser:open', async (event, { url, bounds }) => {
  if (!browserView) {
    browserView = new BrowserView({
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })
    mainWindow.addBrowserView(browserView)

    browserView.webContents.on('did-navigate', (_, navUrl) => {
      mainWindow.webContents.send('browser:url-changed', navUrl)
    })
    browserView.webContents.on('did-navigate-in-page', (_, navUrl) => {
      mainWindow.webContents.send('browser:url-changed', navUrl)
    })
    browserView.webContents.on('page-title-updated', (_, title) => {
      mainWindow.webContents.send('browser:title-changed', title)
    })
    browserView.webContents.on('did-start-loading', () => {
      mainWindow.webContents.send('browser:loading', true)
    })
    browserView.webContents.on('did-stop-loading', () => {
      mainWindow.webContents.send('browser:loading', false)
    })

    // 팝업 새 창 → BrowserView 안에서 이동 (구글 로그인 등 처리)
    browserView.webContents.setWindowOpenHandler(({ url }) => {
      browserView.webContents.loadURL(url).catch(() => {})
      mainWindow.webContents.send('browser:url-changed', url)
      return { action: 'deny' }   // 새 창 차단, 대신 현재 뷰에서 로드
    })
  }

  browserView.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height })
  await browserView.webContents.loadURL(url).catch(() => {})
  return { ok: true }
})

// BrowserView 닫기
ipcMain.handle('browser:close', async () => {
  if (browserView) {
    mainWindow.removeBrowserView(browserView)
    browserView.webContents.destroy()
    browserView = null
  }
  return { ok: true }
})

// 내비게이션 컨트롤
ipcMain.handle('browser:navigate', async (_, url) => {
  if (!browserView) return { ok: false }
  await browserView.webContents.loadURL(url).catch(() => {})
  return { ok: true }
})
ipcMain.handle('browser:back',    async () => { browserView?.webContents.canGoBack()    && browserView.webContents.goBack() })
ipcMain.handle('browser:forward', async () => { browserView?.webContents.canGoForward() && browserView.webContents.goForward() })
ipcMain.handle('browser:reload',  async () => { browserView?.webContents.reload() })

// 창 크기 바뀌면 bounds 재조정
ipcMain.handle('browser:setBounds', async (_, bounds) => {
  browserView?.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height })
})

// 페이지 로드 완료까지 대기 (최대 6초)
ipcMain.handle('browser:waitLoad', () => {
  return new Promise((resolve) => {
    if (!browserView) { resolve(false); return }
    if (!browserView.webContents.isLoading()) { resolve(true); return }
    const t = setTimeout(() => resolve(true), 6000)
    browserView.webContents.once('did-stop-loading', () => { clearTimeout(t); resolve(true) })
  })
})

// 로그인 버튼 하이라이트 주입
ipcMain.handle('browser:injectHighlight', async (_, { selectors }) => {
  if (!browserView) return { ok: false, found: false }

  const selectorsJson = JSON.stringify(selectors || [])
  const found = await browserView.webContents.executeJavaScript(`
    (function() {
      // 애니메이션 CSS 주입 (중복 방지)
      if (!document.getElementById('_sb_styles')) {
        const s = document.createElement('style')
        s.id = '_sb_styles'
        s.textContent = \`
          @keyframes _sb_pulse {
            0%, 100% { box-shadow: 0 0 0 4px rgba(255,60,60,0.9), 0 0 24px rgba(255,60,60,0.4); }
            50%       { box-shadow: 0 0 0 12px rgba(255,60,60,0), 0 0 8px rgba(255,60,60,0.1); }
          }
          ._sb_highlight {
            outline: 4px solid #ff3c3c !important;
            outline-offset: 4px !important;
            border-radius: 6px !important;
            animation: _sb_pulse 1.3s ease-in-out infinite !important;
            position: relative !important;
            z-index: 99998 !important;
          }
        \`
        document.head.appendChild(s)
      }

      // 기존 하이라이트 제거
      document.querySelectorAll('._sb_highlight').forEach(el => el.classList.remove('_sb_highlight'))

      // 로그인 버튼 탐색
      const sels = ${selectorsJson}
      let btn = null
      for (const sel of sels) {
        try { btn = document.querySelector(sel); if (btn) break } catch {}
      }

      if (btn) {
        btn.classList.add('_sb_highlight')
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return true
      }
      return false
    })()
  `).catch(() => false)

  return { ok: true, found }
})

// ─── Spotify 전체 카탈로그 랜덤 탐색 ─────────────────────────────────────────
ipcMain.handle('spotify:discover', async (event, { clientId, clientSecret }) => {
  try {
    const rawItems = await spotifyApi.discover(clientId, clientSecret)
    // 하트(바로가기) 클릭 시 BrowserView로 열 수 있도록 externalUrl 부여
    const items = rawItems.map(it => ({
      ...it,
      externalUrl: it.id
        ? `https://open.spotify.com/${it.type === 'album' ? 'album' : 'track'}/${it.id}`
        : null,
    }))
    return { ok: true, items }
  } catch (err) {
    console.error('[Spotify]', err.message)
    return { ok: false, error: err.message }
  }
})

// ─── 알고리즘 무력화 — 콘텐츠 추출 → 찾으라우저 통일 카드 UI ────────────────
// 어떤 사이트든 "발견 탐색" 누르면 콘텐츠를 추출해서 동일한 카드 그리드로 변환
// StreamHub: /api/catalog로 알고리즘이 숨긴 항목까지 전체 DB 노출
// 실제 사이트: DOM에서 카드 요소 추출
ipcMain.handle('browser:extractContent', async () => {
  if (!browserView) return { ok: false, items: [], siteName: '' }

  const currentUrl = browserView.webContents.getURL()
  let siteName = ''
  try { siteName = new URL(currentUrl).hostname.replace('www.', '') } catch {}

  // ── StreamHub (mock 데모): 전체 카탈로그 fetch — 알고리즘이 숨긴 indie 포함 ──
  if (currentUrl.includes('localhost:3001')) {
    const data = await browserView.webContents.executeJavaScript(`
      (async () => {
        const res = await fetch('/api/catalog')
        return await res.json()
      })()
    `).catch(() => null)

    if (data?.items) {
      const items = data.items.map(item => ({
        title:    item.title,
        subtitle: `${item.genre} · ${item.year}`,
        image:    null,
        color:    item.color,
        desc:     item.desc,
        hidden:   item.hidden,   // ← 알고리즘이 숨긴 항목 플래그
        views:    item.views,
      }))
      return { ok: true, items, siteName: 'StreamHub', siteUrl: currentUrl }
    }
  }

  // ── 실제 사이트: 사이트별 특화 + 범용 DOM 카드 추출 ────────────────────────
  const items = await browserView.webContents.executeJavaScript(`
    (function() {
      const results = []
      const seen    = new Set()
      const host    = location.hostname

      function addItem(title, image, subtitle, url) {
        if (!title || title.length < 2) return
        const key = title.slice(0, 20)
        if (seen.has(key)) return
        seen.add(key)
        results.push({ title: title.slice(0, 50), image: image || null, subtitle: subtitle || '', url: url || null })
      }

      // ── Melon 차트 ──────────────────────────────────────────────────────────
      if (host.includes('melon.com')) {
        document.querySelectorAll('.ellipsis.rank01').forEach(el => {
          const a      = el.querySelector('a')
          const title  = a?.textContent?.trim()
          const tr     = el.closest('tr')
          const artist = tr?.querySelector('.ellipsis.rank02 a')?.textContent?.trim()
          const img    = tr?.querySelector('img')
          const imgSrc = img?.getAttribute('src') || img?.getAttribute('data-src') || ''
          const url    = a?.href || null
          addItem(title, imgSrc.startsWith('http') ? imgSrc : null, artist || '', url)
        })
      }

      // ── Spotify 웹 플레이어 ────────────────────────────────────────────────
      if (host.includes('spotify.com')) {
        document.querySelectorAll('[data-testid="card-container"]').forEach(card => {
          const title = card.querySelector('[data-testid="cardTitle"], p, [class*="title"]')?.textContent?.trim()
          const img   = card.querySelector('img')
          const link  = card.querySelector('a[href]')
          const href  = link?.getAttribute('href') || ''
          const url   = href ? (href.startsWith('http') ? href : 'https://open.spotify.com' + href) : null
          addItem(title, img?.src, '', url)
        })
      }

      // ── YouTube 홈 / 검색 결과 ───────────────────────────────────────────
      if (host.includes('youtube.com')) {
        document.querySelectorAll(
          'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer'
        ).forEach(item => {
          const titleEl = item.querySelector('#video-title, #video-title-link, yt-formatted-string#video-title')
          const title   = titleEl?.textContent?.trim()
                       || titleEl?.getAttribute('aria-label')?.trim()
                       || item.querySelector('[aria-label]')?.getAttribute('aria-label')?.trim()
          const channel = item.querySelector('#channel-name #text, #channel-name a, ytd-channel-name yt-formatted-string')?.textContent?.trim()
          const img     = item.querySelector('img.yt-img-shadow, ytd-thumbnail img, img[src*="ytimg"]')
          const imgSrc  = img?.src?.startsWith('http') ? img.src : null
          const watchLink = item.querySelector('a#thumbnail, a[href*="/watch"], a[href*="/shorts"]')
          const whref   = watchLink?.getAttribute('href') || ''
          const url     = whref ? (whref.startsWith('http') ? whref : 'https://www.youtube.com' + whref) : null
          addItem(title, imgSrc, channel, url)
        })
      }

      // ── Naver Music ──────────────────────────────────────────────────────
      if (host.includes('music.naver.com')) {
        document.querySelectorAll('.lst_item, .item').forEach(item => {
          const title  = item.querySelector('.name .wz_name, .info_title')?.textContent?.trim()
          const artist = item.querySelector('.artist, .info_artist')?.textContent?.trim()
          const img    = item.querySelector('img')
          addItem(title, img?.src, artist)
        })
      }

      // ── Bugs 차트 ────────────────────────────────────────────────────────
      if (host.includes('bugs.co.kr')) {
        document.querySelectorAll('table.list tbody tr').forEach(row => {
          const a      = row.querySelector('.title a')
          const title  = a?.textContent?.trim()
          const artist = row.querySelector('.artist a')?.textContent?.trim()
          const img    = row.querySelector('img.thumbnail')
          const url    = a?.href || null
          addItem(title, img?.src, artist, url)
        })
      }

      // ── Genie 차트 ───────────────────────────────────────────────────────
      if (host.includes('genie.co.kr')) {
        document.querySelectorAll('#body-content tr.list').forEach(row => {
          const a      = row.querySelector('.title a')
          const title  = a?.textContent?.trim()
          const artist = row.querySelector('.artist')?.textContent?.trim()
          const img    = row.querySelector('img')
          const url    = a?.href || null
          addItem(title, img?.src, artist, url)
        })
      }

      // ── Tving ────────────────────────────────────────────────────────────
      if (host.includes('tving.com')) {
        document.querySelectorAll('[class*="ContentCard"], [class*="content-card"], .card_item').forEach(card => {
          const title = card.querySelector('[class*="title"], .card_title')?.textContent?.trim()
          const img   = card.querySelector('img')
          addItem(title, img?.src, '')
        })
      }

      // ── Wavve ─────────────────────────────────────────────────────────────
      if (host.includes('wavve.com')) {
        document.querySelectorAll('.cont_item, [class*="vod-item"], [class*="card"]').forEach(card => {
          const title = card.querySelector('.title, .tit, [class*="title"]')?.textContent?.trim()
          const img   = card.querySelector('img')
          addItem(title, img?.src, '')
        })
      }

      // ── Watcha ───────────────────────────────────────────────────────────
      if (host.includes('watcha.com')) {
        document.querySelectorAll('[class*="CardContainer"], [class*="ContentCard"]').forEach(card => {
          const title = card.querySelector('[class*="Title"], [class*="title"]')?.textContent?.trim()
          const img   = card.querySelector('img')
          addItem(title, img?.src, '')
        })
      }

      // ── Naver (뉴스/연예) ─────────────────────────────────────────────────
      if (host.includes('naver.com') && !host.includes('music')) {
        document.querySelectorAll('.news_tit, .cluster_text_headline, [class*="card_item"]').forEach(item => {
          const title = item.querySelector('a, strong')?.textContent?.trim() || item.textContent?.trim()
          const img   = item.closest('[class*="card"], [class*="item"]')?.querySelector('img')
          addItem(title, img?.src, '')
        })
      }

      // ── 결과 충분하면 반환 ─────────────────────────────────────────────────
      if (results.length >= 5) return results

      // ── 범용 DOM 카드 추출 (사이트 무관 폴백) ─────────────────────────────
      const CARD_SELS = [
        '[data-testid*="card"]',
        '[class*="card-item"]', '[class*="CardItem"]',
        '[class*="vod-item"]',  '[class*="VodItem"]',
        '[class*="music-item"]','[class*="MusicItem"]',
        'li[class*="item"]',    'li[class*="card"]',
        '[class*="content-item"]',
      ]
      const TITLE_SELS = [
        '[class*="title"]','[class*="Title"]',
        '[class*="name"]', '[class*="Name"]',
        'h1','h2','h3','h4','strong',
      ].join(',')

      for (const sel of CARD_SELS) {
        if (results.length >= 60) break
        try {
          document.querySelectorAll(sel).forEach(el => {
            if (results.length >= 60 || !el.offsetParent) return
            const img    = el.querySelector('img')
            const imgUrl = img?.src || img?.dataset?.src || ''
            const titleEl = el.querySelector(TITLE_SELS)
            const title   = (titleEl?.textContent || el.textContent || '').trim().replace(/\s+/g,' ')
            // 순위 숫자("7위", "TOP10" 등) 필터링
            if (/^\d+위$/.test(title) || /^(TOP|No\.?)\s*\d+$/i.test(title)) return
            addItem(title, imgUrl.startsWith('http') ? imgUrl : null, '')
          })
        } catch(_) {}
        if (results.length >= 6) break
      }
      return results
    })()
  `).catch(() => [])

  return { ok: items.length > 0, items, siteName, siteUrl: currentUrl }
})

// ─── 알고리즘 무력화 — fetch 인터셉션 (JSON 응답 레벨 셔플) ──────────────────
// 페이지의 fetch를 오버라이드해서 JSON 응답이 오면 배열을 셔플 후 반환
// → 사이트 디자인·CSS 100% 유지, 데이터만 셔플
ipcMain.handle('browser:interceptFetch', async () => {
  if (!browserView) return { ok: false }

  const result = await browserView.webContents.executeJavaScript(`
    (function() {
      if (window.__sb_intercepted__) {
        // 이미 주입됨 → 재로드만
        if (typeof window.__sbReload === 'function') window.__sbReload()
        return 'reloaded'
      }
      window.__sb_intercepted__ = true

      // ── fetch 오버라이드 ────────────────────────────────────────────────
      const _fetch = window.fetch.bind(window)
      window.fetch = async function(input, init) {
        const response = await _fetch(input, init)

        // JSON 응답만 처리
        const ct = response.headers.get('content-type') || ''
        if (!ct.includes('json')) return response

        // 응답 복제해서 읽기 (원본 stream은 한 번만 읽을 수 있음)
        let data
        try { data = await response.clone().json() }
        catch { return response }

        // ── JSON 안의 콘텐츠 배열 탐색 & 셔플 ──────────────────────────
        let shuffled = false
        function shuffleDeep(obj) {
          if (Array.isArray(obj)) {
            // 콘텐츠 배열 판별: 요소가 객체이고 id/title/name 중 하나를 가짐
            if (obj.length >= 2 && obj[0] && typeof obj[0] === 'object' &&
                ('id' in obj[0] || 'title' in obj[0] || 'name' in obj[0])) {
              for (let i = obj.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [obj[i], obj[j]] = [obj[j], obj[i]]
              }
              shuffled = true
            }
            obj.forEach(v => typeof v === 'object' && v !== null && shuffleDeep(v))
          } else if (obj && typeof obj === 'object') {
            Object.values(obj).forEach(v => shuffleDeep(v))
          }
        }
        shuffleDeep(data)

        if (!shuffled) return response

        // 셔플된 데이터로 새 Response 반환 → 사이트 JS는 셔플된 데이터를 받음
        return new Response(JSON.stringify(data), {
          status:     response.status,
          statusText: response.statusText,
          headers:    response.headers,
        })
      }

      // ── XHR도 커버 (XMLHttpRequest 기반 사이트 대응) ───────────────────
      const _XHR = window.XMLHttpRequest
      window.XMLHttpRequest = function() {
        const xhr = new _XHR()
        const _open = xhr.open.bind(xhr)
        let _method, _url
        xhr.open = function(method, url, ...rest) {
          _method = method; _url = url
          return _open(method, url, ...rest)
        }
        xhr.addEventListener('readystatechange', function() {
          if (xhr.readyState !== 4) return
          try {
            const ct = xhr.getResponseHeader('content-type') || ''
            if (!ct.includes('json')) return
            const data = JSON.parse(xhr.responseText)
            function shuffleDeep(obj) {
              if (Array.isArray(obj) && obj.length >= 2 && obj[0] &&
                  typeof obj[0] === 'object' &&
                  ('id' in obj[0] || 'title' in obj[0] || 'name' in obj[0])) {
                for (let i = obj.length-1; i > 0; i--) {
                  const j = Math.floor(Math.random()*(i+1));
                  [obj[i],obj[j]] = [obj[j],obj[i]]
                }
              }
              if (obj && typeof obj === 'object' && !Array.isArray(obj))
                Object.values(obj).forEach(shuffleDeep)
            }
            shuffleDeep(data)
            Object.defineProperty(xhr, 'responseText', { value: JSON.stringify(data) })
          } catch {}
        })
        return xhr
      }

      // ── SlowBro 뱃지 ────────────────────────────────────────────────────
      const badge = document.createElement('div')
      badge.id = '_sb_badge'
      badge.style.cssText =
        'position:fixed;top:60px;right:16px;z-index:2147483647;' +
        'background:#e50914;color:#fff;padding:6px 16px;border-radius:20px;' +
        'font-size:13px;font-weight:700;box-shadow:0 2px 16px rgba(0,0,0,.5);' +
        'pointer-events:none;font-family:sans-serif'
      badge.textContent = '👁 찾으라우저 — 알고리즘 OFF'
      document.body.appendChild(badge)

      // ── 페이지 재로드 (사이트가 제공하는 reload 함수 우선, 없으면 refetch) ──
      if (typeof window.__sbReload === 'function') window.__sbReload()

      return 'injected'
    })()
  `).catch(() => false)

  return { ok: !!result }
})

// ─── 알고리즘 무력화 — 원본 디자인 유지 DOM 셔플 ─────────────────────────────
ipcMain.handle('browser:shuffleDom', async () => {
  if (!browserView) return { ok: false, count: 0 }

  const count = await browserView.webContents.executeJavaScript(`
    (function() {

      // 컨테이너의 직접 자식들을 셔플해서 DOM에 재삽입
      function shuffleDirectChildren(parent) {
        const kids = [...parent.children]
        if (kids.length < 2) return 0
        // Fisher-Yates
        for (let i = kids.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [kids[i], kids[j]] = [kids[j], kids[i]]
        }
        kids.forEach(k => parent.appendChild(k))  // appendChild = 기존 위치에서 이동
        return kids.length
      }

      // ── 사이트별 컨테이너 셀렉터 (직접 자식을 셔플할 부모) ──────────────
      const CONTAINERS = {
        'localhost:3001': ['.row'],
        'netflix.com':    ['.lolomo-row .slider-content', '.row-with-x-columns'],
        'tving.com':      ['.swiper-wrapper', '.vod-list', '.card-list', '.list_wrap'],
        'wavve.com':      ['.slide_list', '.list_card ul', '.vod_list'],
        'watcha.com':     ['[class*="GridContent__"]', '[class*="ListContent__"]'],
        'spotify.com':    [
          '[data-testid="grid-container"]',
          '[data-testid="shelf-gridcontainer"]',
          '[data-testid="infinite-scroll-list"]',
          'div[class*="gridContainer"]',
          'div[class*="Grid"] > div[class*="Grid"]',
        ],
        'youtube.com':    [
          'ytd-rich-grid-renderer #contents',
          '#primary ytd-rich-grid-renderer',
          'ytd-section-list-renderer #contents',
        ],
        'melon.com':      ['#pageList tbody', '.list_wrap ul'],
        'bugs.co.kr':     ['.list-wrap tbody', '.list-wrap ul'],
      }

      const host = location.host
      let total = 0

      // 1) 사이트 감지 후 지정 컨테이너 셔플
      for (const [domain, sels] of Object.entries(CONTAINERS)) {
        if (!host.includes(domain)) continue
        sels.forEach(sel => {
          try {
            document.querySelectorAll(sel).forEach(container => {
              total += shuffleDirectChildren(container)
            })
          } catch(e) {}
        })
        break
      }

      // 2) data-testid 기반 범용 폴백 (Spotify 등 modern SPA)
      if (total < 2) {
        const seen = new Set()
        document.querySelectorAll('[data-testid*="grid"], [data-testid*="shelf"], [data-testid*="list"]')
          .forEach(el => {
            if (seen.has(el)) return
            const kids = [...el.children]
            if (kids.length >= 3) {
              total += shuffleDirectChildren(el)
              seen.add(el)
            }
          })
      }

      // 3) YouTube 전용 폴백 — img 체크 없이 ytd 요소 기준
      if (total < 2 && host.includes('youtube.com')) {
        const seen = new Set()
        document.querySelectorAll('ytd-rich-grid-renderer, #contents.ytd-rich-grid-renderer').forEach(el => {
          if (seen.has(el)) return
          const kids = [...el.children].filter(k => k.tagName?.toLowerCase().startsWith('ytd-'))
          if (kids.length >= 3) {
            kids.forEach((k, i) => {
              const j = Math.floor(Math.random() * (i + 1));
              [kids[i], kids[j]] = [kids[j], kids[i]]
            })
            kids.forEach(k => el.appendChild(k))
            total += kids.length
            seen.add(el)
          }
        })
      }

      // 4) 범용 폴백 — 자식 3개 이상 + img 40% 이상 보유 컨테이너
      if (total < 2) {
        const seen = new Set()
        document.querySelectorAll('ul, ol, [class*="row"], [class*="Row"], [class*="grid"], [class*="Grid"], [class*="list"], [class*="List"], [class*="wrap"], [class*="slider"]')
          .forEach(el => {
            if (seen.has(el)) return
            const kids = [...el.children]
            const imgCount = kids.filter(k => k.querySelector('img') || k.querySelector('[style*="background"]')).length
            if (kids.length >= 3 && imgCount >= Math.floor(kids.length * 0.4)) {
              total += shuffleDirectChildren(el)
              seen.add(el)
            }
          })
      }

      // 3) SlowBro 뱃지 표시
      let badge = document.getElementById('_sb_badge')
      if (!badge) {
        badge = document.createElement('div')
        badge.id = '_sb_badge'
        badge.style.cssText =
          'position:fixed;top:60px;right:16px;z-index:2147483647;' +
          'background:#e50914;color:#fff;padding:6px 16px;border-radius:20px;' +
          'font-size:13px;font-weight:700;box-shadow:0 2px 16px rgba(0,0,0,.6);' +
          'pointer-events:none;font-family:sans-serif'
        document.body.appendChild(badge)
      }
      badge.textContent = total > 0 ? '👁 찾으라우저 — 알고리즘 OFF' : '⚠️ 카드를 찾지 못했어요'

      return total
    })()
  `).catch(() => 0)

  return { ok: true, count }
})

// ─── 앱 라이프사이클 ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
  setupAdBlockSession()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
