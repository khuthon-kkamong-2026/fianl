const { contextBridge, ipcRenderer } = require('electron')

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

  // TTS (fire-and-forget)
  speak: (text) => ipcRenderer.send('tts:speak', text),

  // 앱 버전
  version: process.env.npm_package_version ?? '0.1.0',
})
