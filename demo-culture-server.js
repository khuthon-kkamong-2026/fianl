/**
 * StreamHub — 문화 콘텐츠 플랫폼 데모 서버 (port 3001)
 *
 * ★ 핵심 구조: 실제 스트리밍 서비스처럼 fetch API로 콘텐츠를 가져옴
 *   - GET /              → 빈 컨테이너 HTML (JS가 fetch로 채움)
 *   - GET /api/reco      → 알고리즘 정렬된 추천 JSON (서버가 views 기준 정렬)
 *   - SlowBro fetch 인터셉터 → /api/reco 응답을 가로채서 셔플 후 반환
 */

const http = require('http')
const PORT = 3001

const CATALOG = [
  { id:1,  title:'킹덤',               genre:'스릴러',       year:2019, views:9800000,  color:'#0d1b3e', hidden:false, desc:'역병이 퍼진 조선. 죽은 왕의 진실을 쫓는 세자의 이야기.' },
  { id:2,  title:'오징어 게임',         genre:'드라마',       year:2021, views:15400000, color:'#0f2d0f', hidden:false, desc:'456명이 목숨을 건 서바이벌 게임에 뛰어든다. 상금은 456억.' },
  { id:3,  title:'이상한 변호사 우영우', genre:'법정드라마',   year:2022, views:12100000, color:'#0a1e30', hidden:false, desc:'자폐 스펙트럼을 지닌 천재 변호사의 유쾌하고 따뜻한 법정 이야기.' },
  { id:4,  title:'사랑의 불시착',        genre:'로맨스',       year:2019, views:11600000, color:'#251425', hidden:false, desc:'패러글라이딩 사고로 북한에 불시착한 재벌 상속녀와 장교의 사랑.' },
  { id:5,  title:'지금 우리 학교는',     genre:'좀비액션',     year:2022, views:8900000,  color:'#2a1100', hidden:false, desc:'좀비 바이러스가 퍼진 학교에서 살아남으려는 학생들의 이야기.' },
  { id:6,  title:'소공녀',     genre:'독립영화',    year:2018, views:42000,  color:'#0a2010', hidden:true,  desc:'집보다 위스키와 담배를 택한 가사도우미 미소의 자유로운 삶.' },
  { id:7,  title:'벌새',       genre:'성장드라마',  year:2019, views:38000,  color:'#1e1e08', hidden:true,  desc:'1994년 서울, 중학생 은희의 조용하고 섬세한 하루하루.' },
  { id:8,  title:'다음 소희',  genre:'사회드라마',  year:2022, views:95000,  color:'#08082a', hidden:true,  desc:'현장실습생 소희의 이야기를 따라가는 형사와 구조적 문제.' },
  { id:9,  title:'윤희에게',   genre:'독립로맨스',  year:2019, views:55000,  color:'#081e1e', hidden:true,  desc:'오래된 편지 한 통이 중년 여성 윤희의 삶을 다시 흔들어놓는다.' },
  { id:10, title:'도희야',     genre:'드라마',      year:2014, views:28000,  color:'#200808', hidden:true,  desc:'섬마을 소녀 도희와 파견 경찰관 영남의 따뜻하고 아픈 인연.' },
  { id:11, title:'한공주',     genre:'드라마',      year:2013, views:31000,  color:'#150815', hidden:true,  desc:'학교 폭력 피해 학생 한공주가 조용히 새 삶을 찾아가는 이야기.' },
  { id:12, title:'지슬',       genre:'역사',        year:2012, views:15000,  color:'#081508', hidden:true,  desc:'제주 4·3의 비극을 감자(지슬)로 이어진 민중의 삶으로 그린 흑백.' },
  { id:13, title:'파수꾼',     genre:'청소년드라마', year:2011, views:22000,  color:'#150820', hidden:true,  desc:'세 고등학생의 우정과 균열, 그리고 돌이킬 수 없는 선택.' },
  { id:14, title:'무산일기',   genre:'독립드라마',  year:2010, views:18000,  color:'#081515', hidden:true,  desc:'탈북자 승철이 서울에서 마주하는 차별과 외로움, 그리고 희망.' },
  { id:15, title:'경주',       genre:'감성드라마',  year:2014, views:25000,  color:'#151500', hidden:true,  desc:'오랜만에 경주를 찾은 남자가 한 여자와 나누는 하루의 이야기.' },
]

function fmtViews(v) {
  if (v >= 10000000) return `${(v/10000000).toFixed(1)}천만`
  if (v >= 1000000)  return `${(v/1000000).toFixed(1)}백만`
  if (v >= 10000)    return `${Math.round(v/10000)}만`
  return v.toLocaleString()
}

// ─── 메인 HTML — 빈 컨테이너 + 클라이언트 fetch ─────────────────────────────
// 실제 Netflix/Tving처럼: JS가 API를 fetch해서 카드를 동적으로 그림
function getMainHTML() {
  const hero = [...CATALOG].sort((a,b) => b.views - a.views)[0]
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>StreamHub</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#141414;color:#fff;font-family:'Malgun Gothic','Noto Sans KR',sans-serif;min-height:100vh}
  ::-webkit-scrollbar{width:6px;height:6px;background:#222}
  ::-webkit-scrollbar-thumb{background:#555;border-radius:3px}

  .nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:14px 40px;
    background:linear-gradient(to bottom,rgba(0,0,0,.85),transparent);
    display:flex;align-items:center;gap:28px}
  .logo{font-size:24px;font-weight:900;color:#e50914;letter-spacing:3px}
  .nav a{color:#ccc;font-size:14px;cursor:pointer}

  .hero{position:relative;height:480px;background:${hero.color};overflow:hidden}
  .hero::after{content:'';position:absolute;inset:0;
    background:linear-gradient(to right,rgba(0,0,0,.75) 40%,transparent 80%),
               linear-gradient(to top,#141414 0%,transparent 35%)}
  .hero-info{position:absolute;bottom:56px;left:48px;z-index:1;max-width:420px}
  .hero-title{font-size:52px;font-weight:900;line-height:1.1;margin-bottom:12px}
  .hero-desc{font-size:14px;color:#ddd;line-height:1.7;margin-bottom:20px}
  .hero-btns{display:flex;gap:12px}
  .btn-play{background:#fff;color:#000;border:none;padding:10px 26px;font-size:16px;font-weight:700;border-radius:4px;cursor:pointer}
  .btn-info{background:rgba(255,255,255,.22);color:#fff;border:none;padding:10px 26px;font-size:16px;border-radius:4px;cursor:pointer}

  .section{padding:8px 40px 28px}
  .section-title{font-size:18px;font-weight:700;margin-bottom:14px;color:#e5e5e5}
  .section-subtitle{font-size:11px;color:#666;margin-left:8px;font-weight:400}

  .row{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;min-height:280px}
  .row::-webkit-scrollbar{height:4px}

  .card{flex:0 0 170px;cursor:pointer;border-radius:4px;overflow:hidden;transition:transform .2s}
  .card:hover{transform:scale(1.05)}
  .card-poster{height:240px;position:relative}
  .card-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 50%)}
  .rank-badge{position:absolute;top:8px;left:8px;background:#e50914;color:#fff;
    font-size:13px;font-weight:900;padding:2px 8px;border-radius:3px;z-index:1}
  .card-info{padding:8px 6px;background:#1a1a1a}
  .card-title{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-meta{font-size:11px;color:#888;margin-top:2px}
  .card-views{font-size:11px;color:#e50914;margin-top:3px}

  /* 로딩 skeleton */
  .skeleton{background:linear-gradient(90deg,#222 25%,#333 50%,#222 75%);
    background-size:200% 100%;animation:shimmer 1.2s infinite;border-radius:4px}
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
</style>
</head>
<body>

<nav class="nav">
  <div class="logo">STREAMHUB</div>
  <a>홈</a><a>시리즈</a><a>영화</a><a>NEW!</a>
</nav>

<div class="hero">
  <div class="hero-info">
    <div class="hero-title">${hero.title}</div>
    <div class="hero-desc">${hero.desc}</div>
    <div class="hero-btns">
      <button class="btn-play">▶ 재생</button>
      <button class="btn-info">ℹ 상세 정보</button>
    </div>
  </div>
</div>

<div style="height:24px"></div>

<div class="section">
  <div class="section-title">
    🔥 오늘의 인기 TOP 5
    <span class="section-subtitle">알고리즘 추천</span>
  </div>
  <div class="row" id="row-top">
    <!-- JS가 /api/reco 를 fetch해서 여기에 카드를 그림 -->
    <div class="skeleton" style="flex:0 0 170px;height:280px"></div>
    <div class="skeleton" style="flex:0 0 170px;height:280px"></div>
    <div class="skeleton" style="flex:0 0 170px;height:280px"></div>
  </div>
</div>

<div class="section">
  <div class="section-title">
    📺 계속 시청하기
    <span class="section-subtitle">알고리즘 추천</span>
  </div>
  <div class="row" id="row-continue">
    <div class="skeleton" style="flex:0 0 170px;height:280px"></div>
    <div class="skeleton" style="flex:0 0 170px;height:280px"></div>
    <div class="skeleton" style="flex:0 0 170px;height:280px"></div>
  </div>
</div>

<div style="height:60px"></div>

<script>
  function fmtViews(v) {
    if (v >= 10000000) return (v/10000000).toFixed(1)+'천만'
    if (v >= 1000000)  return (v/1000000).toFixed(1)+'백만'
    if (v >= 10000)    return Math.round(v/10000)+'만'
    return v.toLocaleString()
  }

  function makeCard(item, rank) {
    return '<div class="card">'
      + '<div class="card-poster" style="background:'+item.color+'">'
      + (rank ? '<div class="rank-badge">'+rank+'</div>' : '')
      + '<div class="card-overlay"></div>'
      + '</div>'
      + '<div class="card-info">'
      + '<div class="card-title">'+item.title+'</div>'
      + '<div class="card-meta">'+item.genre+' · '+item.year+'</div>'
      + '<div class="card-views">▶ '+fmtViews(item.views)+' 시청</div>'
      + '</div></div>'
  }

  // ★ 실제 스트리밍 서비스처럼 API를 fetch해서 콘텐츠 로드
  async function loadContent() {
    const res  = await fetch('/api/reco')   // ← SlowBro가 이 응답을 가로챔
    const data = await res.json()

    document.getElementById('row-top').innerHTML =
      data.top.map((item, i) => makeCard(item, i+1)).join('')

    document.getElementById('row-continue').innerHTML =
      data.continue.map(item => makeCard(item, null)).join('')
  }

  // SlowBro가 인터셉터 주입 후 이 함수를 호출해서 재렌더링
  window.__sbReload = loadContent

  loadContent()
</script>
</body>
</html>`
}

// ─── 서버 ────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // ★ 알고리즘 추천 API — views 내림차순 정렬 (SlowBro가 이걸 가로챔)
  if (req.url === '/api/reco') {
    const sorted = [...CATALOG].sort((a, b) => b.views - a.views)
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({
      top:      sorted.slice(0, 5),   // 인기 TOP 5
      continue: sorted.slice(5, 10),  // 그 다음 인기
    }))
    return
  }

  // 전체 카탈로그 (shuffle)
  if (req.url === '/api/catalog') {
    const arr = [...CATALOG]
    for (let i = arr.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]] = [arr[j],arr[i]]
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, items: arr }))
    return
  }

  // 메인 페이지
  if (req.url === '/' || req.url === '') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(getMainHTML())
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log(`🎬 StreamHub: http://localhost:${PORT}`)
  console.log('   /api/reco  → 알고리즘 정렬 (SlowBro 인터셉션 대상)')
  console.log('   Ctrl+C 로 종료\n')
})
