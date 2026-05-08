# SlowBro Netflix Demo

넷플릭스처럼 보이는 모의 OTT 화면에서 `SlowBro` 버튼을 누르면 인기순/랭킹 중심 UI를 제거하고 콘텐츠 배치를 랜덤으로 바꾸는 Electron 데모입니다.

## 실행 방법

```bash
npm install
npm start
```

## 데모 포인트

- 처음 화면은 Netflix Korea 느낌의 모의 화면입니다.
- 주소창에는 `https://www.netflix.com/kr/` 형태가 보입니다.
- `SlowBro OFF` 버튼을 누르면 `SlowBro ON`으로 전환됩니다.
- TOP10, 랭킹, 조회수, 빨간 강조 요소가 사라집니다.
- 콘텐츠 카드가 랜덤 재배열됩니다.
- 카드 제목 대신 한 줄 서사만 보여주는 Blind Discovery 모드가 켜집니다.

## 주의

실제 Netflix 사이트를 조작하는 프로젝트가 아니라, 해커톤 시연용 Mock Netflix 데모입니다. 실제 플랫폼의 로그인, 약관, 보안 이슈를 피하면서 SlowBro 컨셉을 보여주기 위한 구조입니다.
