// Phone auth: standard redirect flow against the auth-service (the device
// flow is for TVs — on the phone we ARE the browser).
//   login() → auth.example.com/authorize?redirect_uri=<this page>&state=<hash>
//   …OAuth… → back here with ?code= → POST /token → JWT in localStorage.
import { AUTH_BASE } from '../config.js'
import { setToken } from '../auth.js'

function selfUri() {
  return location.origin + location.pathname
}

export function login() {
  const qs =
    'redirect_uri=' + encodeURIComponent(selfUri()) +
    '&state=' + encodeURIComponent(location.hash || '#/')
  location.href = AUTH_BASE + '/authorize?' + qs
}

// Completes the redirect flow if we landed with ?code=. Returns a promise of
// true when a token was obtained (page URL is cleaned up either way).
export async function completeLogin() {
  const params = new URLSearchParams(location.search)
  const code = params.get('code')
  if (!code) return false
  const state = params.get('state') || '#/'
  let ok = false
  try {
    const res = await fetch(AUTH_BASE + '/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'code=' + encodeURIComponent(code) + '&redirect_uri=' + encodeURIComponent(selfUri()),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.access_token) {
      setToken(data.access_token)
      ok = true
    }
  } catch (_) {}
  // Strip ?code= from the URL (and restore the pre-login screen from state).
  history.replaceState(null, '', location.pathname + (state.charAt(0) === '#' ? state : '#/'))
  return ok
}
