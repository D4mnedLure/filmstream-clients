import { renderLogin } from './device.js'
import { setToken } from './auth.js'
import { go } from './flows.js'

// Root screen (via reset). Wraps the device-flow login; on approval it saves
// the JWT and switches to home. dispose() stops the poll loop.
export function createLoginScreen() {
  let cancel = null

  function render(app) {
    if (cancel) cancel()
    cancel = renderLogin(app, (token) => {
      setToken(token)
      go.home()
    })
  }

  function dispose() {
    if (cancel) {
      cancel()
      cancel = null
    }
  }

  function key() {
    return false // nothing focusable; BACK is handled by main (exit)
  }

  return { render, key, dispose }
}
