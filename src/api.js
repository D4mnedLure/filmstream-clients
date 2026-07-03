import { AUTH_BASE, FILM_BASE, FILM_API_BASE } from './config.js'
import { getToken } from './auth.js'

// A reachability probe that survives missing CORS headers. A normal fetch
// against a backend that hasn't whitelisted our origin yet throws (opaque to
// JS), so we fall back to a no-cors request: if that resolves, the host is
// reachable even though we can't read the status. Returns:
//   { ok: bool, status: number|null, cors: bool, error?: string }
async function probe(url) {
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' })
    return { ok: res.ok || res.status === 401, status: res.status, cors: true }
  } catch (_) {
    // Could be CORS or a real network failure — retry opaque to tell them apart.
    try {
      await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
      return { ok: true, status: null, cors: false }
    } catch (e) {
      return { ok: false, status: null, cors: false, error: String(e && e.message || e) }
    }
  }
}

// auth-service exposes an unauthenticated /health.
export function checkAuth() {
  return probe(AUTH_BASE + '/health')
}

// ── Device Authorization Flow ──────────────────────────────────────────────

export async function requestDeviceCode() {
  const res = await fetch(AUTH_BASE + '/device/code', { method: 'POST', cache: 'no-store' })
  if (!res.ok) throw new Error('device/code HTTP ' + res.status)
  return res.json()
}

// Returns { status: 'ok'|'pending'|'expired'|'error', token?, error? }.
export async function pollDeviceToken(deviceCode) {
  const res = await fetch(AUTH_BASE + '/device/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'device_code=' + encodeURIComponent(deviceCode),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (res.ok && data.access_token) return { status: 'ok', token: data.access_token }
  if (data.error === 'authorization_pending') return { status: 'pending' }
  if (data.error === 'expired_token') return { status: 'expired' }
  return { status: 'error', error: data.error || 'HTTP ' + res.status }
}

// film-stream's backend isn't exposed unauthenticated except via /hls, which
// returns 401 without a token — that 401 still proves the backend is reachable.
export function checkFilm() {
  return probe(FILM_BASE + '/hls/1/master.m3u8')
}

// ── Catalog (via nginx /tv-api -> backend, JWT as ?token=) ─────────────────

// Streams search results over SSE. Returns the EventSource so the caller can
// close() it. Auth is via ?token= (EventSource can't set headers).
export function searchStream(query, handlers) {
  const url =
    FILM_API_BASE + '/search/stream/' + encodeURIComponent(query) +
    '?token=' + encodeURIComponent(getToken())
  const es = new EventSource(url)
  function done() {
    es.close()
    if (handlers.onDone) handlers.onDone()
  }
  es.onmessage = (e) => {
    if (!e.data || e.data === 'close') return
    let item
    try {
      item = JSON.parse(e.data)
    } catch (_) {
      return
    }
    if (item && item.error) {
      if (handlers.onError) handlers.onError(item.error)
    } else if (handlers.onItem) {
      handlers.onItem(item)
    }
  }
  es.addEventListener('close', done)
  es.onerror = () => {
    es.close()
    if (handlers.onError) handlers.onError('stream error')
  }
  return es
}

export async function getMovie(kpId) {
  const res = await fetch(
    FILM_API_BASE + '/movie/' + kpId + '?token=' + encodeURIComponent(getToken()),
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error('movie HTTP ' + res.status)
  return res.json()
}

// ── Account / личный кабинет (via /tv-api/me -> backend /api/me) ────────────
// The backend account cabinet (profile, settings, progress, library, history)
// already exists; the TV client just calls it with the JWT as ?token=. All
// helpers append the token to the query since AVPlay/EventSource aside, we keep
// a single auth channel for TV.

function meUrl(path, params) {
  let u = FILM_API_BASE + '/me' + (path || '') + '?token=' + encodeURIComponent(getToken())
  if (params) {
    for (const k in params) {
      if (params[k] != null) u += '&' + k + '=' + encodeURIComponent(params[k])
    }
  }
  return u
}

async function meFetch(path, opts, params) {
  const init = Object.assign({ cache: 'no-store' }, opts || {})
  if (init.body != null && typeof init.body !== 'string') {
    init.headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers)
    init.body = JSON.stringify(init.body)
  }
  const res = await fetch(meUrl(path, params), init)
  if (!res.ok) throw new Error('me' + (path || '') + ' HTTP ' + res.status)
  if (res.status === 204) return null
  return res.json().catch(() => null)
}

export function getProfile() { return meFetch('') }
export function getContinue(limit) { return meFetch('/continue', null, { limit: limit || 20 }) }
export function getProgressFor(kpId) { return meFetch('/progress/' + kpId) }
export function saveProgress(body) { return meFetch('/progress', { method: 'PUT', body }) }
export function deleteProgress(kpId) { return meFetch('/progress/' + kpId, { method: 'DELETE' }) }
export function getLibrary(status, limit) { return meFetch('/library', null, { status, limit: limit || 60 }) }
export function addLibrary(body) { return meFetch('/library', { method: 'POST', body }) }
export function removeLibrary(kpId, status) { return meFetch('/library/' + kpId, { method: 'DELETE' }, { status }) }
export function getLibraryState(kpId) { return meFetch('/library/state/' + kpId) }
export function getHistory(limit) { return meFetch('/history', null, { limit: limit || 50 }) }
export function getSettings() { return meFetch('/settings') }
export function putSettings(body) { return meFetch('/settings', { method: 'PUT', body }) }

// Fire-and-forget progress heartbeat: never throw into the player.
export function sendProgress(body) {
  try { saveProgress(body).catch(() => {}) } catch (_) {}
}

// HLS master URL for AVPlay. JWT rides as ?token= (AVPlay can't set headers);
// the backend propagates it into segments. /hls is proxied straight to the
// backend by nginx, so use FILM_BASE (not FILM_API_BASE).
export function hlsMasterUrl(kpId, translation, season, episode) {
  let u =
    FILM_BASE + '/hls/' + kpId + '/master.m3u8' +
    '?token=' + encodeURIComponent(getToken()) +
    '&translation=' + (translation || 0)
  if (season != null && episode != null) u += '&season=' + season + '&episode=' + episode
  // Old Tizen AVPlay can't decode the source's CMAF/fMP4 audio; ask the backend
  // to remux to MPEG-TS.
  u += '&fmt=ts'
  return u
}
