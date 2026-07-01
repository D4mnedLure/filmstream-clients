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
}

const CODE_TO_NAME = Object.keys(KEYS).reduce((acc, name) => {
  acc[KEYS[name]] = name
  return acc
}, {})

// Extra keys the platform only delivers after explicit registration.
const REGISTER = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop']

export function exitApp() {
  try {
    // eslint-disable-next-line no-undef
    tizen.application.getCurrentApplication().exit()
  } catch (_) {
    // In a desktop browser (dev) there's no tizen namespace — just no-op.
    window.close()
  }
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

  document.addEventListener('keydown', (e) => {
    const name = CODE_TO_NAME[e.keyCode]
    if (!name) return
    const handled = handler ? handler(name, e) : false
    if (name === 'BACK' && !handled) {
      exitApp()
    }
  })
}
