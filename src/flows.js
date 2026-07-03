// Central navigation to avoid screen-to-screen import cycles. Screens import
// `go` and only call it inside handlers, so the cycle with router/screens is
// resolved by the time it's used.
import { push, reset } from './router.js'
import { createHomeScreen } from './home.js'
import { createLoginScreen } from './login.js'
import { createSearchScreen } from './search.js'
import { createDetailScreen } from './detail.js'
import { createPlayerScreen } from './player.js'
import { createAccountScreen } from './account.js'
import { createLibraryScreen } from './library.js'
import { createHistoryScreen } from './history.js'
import { createSettingsScreen } from './settings.js'

export const go = {
  home: () => reset(createHomeScreen()),
  login: () => reset(createLoginScreen()),
  search: () => push(createSearchScreen()),
  detail: (kpId) => push(createDetailScreen(kpId)),
  // resume: optional { translation, season, episode, position_sec } to jump in.
  play: (kpId, movie, resume) => push(createPlayerScreen(kpId, movie, resume)),
  account: () => push(createAccountScreen()),
  library: () => push(createLibraryScreen()),
  history: () => push(createHistoryScreen()),
  settings: () => push(createSettingsScreen()),
}
