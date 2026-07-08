// Tiny in-memory cache: detail screen hands the loaded movie payload to the
// player through here (the player refetches on a cold deep-link).
const movies = {}

export function cacheMovie(kpId, data) {
  movies[kpId] = data
}

export function getCachedMovie(kpId) {
  return movies[kpId] || null
}
