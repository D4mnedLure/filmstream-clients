import './style.css'
import { initRemote, exitApp } from './remote.js'
import { currentUser } from './auth.js'
import { key as routeKey, pop } from './router.js'
import { go } from './flows.js'

initRemote((name) => {
  if (name === 'BACK') {
    // Give the current screen a chance first (e.g. close an open overlay),
    // then pop the stack; at the root there's nothing to pop → exit.
    if (routeKey('BACK')) return true
    if (!pop()) exitApp()
    return true
  }
  return routeKey(name)
})

if (currentUser()) go.home()
else go.login()
