// Backends the client talks to. To keep real endpoints out of the shipped
// bundle, release builds inject them *obfuscated* — base64 of the reversed URL
// — via VITE_AUTH_BASE_ENC / VITE_FILM_BASE_ENC (CI derives these from the
// repository secrets). A plaintext VITE_*_BASE still works for local dev.
//
// NOTE: obfuscation only defeats trivial static extraction (unzip + grep). The
// endpoint is still observable in the app's live network traffic — that's fine.

function endpoint(enc, plain, fallback) {
  if (plain) return plain
  if (enc) {
    try {
      return atob(enc).split('').reverse().join('')
    } catch (_) { /* malformed — fall through to placeholder */ }
  }
  return fallback
}

export const AUTH_BASE = endpoint(
  import.meta.env.VITE_AUTH_BASE_ENC,
  import.meta.env.VITE_AUTH_BASE,
  'https://auth.example.com',
)
export const FILM_BASE = endpoint(
  import.meta.env.VITE_FILM_BASE_ENC,
  import.meta.env.VITE_FILM_BASE,
  'https://film.example.com',
)

// Data API (search/movie/translations) is exposed to the client via the nginx
// /tv-api prefix -> FastAPI backend directly. HLS uses FILM_BASE/hls directly.
export const FILM_API_BASE = FILM_BASE + '/tv-api'

// Where the JWT is persisted on the TV between launches.
export const TOKEN_KEY = 'filmstream_jwt'
