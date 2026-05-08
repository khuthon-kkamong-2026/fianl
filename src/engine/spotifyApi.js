/**
 * Spotify Web API 연동 — Client Credentials Flow
 * 전체 카탈로그에서 랜덤 탐색 (로그인 불필요)
 */

const https = require('https')

// ─── HTTP 헬퍼 ───────────────────────────────────────────────────────────────
function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

// ─── 토큰 발급 (Client Credentials) ─────────────────────────────────────────
async function getToken(clientId, clientSecret) {
  const cred = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const body = 'grant_type=client_credentials'

  const { status, body: res } = await request({
    hostname: 'accounts.spotify.com',
    path:     '/api/token',
    method:   'POST',
    headers: {
      'Authorization':  `Basic ${cred}`,
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body)

  if (!res.access_token) {
    throw new Error(`토큰 발급 실패 (${status}): ${res.error_description ?? JSON.stringify(res)}`)
  }
  return res.access_token
}

// ─── 트랙 검색 ───────────────────────────────────────────────────────────────
async function searchTracks(token, query, offset = 0, limit = 20) {
  const qs = new URLSearchParams({
    q: query, type: 'track', limit, offset, market: 'KR',
  }).toString()

  const { body: res } = await request({
    hostname: 'api.spotify.com',
    path:     `/v1/search?${qs}`,
    method:   'GET',
    headers:  { 'Authorization': `Bearer ${token}` },
  })

  return (res.tracks?.items ?? []).map(t => ({
    id:         t.id,
    title:      t.name,
    artist:     t.artists?.map(a => a.name).join(', ') ?? '',
    album:      t.album?.name ?? '',
    imageUrl:   t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url ?? '',
    previewUrl: t.preview_url ?? null,
    popularity: t.popularity ?? 0,
    type:       'track',
  }))
}

// ─── 신규 앨범 ───────────────────────────────────────────────────────────────
async function getNewReleases(token, limit = 30) {
  const { body: res } = await request({
    hostname: 'api.spotify.com',
    path:     `/v1/browse/new-releases?country=KR&limit=${limit}`,
    method:   'GET',
    headers:  { 'Authorization': `Bearer ${token}` },
  })

  return (res.albums?.items ?? []).map(a => ({
    id:         a.id,
    title:      a.name,
    artist:     a.artists?.map(x => x.name).join(', ') ?? '',
    album:      a.album_type ?? 'album',
    imageUrl:   a.images?.[1]?.url ?? a.images?.[0]?.url ?? '',
    previewUrl: null,
    popularity: 0,
    type:       'album',
  }))
}

// ─── Fisher-Yates 셔플 ───────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── 메인: 전체 카탈로그 랜덤 탐색 ──────────────────────────────────────────
async function discover(clientId, clientSecret) {
  const token = await getToken(clientId, clientSecret)

  // 넓은 범위 탐색을 위한 다양한 쿼리
  const alpha = 'abcdefghijklmnopqrstuvwxyz'
  const korean = ['가', '나', '다', '라', '마', '바', '사', '아']
  const genres  = ['year:2024', 'year:2023', 'genre:kpop', 'genre:pop',
                   'genre:indie', 'genre:hiphop', 'genre:r%26b', 'year:2022']

  const queries = [
    // 알파벳 랜덤 2개 (각각 다른 offset → 전체 DB에서 무작위)
    { q: alpha[Math.floor(Math.random() * 26)], offset: Math.floor(Math.random() * 900) },
    { q: alpha[Math.floor(Math.random() * 26)], offset: Math.floor(Math.random() * 900) },
    // 한국어 랜덤
    { q: korean[Math.floor(Math.random() * korean.length)], offset: Math.floor(Math.random() * 200) },
    // 장르/연도 랜덤
    { q: genres[Math.floor(Math.random() * genres.length)], offset: Math.floor(Math.random() * 300) },
  ]

  // 병렬 요청
  const [newReleases, ...searchResults] = await Promise.all([
    getNewReleases(token, 30),
    ...queries.map(q => searchTracks(token, q.q, q.offset, 20)),
  ])

  // 중복 제거 + 합치기
  const seen = new Set()
  const all  = []

  for (const list of searchResults) {
    for (const item of list) {
      if (!seen.has(item.id)) { seen.add(item.id); all.push(item) }
    }
  }
  for (const item of newReleases) {
    if (!seen.has(item.id)) { seen.add(item.id); all.push(item) }
  }

  return shuffle(all)
}

module.exports = { discover }
