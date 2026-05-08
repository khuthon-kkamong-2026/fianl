const { contextBridge, ipcRenderer, shell } = require('electron')

// renderer 프로세스에 안전하게 노출되는 API
// window.slowbro.* 로 접근
contextBridge.exposeInMainWorld('slowbro', {

  // 페이지 로드 & 파싱
  loadPage: (url) => ipcRenderer.invoke('page:load', url),

  // 악용 방지
  guard: {
    checkClick:   (payload) => ipcRenderer.invoke('guard:checkClick', payload),
    checkSession: (payload) => ipcRenderer.invoke('guard:checkSession', payload),
  },

  // 창 아이콘 설정 (renderer가 canvas로 이모지 렌더링 후 전달)
  setIcon: (dataUrl) => ipcRenderer.send('window:set-icon', dataUrl),

  // 예매 데이터 전송 (demo-server로 POST)
  submitBooking: (data) => ipcRenderer.invoke('book:submit', data),

  // 외부 브라우저로 URL 열기
  openExternal: (url) => shell.openExternal(url),

  // Spotify 전체 카탈로그 랜덤 탐색
  spotifyDiscover: (clientId, clientSecret) =>
    ipcRenderer.invoke('spotify:discover', { clientId, clientSecret }),

  // Netflix 백그라운드 추출 (로그인된 세션 공유)
  netflixExtract: () => ipcRenderer.invoke('netflix:extract'),

  // 앱 버전
  version: process.env.npm_package_version ?? '0.1.0',

  // 원본 사이트 브라우저 (BrowserView 제어)
  browser: {
    open:      (url, bounds) => ipcRenderer.invoke('browser:open', { url, bounds }),
    close:     ()            => ipcRenderer.invoke('browser:close'),
    navigate:  (url)         => ipcRenderer.invoke('browser:navigate', url),
    back:      ()            => ipcRenderer.invoke('browser:back'),
    forward:   ()            => ipcRenderer.invoke('browser:forward'),
    reload:    ()            => ipcRenderer.invoke('browser:reload'),
    setBounds:        (bounds)     => ipcRenderer.invoke('browser:setBounds', bounds),
    injectHighlight:  (selectors)  => ipcRenderer.invoke('browser:injectHighlight', { selectors }),
    waitLoad:         ()           => ipcRenderer.invoke('browser:waitLoad'),
    shuffleDom:       ()           => ipcRenderer.invoke('browser:shuffleDom'),
    interceptFetch:   ()           => ipcRenderer.invoke('browser:interceptFetch'),
    extractContent:   ()           => ipcRenderer.invoke('browser:extractContent'),

    // 이벤트 구독 (URL 변경, 로딩 등)
    onUrlChanged:   (cb) => ipcRenderer.on('browser:url-changed',  (_, v) => cb(v)),
    onTitleChanged: (cb) => ipcRenderer.on('browser:title-changed', (_, v) => cb(v)),
    onLoading:      (cb) => ipcRenderer.on('browser:loading',       (_, v) => cb(v)),
  },
})
