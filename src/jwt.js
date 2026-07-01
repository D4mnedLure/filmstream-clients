// Client-side JWT inspection only (no verification — the backends verify).

export function decodeJwt(token) {
  try {
    const part = String(token).split('.')[1]
    if (!part) return null
    let b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    // escape/atob trick decodes UTF-8 (names may be Cyrillic) on old engines.
    const json = decodeURIComponent(escape(atob(b64)))
    return JSON.parse(json)
  } catch (_) {
    return null
  }
}

export function isExpired(payload, skewSeconds) {
  if (!payload || !payload.exp) return true
  return (payload.exp - (skewSeconds || 0)) * 1000 <= Date.now()
}
