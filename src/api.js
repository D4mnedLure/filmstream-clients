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
