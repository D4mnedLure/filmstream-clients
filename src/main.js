import './style.css'
import { initRemote, exitApp } from './remote.js'
import { currentUser } from './auth.js'
import { key as routeKey, pop } from './router.js'
import { go } from './flows.js'

initRemote((name) => {
  if (name === 'BACK') {
    // Pop the screen stack; at the root there's nothing to pop → exit.
    if (!pop()) exitApp()
    return true
  }
  return routeKey(name)
})

if (currentUser()) go.home()
else go.login()
