// Backends the TV talks to directly (see docs/TIZEN_TV_APP_MILESTONE.md).
// Overridable at build time via Vite env (VITE_AUTH_BASE / VITE_FILM_BASE).
export const AUTH_BASE = import.meta.env.VITE_AUTH_BASE || 'https://auth.example.com'
export const FILM_BASE = import.meta.env.VITE_FILM_BASE || 'https://film.example.com'

// Data API (search/movie/translations) is exposed to the TV via nginx /tv-api
// -> FastAPI backend directly (the web /api/* stays behind Next.js). HLS uses
// FILM_BASE/hls directly. See deploy/nginx/film.example.com.conf.
export const FILM_API_BASE = FILM_BASE + '/tv-api'

// Where the JWT is persisted on the TV between launches.
export const TOKEN_KEY = 'filmstream_jwt'
