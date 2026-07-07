// Remote-control handling for Tizen TV. No mouse/touch — only D-pad + OK/Back.

export const KEYS = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  BACK: 10009, // Tizen Return/Back
  EXIT: 10182,
  MEDIA_PLAY_PAUSE: 10252,
  MEDIA_PLAY: 415,
  MEDIA_PAUSE: 19,
  MEDIA_STOP: 413,
  MEDIA_FF: 417,
  MEDIA_RW: 412,
}

const CODE_TO_NAME = Object.keys(KEYS).reduce((acc, name) => {
  acc[KEYS[name]] = name
  return acc
}, {})
// Non-Tizen aliases: Escape → BACK (desktop browser / some Android remotes),
// 179 → play/pause (Android TV WebView media key).
CODE_TO_NAME[27] = 'BACK'
CODE_TO_NAME[179] = 'MEDIA_PLAY_PAUSE'

// Extra keys the platform only delivers after explicit registration.
const REGISTER = [
  'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
  'MediaFastForward', 'MediaRewind',
]

export function exitApp() {
  try {
    // eslint-disable-next-line no-undef
    tizen.application.getCurrentApplication().exit()
    return
  } catch (_) {}
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      import('@capacitor/app').then((m) => m.App.exitApp()).catch(() => {})
      return
    }
  } catch (_) {}
  // Desktop browser (dev) — best effort.
  window.close()
}

// Register a handler that receives semantic key names ("UP", "ENTER", …).
// Returning true from the handler marks the key handled; BACK otherwise exits.
export function initRemote(handler) {
  try {
    // eslint-disable-next-line no-undef
    if (typeof tizen !== 'undefined' && tizen.tvinputdevice) {
      REGISTER.forEach((k) => {
        try {
          // eslint-disable-next-line no-undef
          tizen.tvinputdevice.registerKey(k)
        } catch (_) {}
      })
    }
  } catch (_) {}

  // Android (Capacitor): the hardware Back key never reaches the DOM — it fires
  // the App plugin's backButton event instead. Dynamic import so the Tizen
  // build never evaluates @capacitor code (its plugin proxies need ES2015+).
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      import('@capacitor/app')
        .then((m) => {
          m.App.addListener('backButton', () => {
            if (handler) handler('BACK', null)
          })
        })
        .catch(() => {})
    }
  } catch (_) {}

  document.addEventListener('keydown', (e) => {
    const name = CODE_TO_NAME[e.keyCode]
    if (!name) return
    // Kill the platform's own D-pad handling: Android TV WebViews run native
    // spatial navigation with their own geometry and click the *natively*
    // focused element on OK — which may differ from our visual focus ring
    // (seen on Sber: OK activated the key one row above the ring).
    if (e.preventDefault) e.preventDefault()
    const handled = handler ? handler(name, e) : false
    if (name === 'BACK' && !handled) {
      exitApp()
    }
  })
}
