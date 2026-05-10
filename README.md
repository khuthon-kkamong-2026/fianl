# 👁 찾으라우저

> 알고리즘이 숨긴 콘텐츠를 꺼내, 내가 직접 발견하는 브라우저

---

## 소개

플랫폼 알고리즘은 인기 있는 콘텐츠만 반복해서 보여줍니다.  
**찾으라우저**는 알고리즘의 순서를 무력화하고, 숨겨진 콘텐츠를 랜덤으로 꺼내주는 데스크톱 브라우저입니다.

---

## 시연 플랫폼

대중문화의 구조적 문제가 가장 잘 드러나는 세 플랫폼을 바탕으로 시연합니다.

| 플랫폼 | 동작 |
|---|---|
| 🎧 Spotify | 알고리즘 추천 없이 전체 카탈로그에서 랜덤 탐색 |
| ▶️ YouTube | 홈 피드 알고리즘 순서를 랜덤으로 섞어 표시 |
| 🎬 Netflix | 플랫폼이 밀어주는 순서 없이 랜덤 콘텐츠 탐색 |

---

## 주요 기능

- **찾아보자** 버튼 클릭 → 알고리즘과 무관하게 랜덤 콘텐츠 카드 표시
- **✕** 마음에 들지 않으면 넘기기
- **♥** 마음에 들면 해당 콘텐츠로 바로 이동
- **🔀 다시 섞기** 순서를 다시 랜덤으로 변경

---

## 기술 스택

| 기술 | 역할 |
|---|---|
| **Electron** | 데스크톱 앱 구성, BrowserView로 실제 사이트 임베드 |
| **Cheerio** | 사이트 HTML 파싱 및 콘텐츠 추출 |
| **JavaScript** | DOM 직접 조작으로 알고리즘 순서 무력화 |

### 핵심 구현

- **Spotify Web API** — Client Credentials Flow로 로그인 없이 전체 카탈로그 랜덤 탐색
- **fetch / XHR 인터셉션** — 사이트 네트워크 응답을 가로채 JSON 배열을 Fisher-Yates 셔플 후 재반환
- **DOM 스크래핑** — Melon, Bugs, Genie, YouTube, Spotify 등 사이트별 CSS 셀렉터로 콘텐츠 추출

---

## 프로젝트 구조

```
├── src/
│   ├── main/index.js        # Electron 메인 프로세스 (IPC, BrowserView)
│   ├── preload/index.js     # contextBridge API 노출
│   ├── engine/
│   │   ├── pageParser.js    # Cheerio 기반 HTML 파서
│   │   └── spotifyApi.js    # Spotify Web API 연동
│   └── guard/antiAbuse.js   # 악용 방지
│
└── renderer/
    ├── index.html           # 메인 UI
    ├── styles/main.css
    └── pages/app.js         # 틴더 카드 UI, 알고리즘 무력화 로직
```

---

## 실행 방법

```bash
npm install
npm start
```

---

## 만든 이유

추천 알고리즘은 편리하지만, 우리가 보는 것을 점점 좁게 만듭니다.  
찾으라우저는 그 경계 밖의 콘텐츠를 발견하는 경험을 돌려줍니다.
