// ─── 악용 방지 (Anti-Abuse Guard) ───────────────────────────────────────────
//
// 이 브라우저가 매크로가 되면 안 되는 이유:
//   - 사전 입력을 도와주지만, 제출은 반드시 사람이 직접 해야 함
//   - 클릭 속도가 인간 평균보다 빠르면 자동화로 판단해 차단
//   - 동일 이벤트에 중복 시도를 막아 한 명이 여러 장 독식 방지

// ─── 클릭 속도 감지 ──────────────────────────────────────────────────────────
// 세션별 최근 클릭 타임스탬프를 저장
const clickHistory = new Map()  // sessionId → timestamp[]

const HUMAN_MIN_INTERVAL_MS = 250   // 사람이 연속 클릭할 수 있는 최소 간격
const SUSPICIOUS_BURST_COUNT = 3    // 이 횟수 이상 빠른 클릭이면 경고
const HISTORY_WINDOW_MS = 2000      // 최근 2초 이내 기록만 유지

/**
 * @param {string} sessionId  - 사용자 세션 ID
 * @param {number} timestamp  - 클릭 발생 시각 (Date.now())
 * @returns {boolean}         - true: 정상 / false: 의심스러운 자동화
 */
function checkClickSpeed(sessionId, timestamp) {
  if (!clickHistory.has(sessionId)) {
    clickHistory.set(sessionId, [])
  }

  const history = clickHistory.get(sessionId)

  // 오래된 기록 제거
  const recent = history.filter(t => timestamp - t < HISTORY_WINDOW_MS)
  recent.push(timestamp)
  clickHistory.set(sessionId, recent)

  // 최근 클릭들 간격 계산
  if (recent.length < 2) return true

  let suspiciousCount = 0
  for (let i = 1; i < recent.length; i++) {
    const interval = recent[i] - recent[i - 1]
    if (interval < HUMAN_MIN_INTERVAL_MS) suspiciousCount++
  }

  if (suspiciousCount >= SUSPICIOUS_BURST_COUNT) {
    console.warn(`[Guard] 비정상 클릭 감지 — 세션: ${sessionId}, 간격 위반: ${suspiciousCount}회`)
    // 기록 초기화 (차단 후 쿨다운)
    clickHistory.set(sessionId, [])
    return false
  }

  return true
}

// ─── 세션(예매) 중복 제한 ────────────────────────────────────────────────────
// 동일 사용자가 같은 이벤트에 중복 시도하는 것을 방지
const sessionLimits = new Map()  // `${userId}:${eventId}` → count

const MAX_ATTEMPTS_PER_EVENT = 1   // 이벤트당 1번만 허용

/**
 * @param {string} userId   - 인증된 사용자 ID
 * @param {string} eventId  - 경기/열차 ID
 * @returns {boolean}       - true: 허용 / false: 중복 차단
 */
function checkSessionLimit(userId, eventId) {
  const key = `${userId}:${eventId}`
  const count = sessionLimits.get(key) ?? 0

  if (count >= MAX_ATTEMPTS_PER_EVENT) {
    console.warn(`[Guard] 중복 예매 시도 차단 — 유저: ${userId}, 이벤트: ${eventId}`)
    return false
  }

  sessionLimits.set(key, count + 1)
  return true
}

// 세션 초기화 (예매 완료 후 또는 일정 시간 후 호출)
function resetSessionLimit(userId, eventId) {
  const key = `${userId}:${eventId}`
  sessionLimits.delete(key)
}

// ─── 나이 인증 상태 (실제 구현에선 PASS SDK 연동) ───────────────────────────
const verifiedUsers = new Set()

function markAgeVerified(userId) {
  verifiedUsers.add(userId)
}

function isAgeVerified(userId) {
  // 해커톤 데모: 모두 인증된 것으로 처리
  // 실제: PASS SDK / 정부24 OAuth 연동 후 60세+ 확인
  return true
  // return verifiedUsers.has(userId)
}

module.exports = {
  checkClickSpeed,
  checkSessionLimit,
  resetSessionLimit,
  markAgeVerified,
  isAgeVerified,
}
