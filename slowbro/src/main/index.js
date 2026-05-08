const { app, BrowserWindow, ipcMain, session } = require('electron')
const path = require('path')
const { parsePageForSeniors } = require('../engine/pageParser')
const { checkClickSpeed, checkSessionLimit } = require('../guard/antiAbuse')

const isDev = process.argv.includes('--dev')

// ─── 메인 윈도우 (SlowBro UI) ───────────────────────────────────────────────
let mainWindow

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'SlowBro',
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

// TTS 재생 요청 — Web Speech API를 renderer에서 직접 쓰므로 여기선 로그만
ipcMain.on('tts:speak', (event, text) => {
  console.log('[TTS]', text)
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
