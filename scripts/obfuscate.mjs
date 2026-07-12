// Obfuscate the built JS bundle in place (dist/assets/*.js) for the Android
// APK build. NOT run for the Tizen .wgt or the dev server — the shared
// `vite build` stays plain; this is an Android-only post-processing step
// (see .github/workflows/release-android.yml and the "build:apk" script).
//
// Android WebView is a modern Chromium, so a strong preset is fine. We keep
// selfDefending / debugProtection OFF: they harden little here but are the
// options most likely to break a WebView or freeze debugging.
//
// This raises the bar against static analysis of the APK; it does not hide the
// endpoint from live network traffic (that's inherent to any client).

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import JavaScriptObfuscator from 'javascript-obfuscator'

const ASSETS_DIR = 'dist/assets'

// Only obfuscate our own app chunks. Third-party libraries (hls.js, the legacy
// polyfills) hold no secrets and are open source — obfuscating them just bloats
// the bundle ~8x and slows parsing for zero benefit, so skip them.
const SKIP = /(?:^|[-/])(?:hls|polyfills|vendor)[-.]/

const OPTIONS = {
  compact: true,
  target: 'browser',
  // strings — encrypt everything so no literal (incl. the endpoint) survives
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 1,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersType: 'function',
  splitStrings: true,
  splitStringsChunkLength: 10,
  // identifiers / structure
  identifierNamesGenerator: 'hexadecimal',
  numbersToExpressions: true,
  transformObjectKeys: true,
  simplify: true,
  // control flow — moderate threshold to bound the runtime overhead
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.6,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.3,
  // deliberately OFF (breakage-prone, low value here)
  selfDefending: false,
  debugProtection: false,
  sourceMap: false,
}

const allJs = readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.js'))
if (allJs.length === 0) {
  console.error(`obfuscate: no .js files in ${ASSETS_DIR} — did vite build run?`)
  process.exit(1)
}
const files = allJs.filter((f) => !SKIP.test(f))
for (const f of allJs.filter((f) => SKIP.test(f))) console.log(`skipped (vendor): ${f}`)

let total = 0
for (const f of files) {
  const p = join(ASSETS_DIR, f)
  const src = readFileSync(p, 'utf8')
  const before = statSync(p).size
  const out = JavaScriptObfuscator.obfuscate(src, OPTIONS).getObfuscatedCode()
  writeFileSync(p, out)
  const after = Buffer.byteLength(out)
  total += after
  console.log(`obfuscated ${f}: ${(before / 1024).toFixed(1)}kB -> ${(after / 1024).toFixed(1)}kB`)
}
console.log(`obfuscate: ${files.length} file(s), ${(total / 1024).toFixed(1)}kB total`)
