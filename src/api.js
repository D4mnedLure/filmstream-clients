import { AUTH_BASE, FILM_BASE } from './config.js'

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

// film-stream's backend isn't exposed unauthenticated except via /hls, which
// returns 401 without a token — that 401 still proves the backend is reachable.
export function checkFilm() {
  return probe(FILM_BASE + '/hls/1/master.m3u8')
}
