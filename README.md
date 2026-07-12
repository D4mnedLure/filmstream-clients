# filmstream-clients

TV and mobile clients for [FilmStream](https://film.example.com). One Vite
codebase, three targets:

| Target | Entry | Packaging |
|--------|-------|-----------|
| **Samsung Tizen TV** | `index.html` | signed `.wgt` (Tizen Studio) |
| **Android TV / Sber TV** | `index.html` | `.apk` via Capacitor |
| **Mobile PWA** (iPhone / Android phone) | `mobile.html` | served under `/m/` |

The TV UI targets Chromium ~47 (Samsung M5513), so `@vitejs/plugin-legacy`
emits a SystemJS bundle that runs everywhere. `base: './'` keeps asset URLs
relative — the `.wgt` loads from `file://` on the TV.

## Prerequisites

- **Node.js 20+** (all targets)
- **JDK 21 + Android SDK** — only for building the Android APK
- **Tizen Studio CLI + a signing profile** — only for building the `.wgt`

## Develop

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

- `http://localhost:5173/index.html` — TV UI (use arrow keys / `remote.js` nav)
- `http://localhost:5173/mobile.html` — mobile PWA

## Build the web bundle

```bash
npm run build      # → dist/ (index.html + mobile.html + assets)
```

## Android APK (Capacitor)

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

The debug APK is debug-signed and installs directly on Android / Sber TV
(enable "unknown sources"). For a Play/production build use `assembleRelease`
with your own keystore.

> **CI does this automatically** — see [Releases](#releases) below. You only
> need a local Android build when iterating on native bits.

## Tizen `.wgt`

```bash
npm run wgt        # build + package a signed .wgt into dist/
```

`scripts/build-wgt.sh` runs `vite build`, stages `tizen/config.xml` + icon,
strips the `crossorigin` attribute (breaks `file://` on the TV), then packages
a **signed** `.wgt`. Signing is personal to your machine:

| Env var | Default | Meaning |
|---------|---------|---------|
| `TIZEN_CLI` | `~/tizen-studio/tools/ide/bin/tizen` | path to the Tizen CLI |
| `TIZEN_PROFILE` | `FilmSream-Partner` | signing profile name |

The distributor certificate must whitelist the target TV's DUID. Install with
`tizen install -n dist/*.wgt -t <tv-name>` (TV in Developer Mode).

## Releases

Merging to `main` triggers
[`.github/workflows/release-android.yml`](.github/workflows/release-android.yml):
it builds the Android APK on a GitHub-hosted runner and publishes a **GitHub
Release** tagged `v<version>-b<run_number>` with `filmstream-tv-*.apk`
attached. Pull requests run the same build (without releasing) to validate.

Grab the latest APK from the [Releases page](../../releases).

> **Tizen is not yet in CI** — it needs the signing certs (author + distributor
> `.p12`, tied to the TV's DUID) in GitHub Secrets. Build `.wgt` locally for now.

## Backend contract

These clients talk to the FilmStream backend at `film.example.com` over the
`/tv-api/` (rewrites to backend `/api/`) and `/hls/` prefixes. TV clients can't
set an `Authorization` header, so they pass the JWT as `?token=<JWT>` on every
request. The backend keeps the server side of this contract; the backend +
auth live in the separate `Film-stream` repo.

## Layout

```
src/            app modules (home, search, detail, player, auth, device flow, …)
index.html      TV entry
mobile.html     mobile PWA entry
android/        Capacitor Android project
tizen/          Tizen config.xml + icon
scripts/        build-wgt.sh
vite.config.js  two-entry legacy build
```
