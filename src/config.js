// Backends the TV talks to directly (see docs/TIZEN_TV_APP_MILESTONE.md).
// Overridable at build time via Vite env (VITE_AUTH_BASE / VITE_FILM_BASE).
export const AUTH_BASE = import.meta.env.VITE_AUTH_BASE || 'https://auth.example.com'
export const FILM_BASE = import.meta.env.VITE_FILM_BASE || 'https://film.example.com'

// Where the JWT is persisted on the TV between launches.
export const TOKEN_KEY = 'filmstream_jwt'
