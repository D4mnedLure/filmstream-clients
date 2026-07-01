import { TOKEN_KEY } from './config.js'
import { decodeJwt, isExpired } from './jwt.js'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch (_) {
    return ''
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch (_) {}
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch (_) {}
}

// Returns the logged-in user ({sub, name, picture}) or null if there's no
// stored token or it's expired (30s skew so we don't act on an about-to-die JWT).
export function currentUser() {
  const token = getToken()
  if (!token) return null
  const payload = decodeJwt(token)
  if (!payload || isExpired(payload, 30)) return null
  return { sub: payload.sub, name: payload.name || payload.sub, picture: payload.picture || '' }
}
