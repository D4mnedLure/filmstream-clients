// In-app update check for the Android APK. On launch we ask GitHub for the
// latest release, parse its `-b<n>` build number, and compare it against this
// build (config.APP_BUILD). If newer, the caller shows the bell; the native
// ApkUpdater plugin downloads the APK and hands it to the system installer.
//
// Android-only: Tizen and the mobile PWA have no APK update path, so the check
// short-circuits there and the bell never appears.

import { Capacitor, registerPlugin } from '@capacitor/core'
import { APP_BUILD, UPDATE_REPO } from './config.js'

const ApkUpdater = registerPlugin('ApkUpdater')

let cached // undefined = not checked, null = up to date / N/A, object = update

function isAndroidApp() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  } catch (_) {
    return false
  }
}

// Returns { tag, build, url } when a newer APK exists, else null. Cached for
// the session so re-entering the home screen doesn't re-hit the API.
export async function checkForUpdate() {
  if (cached !== undefined) return cached
  cached = null
  if (!isAndroidApp()) return null
  try {
    const r = await fetch('https://api.github.com/repos/' + UPDATE_REPO + '/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!r.ok) return null
    const rel = await r.json()
    const m = /-b(\d+)\b/.exec(rel.tag_name || '')
    const latest = m ? parseInt(m[1], 10) : 0
    if (!latest || latest <= APP_BUILD) return null
    const asset = (rel.assets || []).find((a) => /\.apk$/i.test(a.name || ''))
    if (!asset || !asset.browser_download_url) return null
    cached = { tag: rel.tag_name, build: latest, url: asset.browser_download_url }
    return cached
  } catch (_) {
    return null
  }
}

// Download + launch the system installer for the given APK URL. Resolves once
// the installer intent has been fired (the app then goes to the background).
export async function installUpdate(url) {
  return ApkUpdater.installApk({ url })
}
