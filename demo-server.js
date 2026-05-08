/**
 * SlowBro 데모 서버
 * node demo-server.js 로 실행
 *
 * GET  /            → 복잡한 원본 티켓 사이트 (발표용 "Before")
 * GET  /login       → 로그인 페이지
 * POST /login       → 로그인 처리 (데모: 아무 계정이나 가능)
 * POST /api/book    → 예매 데이터 저장
 * GET  /bookings    → 예매 내역 페이지 (일반 크롬에서 확인)
 * GET  /api/bookings → 예매 JSON
 */

const http = require('http')
const fs   = require('fs')
const path = require('path')

const PORT           = 3000
const BOOKINGS_FILE  = path.join(__dirname, 'demo-bookings.json')

// ── 저장소 초기화 ──────────────────────────────────────────────────
if (!fs.existsSync(BOOKINGS_FILE)) {
  fs.writeFileSync(BOOKINGS_FILE, '[]', 'utf-8')
}

function getBookings() {
  try { return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf-8')) }
  catch { return [] }
}

function saveBooking(booking) {
  const list = getBookings()
  list.unshift(booking)          // 최신 순
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(list, null, 2), 'utf-8')
}

function makeId() {
  return 'SB-' + Date.now().toString(36).toUpperCase()
}

// ── 쿠키 파싱 헬퍼 ───────────────────────────────────────────────
function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
      .filter(p => p.length === 2)
  )
}

// ── 로그인 페이지 HTML ────────────────────────────────────────────
function getLoginHTML(error = '') {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>로그인 — LOTTE GIANTS</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Malgun Gothic',sans-serif;background:#f0f0f0;min-height:100vh;display:flex;flex-direction:column}
  .site-header{background:#003087;padding:0 24px;height:56px;display:flex;align-items:center;gap:16px}
  .site-logo{font-size:20px;font-weight:900;color:#fff;letter-spacing:-1px}
  .site-logo span{color:#c0392b}
  .main-nav{background:#c0392b;padding:0 24px}
  .main-nav a{display:inline-block;padding:10px 14px;color:#fff;text-decoration:none;font-size:13px;font-weight:600}
  .login-wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:40px}
  .login-card{background:#fff;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.1);width:100%;max-width:420px;overflow:hidden}
  .card-header{background:#003087;color:#fff;padding:24px 32px}
  .card-header h1{font-size:22px;font-weight:900}
  .card-header p{font-size:13px;opacity:.75;margin-top:4px}
  .card-body{padding:32px}
  .field{margin-bottom:18px}
  .field label{display:block;font-size:12px;font-weight:700;color:#444;margin-bottom:6px}
  .field input{width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:4px;font-size:14px;transition:border .15s}
  .field input:focus{outline:none;border-color:#003087}
  .demo-note{background:#fff9e6;border:1px solid #f0d060;border-radius:4px;padding:10px 14px;font-size:11px;color:#7a5800;margin-bottom:18px}
  .error-msg{background:#fff0f0;border:1px solid #f0b0b0;border-radius:4px;padding:10px 14px;font-size:12px;color:#c0392b;margin-bottom:14px}
  .btn-login{width:100%;padding:13px;background:#c0392b;color:#fff;border:none;font-size:15px;font-weight:700;cursor:pointer;border-radius:4px}
  .btn-login:hover{background:#a02020}
  .links{display:flex;justify-content:space-between;margin-top:14px;font-size:11px}
  .links a{color:#003087;text-decoration:none}
  .footer{background:#1a1a2e;color:#666;text-align:center;padding:16px;font-size:11px}
</style>
</head>
<body>
<div class="site-header">
  <a href="/" style="text-decoration:none">
    <div class="site-logo">LOTTE<span>GIANTS</span></div>
  </a>
</div>
<div class="main-nav">
  <a href="/">홈</a>
  <a href="/">티켓예매</a>
  <a href="/bookings">예매내역</a>
</div>
<div class="login-wrap">
  <div class="login-card">
    <div class="card-header">
      <h1>🔐 회원 로그인</h1>
      <p>예매를 위해 로그인이 필요해요</p>
    </div>
    <div class="card-body">
      <div class="demo-note">
        💡 <strong>데모 안내:</strong> 아무 아이디/비밀번호나 입력해도 로그인돼요
      </div>
      ${error ? `<div class="error-msg">⚠️ ${escHtml(error)}</div>` : ''}
      <form method="POST" action="/login">
        <div class="field">
          <label>아이디 (이메일)</label>
          <input type="text" name="username" placeholder="예) hong@example.com" required autofocus>
        </div>
        <div class="field">
          <label>비밀번호</label>
          <input type="password" name="password" placeholder="비밀번호 입력" required>
        </div>
        <button type="submit" class="btn-login">로그인</button>
      </form>
      <div class="links">
        <a href="#">아이디 찾기</a>
        <a href="#">비밀번호 찾기</a>
        <a href="#">회원가입</a>
      </div>
    </div>
  </div>
</div>
<div class="footer">COPYRIGHT © LOTTE GIANTS. ALL RIGHTS RESERVED.</div>
</body>
</html>`
}

// ── 원본 사이트 HTML ──────────────────────────────────────────────
function getOriginalSiteHTML(user = '') {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>롯데자이언츠 티켓 예매 - LOTTE GIANTS</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Malgun Gothic',sans-serif;font-size:13px;background:#f0f0f0;color:#222}

  /* 팝업 */
  #popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center}
  .popup-box{background:#fff;width:480px;border-radius:4px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.4)}
  .popup-header{background:#c0392b;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:15px}
  .popup-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1}
  .popup-body{padding:20px}
  .popup-body img,.popup-banner{width:100%;height:160px;background:linear-gradient(135deg,#c0392b,#003087);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;letter-spacing:2px}
  .popup-notice{font-size:11px;color:#888;padding:12px 0 4px;border-top:1px solid #eee;margin-top:12px}
  .popup-footer{display:flex;justify-content:space-between;padding:12px 20px;background:#f5f5f5;border-top:1px solid #ddd}
  .popup-footer button{font-size:11px;color:#666;background:none;border:none;cursor:pointer;text-decoration:underline}

  /* 헤더 */
  .site-header{background:#003087;color:#fff}
  .header-top{background:#001a5c;padding:6px 24px;font-size:11px;display:flex;justify-content:flex-end;gap:16px}
  .header-top a{color:#aac4ff;text-decoration:none}
  .header-main{padding:0 24px;display:flex;align-items:center;gap:24px;height:64px}
  .site-logo{font-size:22px;font-weight:900;color:#fff;letter-spacing:-1px;flex-shrink:0}
  .site-logo span{color:#c0392b}
  .header-search{flex:1;max-width:300px}
  .header-search input{width:100%;padding:7px 12px;border:none;border-radius:2px;font-size:12px}
  .header-actions{display:flex;gap:8px;margin-left:auto}
  .header-actions a,.header-actions button{padding:6px 14px;font-size:11px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;border-radius:2px;text-decoration:none;display:inline-block}
  .header-actions .btn-login{background:#c0392b;border-color:#c0392b}
  .user-badge{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600}

  /* 네비 */
  .main-nav{background:#c0392b}
  .main-nav ul{display:flex;list-style:none;padding:0 24px;margin:0}
  .main-nav li a{display:block;padding:11px 16px;color:#fff;text-decoration:none;font-size:13px;font-weight:600;white-space:nowrap}
  .main-nav li a:hover{background:rgba(0,0,0,.2)}
  .main-nav li.active a{background:rgba(0,0,0,.25);border-bottom:3px solid #fff}
  .sub-nav{background:#1a3e7a;padding:6px 24px;display:flex;gap:0}
  .sub-nav a{color:#ccd9f0;font-size:11px;text-decoration:none;padding:4px 12px;border-right:1px solid rgba(255,255,255,.15)}
  .sub-nav a:hover{color:#fff}

  /* 배너 */
  .event-banner{background:linear-gradient(90deg,#003087,#c0392b);color:#fff;padding:10px 24px;font-size:12px;display:flex;align-items:center;gap:12px;overflow:hidden}
  .banner-badge{background:#fff;color:#c0392b;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap}
  .banner-scroll{flex:1;overflow:hidden;white-space:nowrap}

  /* 본문 */
  .main-layout{display:flex;padding:16px 24px;gap:16px;max-width:1200px;margin:0 auto}
  .content-area{flex:1;min-width:0}
  .sidebar{width:220px;flex-shrink:0}

  /* 탭 */
  .tab-bar{display:flex;border-bottom:2px solid #c0392b;margin-bottom:0}
  .tab-bar button{padding:9px 18px;border:none;background:#fff;font-size:12px;cursor:pointer;color:#666;border-top:1px solid #ddd;border-left:1px solid #ddd;border-right:1px solid #ddd;border-bottom:none;margin-bottom:-2px}
  .tab-bar button.active{background:#c0392b;color:#fff;font-weight:700;border-color:#c0392b}
  .tab-content{background:#fff;border:1px solid #ddd;border-top:none;padding:16px}

  /* 공지 */
  .notice-bar{background:#fff9e6;border:1px solid #f0c040;padding:8px 14px;font-size:11px;margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .notice-badge{background:#f0c040;color:#7a5800;font-size:10px;font-weight:700;padding:1px 6px;border-radius:2px}

  /* 경기 일정 섹션 */
  .section-title{font-size:14px;font-weight:700;color:#003087;padding:12px 0 8px;border-bottom:2px solid #003087;margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .section-title::before{content:'';display:inline-block;width:4px;height:16px;background:#c0392b;border-radius:2px}

  .filter-row{display:flex;gap:8px;margin-bottom:12px;padding:10px;background:#f8f9fc;border:1px solid #e8eaf0;border-radius:3px}
  .filter-row select,.filter-row input{padding:5px 8px;font-size:11px;border:1px solid #ccc;border-radius:2px}
  .filter-row button{padding:5px 14px;background:#003087;color:#fff;border:none;font-size:11px;cursor:pointer;border-radius:2px}

  .game-schedule-list{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}

  /* 파싱 대상 요소 - SlowBro가 읽는 핵심 데이터 */
  .game-date-item{border:1px solid #dde3f0;border-radius:3px;padding:0;cursor:pointer;transition:all .15s;display:flex;align-items:stretch}
  .game-date-item:hover{border-color:#003087;box-shadow:0 1px 6px rgba(0,48,135,.15)}
  .game-date-item .date-col{background:#003087;color:#fff;padding:8px 12px;font-size:11px;font-weight:700;white-space:nowrap;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:68px}
  .game-date-item .game-date{font-size:15px;font-weight:900;line-height:1}
  .game-date-item .day-badge{font-size:10px;opacity:.8;margin-top:2px}
  .game-date-item .game-info{padding:8px 14px;flex:1;display:flex;align-items:center;gap:12px}
  .game-date-item .game-match{font-size:13px;font-weight:700;color:#1a1a1a}
  .game-date-item .game-venue{font-size:11px;color:#888}
  .game-date-item .game-status{margin-left:auto;font-size:11px;font-weight:700}
  .game-date-item .game-status.sale{color:#00a651}
  .game-date-item .game-status.few{color:#e07000}
  .game-date-item input[type=radio]{margin-right:8px;accent-color:#c0392b}

  .pagination{display:flex;justify-content:center;gap:4px;padding:12px 0}
  .pagination button{width:28px;height:28px;border:1px solid #ccc;background:#fff;font-size:11px;cursor:pointer}
  .pagination button.active{background:#003087;color:#fff;border-color:#003087}

  /* 좌석 등급 */
  .seat-section{margin-top:16px}
  .seat-map-container{display:flex;gap:16px;margin-bottom:12px}
  .seat-diagram{flex:1;height:160px;background:linear-gradient(180deg,#1a3e7a 0%,#1a3e7a 30%,#2d6a2d 100%);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;position:relative;overflow:hidden}
  .seat-diagram::after{content:'사직야구장';position:absolute;bottom:8px;right:12px;font-size:10px;opacity:.6}
  .field-oval{width:80px;height:50px;background:rgba(255,255,255,.15);border-radius:50%;position:absolute;bottom:30px}

  .grade-list{display:grid;grid-template-columns:1fr 1fr;gap:8px}

  /* 파싱 대상 - 좌석 등급 */
  .seat-grade-item{border:1px solid #dde3f0;border-radius:3px;padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:10px}
  .seat-grade-item:hover{border-color:#c0392b;background:#fff5f5}
  .grade-color-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
  .grade-badge{font-size:13px;font-weight:700;color:#1a1a1a;flex:1}
  .grade-price{font-size:13px;color:#c0392b;font-weight:700;white-space:nowrap}
  .grade-avail{font-size:10px;color:#888;margin-left:4px}
  .seat-grade-item input[type=radio]{accent-color:#c0392b}

  /* 이용약관 */
  .terms-box{background:#f5f5f5;border:1px solid #ddd;padding:12px;font-size:10px;color:#666;height:90px;overflow-y:scroll;margin-top:12px;line-height:1.8}
  .terms-agree{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px}

  /* 예매 버튼 */
  .booking-action{margin-top:16px;padding:12px;background:#f8f9fc;border:1px solid #e0e4f0;border-radius:3px}
  .count-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:12px}
  .count-row select{padding:4px 8px;font-size:12px;border:1px solid #ccc}
  .price-row{font-size:12px;color:#888;margin-bottom:10px}
  .price-row strong{color:#c0392b;font-size:16px}
  .btn-purchase{width:100%;padding:13px;background:#c0392b;color:#fff;border:none;font-size:15px;font-weight:700;cursor:pointer;border-radius:3px}
  .btn-purchase:hover{background:#a02020}

  /* 사이드바 */
  .sidebar-box{background:#fff;border:1px solid #ddd;margin-bottom:12px}
  .sidebar-box .box-title{background:#003087;color:#fff;padding:8px 12px;font-size:12px;font-weight:700}
  .sidebar-box .box-body{padding:10px}
  .ad-block{background:linear-gradient(135deg,#f0f4ff,#e0e8ff);height:120px;display:flex;align-items:center;justify-content:center;color:#3355aa;font-size:11px;border:1px dashed #aac;margin-bottom:8px;border-radius:2px}
  .sidebar-link-list{list-style:none}
  .sidebar-link-list li{padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:11px}
  .sidebar-link-list li a{color:#444;text-decoration:none}
  .sidebar-link-list li a:hover{color:#c0392b}
  .sidebar-link-list li::before{content:'›';color:#c0392b;margin-right:4px}
  .point-banner{background:linear-gradient(135deg,#c0392b,#8b0000);color:#fff;padding:12px;font-size:11px;border-radius:2px;margin-bottom:8px;text-align:center}

  /* 푸터 */
  .site-footer{background:#1a1a2e;color:#999;padding:24px;margin-top:16px;font-size:11px}
  .footer-nav{display:flex;flex-wrap:wrap;gap:4px 0;border-bottom:1px solid #333;padding-bottom:12px;margin-bottom:12px}
  .footer-nav a{color:#aaa;text-decoration:none;padding:0 12px;border-right:1px solid #444}
  .footer-info{line-height:2}
</style>
</head>
<body data-sb-needs-login="${user ? 'false' : 'true'}" data-sb-login-url="/login">

<!-- ===== 팝업 (페이지 로드 시 표시) ===== -->
<div id="popup-overlay">
  <div class="popup-box">
    <div class="popup-header">
      🎉 5월 특별 이벤트 안내
      <button class="popup-close" onclick="document.getElementById('popup-overlay').style.display='none'">✕</button>
    </div>
    <div class="popup-body">
      <div class="popup-banner">⚾ 2026 시즌 홈 개막전 ⚾</div>
      <p style="margin-top:12px;font-size:12px;line-height:1.7;color:#444">
        5월 24일(토) 롯데 vs LG 홈 개막전 특별 이벤트!<br>
        선착순 500명에게 <strong style="color:#c0392b">유니폼 증정</strong>.<br>
        포인트 3배 적립 이벤트 진행 중. 지금 바로 예매하세요!
      </p>
      <div class="popup-notice">
        ※ 해당 이벤트는 로그인 후 예매 시에만 적용됩니다.<br>
        ※ 이벤트 기간: 2026.05.01 ~ 2026.05.31<br>
        ※ 1인 최대 4매 한도 / 취소 불가
      </div>
    </div>
    <div class="popup-footer">
      <button onclick="document.getElementById('popup-overlay').style.display='none'">오늘 하루 보지 않기</button>
      <button onclick="document.getElementById('popup-overlay').style.display='none'" style="color:#003087;font-weight:700">닫기</button>
    </div>
  </div>
</div>

<!-- ===== 헤더 ===== -->
<div class="site-header">
  <div class="header-top">
    ${user ? `<span style="color:#aac4ff">👤 ${escHtml(user)}님</span>` : '<a href="/login">로그인</a>'}
    ${user ? '<a href="/logout">로그아웃</a>' : '<a href="#">회원가입</a>'}
    <a href="/bookings">마이페이지</a>
    <a href="#">고객센터</a>
    <a href="#">사이트맵</a>
  </div>
  <div class="header-main">
    <div class="site-logo">LOTTE<span>GIANTS</span></div>
    <div class="header-search">
      <input type="text" placeholder="경기 일정, 선수, 이벤트 검색...">
    </div>
    <div class="header-actions">
      <button>장바구니 (0)</button>
      <a href="/bookings">예매내역</a>
      ${user
        ? `<span class="user-badge">👤 ${escHtml(user)}</span>`
        : '<a href="/login" class="btn-login">로그인</a>'
      }
    </div>
  </div>
</div>

<!-- ===== 메인 네비 ===== -->
<nav class="main-nav">
  <ul>
    <li><a href="#">팀소개</a></li>
    <li><a href="#">선수단</a></li>
    <li class="active"><a href="#">티켓예매</a></li>
    <li><a href="#">경기일정</a></li>
    <li><a href="#">야구장안내</a></li>
    <li><a href="#">GIANTS샵</a></li>
    <li><a href="#">미디어</a></li>
    <li><a href="#">커뮤니티</a></li>
    <li><a href="#">프로야구</a></li>
  </ul>
</nav>
<div class="sub-nav">
  <a href="#">홈경기 예매</a>
  <a href="#">단체 예매</a>
  <a href="#">시즌권 안내</a>
  <a href="#">VIP 라운지</a>
  <a href="#">장애인 예매</a>
  <a href="#">예매 취소/환불</a>
  <a href="#">예매 유의사항</a>
</div>

<!-- 이벤트 배너 -->
<div class="event-banner">
  <span class="banner-badge">NOTICE</span>
  <span class="banner-scroll">
    ⚡ [긴급] 5/24(토) 홈 개막전 잔여 좌석 매우 적음 — 빠른 예매 권장 &nbsp;&nbsp;&nbsp;
    🎁 포인트 3배 이벤트 진행 중 &nbsp;&nbsp;&nbsp;
    ⚠️ 예매 후 취소 시 수수료 발생 안내 확인 바람 &nbsp;&nbsp;&nbsp;
    📱 모바일 예매 전용 앱 출시 — 앱스토어에서 다운로드
  </span>
</div>

<!-- ===== 본문 ===== -->
<div class="main-layout">
  <div class="content-area">

    <!-- 공지 -->
    <div class="notice-bar">
      <span class="notice-badge">공지</span>
      ⚠ 5/24 개막전 예매 폭주로 서버 접속이 지연될 수 있습니다. 잠시 후 재시도해 주세요. 예매는 회원 로그인 후 가능합니다.
    </div>

    <!-- 탭 -->
    <div class="tab-bar">
      <button class="active">홈경기 예매</button>
      <button>좌석 안내</button>
      <button>할인 안내</button>
      <button>단체 예매</button>
      <button>시즌권</button>
      <a href="/bookings" style="padding:9px 18px;border:1px solid #ddd;border-bottom:none;background:#fff;font-size:12px;color:#c0392b;font-weight:700;text-decoration:none;margin-bottom:-2px;display:inline-block">예매 내역 ↗</a>
      <button>FAQ</button>
    </div>

    <div class="tab-content">

      <!-- 경기 일정 -->
      <div class="section-title">경기 일정 선택</div>

      <div class="filter-row">
        <select><option>2026년</option></select>
        <select><option>05월</option><option>06월</option><option>07월</option></select>
        <select><option>전체 홈경기</option><option>주말</option><option>평일</option></select>
        <select><option>전체 좌석</option><option>1루 지정석</option><option>외야</option></select>
        <input type="text" placeholder="날짜 직접 입력 (YYYYMMDD)" style="flex:1">
        <button>조회</button>
      </div>

      <!-- ★ SlowBro가 파싱하는 핵심 요소 ★ -->
      <div class="game-schedule-list" id="game-list">

        <div class="game-date-item">
          <div class="date-col">
            <div class="game-date">5월 24일</div>
            <div class="day-badge">토요일</div>
          </div>
          <div class="game-info">
            <input type="radio" name="game" value="20260524">
            <span class="game-match">롯데자이언츠 vs LG트윈스 | 사직야구장 14:00</span>
            <span class="game-venue">부산 사직야구장</span>
            <span class="game-status sale">예매가능</span>
          </div>
        </div>

        <div class="game-date-item">
          <div class="date-col">
            <div class="game-date">5월 25일</div>
            <div class="day-badge">일요일</div>
          </div>
          <div class="game-info">
            <input type="radio" name="game" value="20260525">
            <span class="game-match">롯데자이언츠 vs 키움히어로즈 | 사직야구장 17:00</span>
            <span class="game-venue">부산 사직야구장</span>
            <span class="game-status sale">예매가능</span>
          </div>
        </div>

        <div class="game-date-item">
          <div class="date-col">
            <div class="game-date">5월 28일</div>
            <div class="day-badge">수요일</div>
          </div>
          <div class="game-info">
            <input type="radio" name="game" value="20260528">
            <span class="game-match">롯데자이언츠 vs 두산베어스 | 사직야구장 18:30</span>
            <span class="game-venue">부산 사직야구장</span>
            <span class="game-status few">잔여적음</span>
          </div>
        </div>

        <div class="game-date-item">
          <div class="date-col">
            <div class="game-date">5월 31일</div>
            <div class="day-badge">토요일</div>
          </div>
          <div class="game-info">
            <input type="radio" name="game" value="20260531">
            <span class="game-match">롯데자이언츠 vs KIA타이거즈 | 사직야구장 14:00</span>
            <span class="game-venue">부산 사직야구장</span>
            <span class="game-status sale">예매가능</span>
          </div>
        </div>

        <div class="game-date-item">
          <div class="date-col">
            <div class="game-date">6월 7일</div>
            <div class="day-badge">일요일</div>
          </div>
          <div class="game-info">
            <input type="radio" name="game" value="20260607">
            <span class="game-match">롯데자이언츠 vs NC다이노스 | 사직야구장 17:00</span>
            <span class="game-venue">부산 사직야구장</span>
            <span class="game-status sale">예매가능</span>
          </div>
        </div>

      </div>

      <div class="pagination">
        <button class="active">1</button>
        <button>2</button><button>3</button><button>4</button><button>5</button>
        <button>다음 ›</button>
      </div>

      <!-- 좌석 등급 -->
      <div class="seat-section">
        <div class="section-title">좌석 등급 및 가격</div>

        <div class="seat-map-container">
          <div class="seat-diagram">
            <div class="field-oval"></div>
            🏟️ 사직야구장 좌석 배치도<br>
            <small style="opacity:.6;margin-top:4px">(클릭하여 구역 선택)</small>
          </div>
        </div>

        <!-- ★ SlowBro가 파싱하는 좌석 등급 요소 ★ -->
        <div class="grade-list">

          <div class="seat-grade-item">
            <input type="radio" name="grade">
            <span class="grade-color-dot" style="background:#8B0000"></span>
            <span class="grade-badge">테이블석</span>
            <span class="grade-price">55,000원</span>
            <span class="grade-avail">잔여 12</span>
          </div>

          <div class="seat-grade-item">
            <input type="radio" name="grade">
            <span class="grade-color-dot" style="background:#003087"></span>
            <span class="grade-badge">1루 지정석</span>
            <span class="grade-price">35,000원</span>
            <span class="grade-avail">잔여 88</span>
          </div>

          <div class="seat-grade-item">
            <input type="radio" name="grade">
            <span class="grade-color-dot" style="background:#1a5c1a"></span>
            <span class="grade-badge">3루 지정석</span>
            <span class="grade-price">35,000원</span>
            <span class="grade-avail">잔여 74</span>
          </div>

          <div class="seat-grade-item">
            <input type="radio" name="grade">
            <span class="grade-color-dot" style="background:#e07000"></span>
            <span class="grade-badge">외야 응원석</span>
            <span class="grade-price">12,000원</span>
            <span class="grade-avail">잔여 240</span>
          </div>

          <div class="seat-grade-item">
            <input type="radio" name="grade">
            <span class="grade-color-dot" style="background:#555"></span>
            <span class="grade-badge">중앙 프리미엄</span>
            <span class="grade-price">55,000원</span>
            <span class="grade-avail">잔여 6</span>
          </div>

          <div class="seat-grade-item">
            <input type="radio" name="grade">
            <span class="grade-color-dot" style="background:#7a3fa0"></span>
            <span class="grade-badge">스카이박스</span>
            <span class="grade-price">120,000원</span>
            <span class="grade-avail">잔여 2</span>
          </div>

        </div>
      </div>

      <!-- 예매 액션 -->
      <div class="booking-action">
        <div class="count-row">
          <label>매수 선택:</label>
          <select>
            <option>1매</option><option selected>2매</option>
            <option>3매</option><option>4매</option>
          </select>
          <label style="margin-left:12px">할인 종류:</label>
          <select>
            <option>일반</option><option>경로(65세↑)</option>
            <option>장애인</option><option>국가유공자</option>
          </select>
          <label style="margin-left:12px">회원 등급:</label>
          <select><option>일반</option><option>VIP</option><option>VVIP</option></select>
        </div>
        <div class="price-row">
          선택 금액: <strong id="total-price">35,000</strong>원 × 2매 =
          <strong style="font-size:18px;color:#003087" id="total-all">70,000원</strong>
          &nbsp; (부가세 포함)
        </div>

        <div class="terms-box">
          [예매 유의사항]<br>
          1. 본 예매는 롯데자이언츠 공식 홈페이지를 통한 예매이며, 예매 완료 후 취소 시 예매 수수료(매당 500원)가 부과됩니다.<br>
          2. 경기 취소/우천 시 전액 환불되며, 환불 기간은 경기일로부터 7일 이내입니다.<br>
          3. 현장 입장 시 예매 확인증 또는 모바일 티켓을 지참해야 합니다.<br>
          4. 대리 예매 후 양도 행위는 금지되어 있으며, 적발 시 예매가 취소될 수 있습니다.<br>
          5. 미성년자의 경우 보호자 동반이 원칙입니다.<br>
          6. 예매 완료 후 좌석 변경은 불가합니다.<br>
          7. 예매 시 작성한 개인정보는 「개인정보 보호법」에 따라 처리됩니다.<br>
          8. 문의: 롯데자이언츠 고객센터 1566-XXXX (평일 09:00~18:00)
        </div>
        <div class="terms-agree">
          <input type="checkbox" id="chk-terms">
          <label for="chk-terms">위 예매 유의사항을 모두 확인하였으며 동의합니다. (필수)</label>
        </div>

        <button class="btn-purchase" style="margin-top:12px">예매하기</button>
      </div>

    </div><!-- tab-content end -->
  </div><!-- content-area end -->

  <!-- 사이드바 -->
  <div class="sidebar">
    <div class="sidebar-box">
      <div class="box-title">🔔 빠른 예매</div>
      <div class="box-body">
        <div class="ad-block">★ 광고 영역 ★<br><small>300×120</small></div>
        <div style="font-size:11px;color:#888;text-align:center">광고주 모집 중</div>
      </div>
    </div>
    <div class="point-banner">
      🎁 지금 예매하면<br>
      <strong style="font-size:16px">포인트 3배!</strong><br>
      <small>~5/31 한정</small>
    </div>
    <div class="sidebar-box">
      <div class="box-title">📌 공지사항</div>
      <div class="box-body">
        <ul class="sidebar-link-list">
          <li><a href="#">5월 홈경기 운영 안내</a></li>
          <li><a href="#">예매 시스템 점검 공지</a></li>
          <li><a href="#">우천 취소 환불 안내</a></li>
          <li><a href="#">주차 이용 안내 변경</a></li>
          <li><a href="#">외야 응원석 입장 방법</a></li>
        </ul>
      </div>
    </div>
    <div class="sidebar-box">
      <div class="box-title">⚾ 최근 경기 결과</div>
      <div class="box-body" style="font-size:11px;line-height:2.2;color:#555">
        5/7 롯데 5 : 3 삼성 ✅<br>
        5/6 롯데 2 : 7 삼성 ❌<br>
        5/5 롯데 4 : 4 KT 🟡<br>
        5/4 롯데 6 : 1 KT ✅
      </div>
    </div>
    <div class="sidebar-box">
      <div class="box-title">🛒 GIANTS SHOP</div>
      <div class="box-body">
        <div class="ad-block" style="height:80px;font-size:11px">유니폼 10% 할인<br>쿠폰 코드: GIANTS2026</div>
      </div>
    </div>
  </div>
</div>

<!-- 푸터 -->
<div class="site-footer">
  <div class="footer-nav">
    <a href="#">회사소개</a><a href="#">이용약관</a><a href="#">개인정보처리방침</a>
    <a href="#">청소년보호정책</a><a href="#">이메일무단수집거부</a>
    <a href="#">고객센터</a><a href="#">사이트맵</a>
  </div>
  <div class="footer-info">
    (주)롯데자이언츠 · 대표이사 OOO · 사업자등록번호 XXX-XX-XXXXX<br>
    부산광역시 동래구 사직동 야구로 10 · 고객센터 1566-XXXX (평일 09~18시)<br>
    COPYRIGHT © LOTTE GIANTS. ALL RIGHTS RESERVED.
  </div>
</div>

</body>
</html>`
}

// ── 예매 내역 HTML ────────────────────────────────────────────────
function getBookingsHTML() {
  const list = getBookings()

  const rows = list.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:#aaa;font-size:15px">
         아직 예매 내역이 없어요.<br>
         <small style="font-size:12px;margin-top:6px;display:block">SlowBro로 예매를 완료하면 여기에 나타나요.</small>
       </td></tr>`
    : list.map((b, i) => `
        <tr style="animation:fadeIn .4s ${i * 0.08}s both">
          <td class="id-cell">${escHtml(b.id)}</td>
          <td style="font-weight:600;color:#003087">👤 ${escHtml(b.user ?? 'SlowBro 사용자')}</td>
          <td>${escHtml(b.date ?? '-')}</td>
          <td>${escHtml(b.grade ?? '-')}</td>
          <td style="text-align:center">${escHtml(String(b.count ?? '-'))}매</td>
          <td style="text-align:center"><span class="badge-done">예매완료</span></td>
          <td class="time-cell">${new Date(b.bookedAt).toLocaleString('ko-KR')}</td>
        </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>예매 내역 확인 — LOTTE GIANTS</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Malgun Gothic',sans-serif;background:#f4f5f7;color:#1a1a1a;min-height:100vh}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

  .page-header{background:linear-gradient(135deg,#003087,#c0392b);color:#fff;padding:32px 40px 28px;position:relative;overflow:hidden}
  .page-header::before{content:'⚾';position:absolute;right:40px;top:50%;transform:translateY(-50%);font-size:80px;opacity:.15}
  .logo{font-size:13px;font-weight:700;opacity:.7;letter-spacing:2px;margin-bottom:8px}
  .page-title{font-size:28px;font-weight:900;letter-spacing:-1px}
  .page-sub{font-size:14px;opacity:.75;margin-top:6px}

  .container{max-width:900px;margin:0 auto;padding:32px 24px}

  .stats-row{display:flex;gap:16px;margin-bottom:28px}
  .stat-card{background:#fff;border-radius:12px;padding:20px 24px;flex:1;border:1px solid #e8eaf0;box-shadow:0 2px 8px rgba(0,0,0,.04)}
  .stat-label{font-size:12px;color:#888;margin-bottom:4px}
  .stat-value{font-size:28px;font-weight:900;color:#003087}
  .stat-value.red{color:#c0392b}

  .card{background:#fff;border-radius:12px;border:1px solid #e8eaf0;box-shadow:0 2px 12px rgba(0,0,0,.06);overflow:hidden}
  .card-header{background:#003087;color:#fff;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
  .card-header h2{font-size:16px;font-weight:700}
  .card-header .refresh{font-size:12px;opacity:.7;cursor:pointer;background:rgba(255,255,255,.15);border:none;color:#fff;padding:4px 10px;border-radius:4px}

  table{width:100%;border-collapse:collapse}
  th{background:#f0f4ff;color:#003087;font-size:12px;font-weight:700;padding:12px 16px;text-align:left;border-bottom:2px solid #dde3f0}
  td{padding:14px 16px;border-bottom:1px solid #f0f2f8;font-size:13px;vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#fafbff}
  .id-cell{font-family:monospace;font-size:12px;font-weight:700;color:#003087}
  .time-cell{font-size:11px;color:#888}
  .badge-done{display:inline-block;background:#e8f5e9;color:#1b7c3a;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;border:1px solid #a5d6b5}

  .footer-note{text-align:center;margin-top:24px;font-size:12px;color:#aaa}
  .footer-note a{color:#003087}

  .empty-state{padding:60px;text-align:center;color:#bbb}
  .empty-state .icon{font-size:48px;margin-bottom:12px}
</style>
</head>
<body>

<div class="page-header">
  <div class="logo">LOTTE GIANTS — TICKET SYSTEM</div>
  <div class="page-title">예매 내역 확인</div>
  <div class="page-sub">SlowBro를 통해 완료된 예매 내역을 확인할 수 있어요.</div>
</div>

<div class="container">

  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-label">총 예매 건수</div>
      <div class="stat-value">${list.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">최근 예매</div>
      <div class="stat-value" style="font-size:14px;padding-top:6px">
        ${list.length > 0 ? escHtml(list[0].date ?? '-') : '—'}
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">예매 번호 (최신)</div>
      <div class="stat-value" style="font-size:14px;padding-top:6px;font-family:monospace">
        ${list.length > 0 ? escHtml(list[0].id) : '—'}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h2>🎫 예매 목록</h2>
      <button class="refresh" onclick="location.reload()">↻ 새로고침</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>예매번호</th>
          <th>예매자</th>
          <th>경기 날짜</th>
          <th>좌석 등급</th>
          <th style="text-align:center">인원</th>
          <th style="text-align:center">상태</th>
          <th>예매 시각</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="footer-note" style="margin-top:16px">
    🐢 <strong>SlowBro</strong>로 예매한 내역이에요 &nbsp;·&nbsp;
    <a href="http://localhost:3000">← 원본 사이트로 돌아가기</a>
  </div>

</div>
</body>
</html>`
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;')
}

// ── 서버 ─────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }

  // 쿠키에서 로그인 유저 읽기
  const cookies = parseCookies(req.headers.cookie || '')
  const loggedUser = cookies['sb_user'] || ''

  // GET / → 원본 복잡한 사이트
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(getOriginalSiteHTML(loggedUser))
    return
  }

  // GET /login → 로그인 페이지
  if (req.method === 'GET' && url.pathname === '/login') {
    if (loggedUser) { res.writeHead(302, { Location: '/' }); res.end(); return }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(getLoginHTML())
    return
  }

  // POST /login → 로그인 처리
  if (req.method === 'POST' && url.pathname === '/login') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      const params = new URLSearchParams(body)
      const username = (params.get('username') || '').trim()
      if (!username) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(getLoginHTML('아이디를 입력해주세요.'))
        return
      }
      const displayName = username.includes('@') ? username.split('@')[0] : username
      console.log(`🔐 로그인: ${displayName}`)
      res.writeHead(302, {
        'Set-Cookie': `sb_user=${encodeURIComponent(displayName)}; Path=/; HttpOnly`,
        'Location': '/',
      })
      res.end()
    })
    return
  }

  // GET /logout
  if (req.method === 'GET' && url.pathname === '/logout') {
    res.writeHead(302, {
      'Set-Cookie': 'sb_user=; Path=/; Max-Age=0',
      'Location': '/',
    })
    res.end()
    return
  }

  // GET /bookings → 예매 내역 (일반 브라우저에서 확인)
  if (req.method === 'GET' && url.pathname === '/bookings') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(getBookingsHTML())
    return
  }

  // GET /api/bookings → JSON
  if (req.method === 'GET' && url.pathname === '/api/bookings') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(getBookings()))
    return
  }

  // POST /api/book → 예매 저장
  if (req.method === 'POST' && url.pathname === '/api/book') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const booking = {
          id:       makeId(),
          user:     loggedUser || 'SlowBro 사용자',
          date:     data.date  ?? '-',
          grade:    data.grade ?? '-',
          count:    data.count ?? '2',
          bookedAt: new Date().toISOString(),
          status:   '예매완료',
        }
        saveBooking(booking)
        console.log(`✅ 예매 저장: ${booking.id} | ${booking.user} | ${booking.date} | ${booking.grade} × ${booking.count}명`)
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: true, bookingId: booking.id }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: e.message }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log('')
  console.log('  🐢 SlowBro 데모 서버 실행 중')
  console.log(`  📺 원본 사이트:   http://localhost:${PORT}`)
  console.log(`  📋 예매 내역:     http://localhost:${PORT}/bookings`)
  console.log(`  📡 예매 API:      POST http://localhost:${PORT}/api/book`)
  console.log('')
})
