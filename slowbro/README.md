# 🐢 SlowBro — 디지털 완충 브라우저

> 빠른 디지털 환경과 사람 사이를 연결하는 중간 레이어.
> 느린 게 결함이 아닌, **모두를 위한 속도**로.

---

## 빠른 시작

```bash
cd slowbro
npm install
npm start          # 개발 실행
npm run dev        # DevTools 열어서 실행
```

---

## 프로젝트 구조

```
slowbro/
├── src/
│   ├── main/
│   │   └── index.js          # Electron 메인 프로세스 (창 생성, IPC, 광고 차단)
│   ├── preload/
│   │   └── index.js          # contextBridge API 노출 (window.slowbro)
│   ├── engine/
│   │   └── pageParser.js     # 사이트 파싱 엔진 (Cheerio 기반)
│   └── guard/
│       └── antiAbuse.js      # 악용 방지 (클릭 속도 감지, 세션 제한)
│
├── renderer/
│   ├── index.html            # 메인 UI 진입점
│   ├── styles/
│   │   └── main.css          # 고령층 최적화 스타일
│   └── pages/
│       └── app.js            # 렌더러 앱 로직 (단계별 가이드, TTS)
│
└── mock-sites/
    ├── interpark/index.html  # 야구 티켓 Mock 페이지
    └── korail/index.html     # KTX 예매 Mock 페이지
```

---

## 데모 URL

브라우저 상단 입력창에 입력:

| URL | 설명 |
|-----|------|
| `mock://interpark/baseball` | 야구 티켓 예매 시뮬레이션 |
| `mock://korail/ktx` | KTX 예매 시뮬레이션 |

---

## 핵심 설계 원칙

### 1. 대체가 아닌 번역
기존 인터파크·코레일 서비스를 대체하지 않음.
원본 페이지를 파싱해 **핵심 요소만 추출 → 재구성**하는 중간 레이어.

### 2. 악용 방지
- **클릭 속도 감지**: 250ms 이하 연속 클릭 3회 → 경고 & 차단
- **1인 1회 제한**: 동일 이벤트 중복 시도 차단
- **사람이 직접 제출**: 자동 제출 없음. 모든 스텝을 사람이 거침
- **나이 인증 연동** (실제 배포시): PASS SDK / 정부24 60세+ 확인

### 3. 접근성 우선
- 기본 글씨 18px, 최대 26px까지 단계 조절
- 모든 주요 안내에 TTS (한국어 음성 합성)
- 하단 고정 "뒤로 / 처음으로 / 도움 요청" 버튼
- 한 화면에 선택지 최대 4개, 버튼 최소 크기 52px

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 브라우저 셸 | Electron 28 + Chromium |
| 메인 프로세스 | Node.js (IPC, 세션 관리, 광고 차단) |
| 보안 경계 | contextIsolation + contextBridge |
| 페이지 파싱 | Cheerio (서버 사이드 jQuery) |
| 렌더러 UI | Vanilla JS + CSS (번들러 없음, 빠른 개발) |
| 음성 안내 | Web Speech API (SpeechSynthesisUtterance) |
| 악용 방지 | 자체 구현 (클릭 속도, 세션 맵) |

---

## 다음 단계 (해커톤 이후)

- [ ] PASS SDK 연동 (나이 인증)
- [ ] 실제 인터파크 / 코레일 파싱 룰셋 정교화
- [ ] 가족 연동 모드 (WebRTC 화면 공유, 읽기 전용)
- [ ] 예매 오픈 시간 알림 스케줄러
- [ ] Windows / macOS 설치 파일 빌드
