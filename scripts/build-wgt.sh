#!/usr/bin/env bash
# Build the Vite bundle and package it into a signed Tizen .wgt.
#
# Run locally (where Tizen Studio + a signing profile live), from tv-app/:
#   npm run wgt
#
# Env overrides:
#   TIZEN_CLI       path to the tizen CLI   (default: ~/tizen-studio/tools/ide/bin/tizen)
#   TIZEN_PROFILE   signing profile name    (default: FilmSream-Partner)
#
# Signing profile is personal to the machine/developer. Default is the Samsung
# Partner distributor profile (grants partner-level privileges, e.g. future
# DRM); a Public profile works too for non-privileged builds — override with
# TIZEN_PROFILE. Either way the distributor cert must whitelist the TV's DUID.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
TIZEN_CLI="${TIZEN_CLI:-$HOME/tizen-studio/tools/ide/bin/tizen}"
TIZEN_PROFILE="${TIZEN_PROFILE:-FilmSream-Partner}"

echo "==> vite build"
npm --prefix "$ROOT" run build

echo "==> stage Tizen manifest + icon into dist/"
cp "$ROOT/tizen/config.xml" "$DIST/config.xml"
cp "$ROOT/tizen/icon.png" "$DIST/icon.png"

# The app loads from file:// on the TV, where a `crossorigin` script attribute
# triggers a CORS check that file:// fails — the scripts then never execute
# (black screen). Strip it.
echo "==> strip crossorigin from index.html (file:// compat)"
sed -i 's/ crossorigin//g' "$DIST/index.html"

echo "==> package signed .wgt (profile: $TIZEN_PROFILE)"
"$TIZEN_CLI" package -t wgt -s "$TIZEN_PROFILE" -- "$DIST"

echo "==> done: $(ls "$DIST"/*.wgt)"
