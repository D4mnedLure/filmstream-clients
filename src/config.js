// Backends the client talks to. Set these at build time via Vite env
// (VITE_AUTH_BASE / VITE_FILM_BASE) — see .env.example. The placeholders below
// are only so the app builds/runs without a configured backend; real
// deployments inject the values (CI reads them from repository secrets).
export const AUTH_BASE = import.meta.env.VITE_AUTH_BASE || 'https://auth.example.com'
export const FILM_BASE = import.meta.env.VITE_FILM_BASE || 'https://film.example.com'

// Data API (search/movie/translations) is exposed to the client via the nginx
// /tv-api prefix -> FastAPI backend directly. HLS uses FILM_BASE/hls directly.
export const FILM_API_BASE = FILM_BASE + '/tv-api'

// Where the JWT is persisted on the TV between launches.
export const TOKEN_KEY = 'filmstream_jwt'
