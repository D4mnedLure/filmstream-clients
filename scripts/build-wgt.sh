#!/usr/bin/env bash
# Build the Vite bundle and package it into a signed Tizen .wgt.
#
# Run locally (where Tizen Studio + a signing profile live), from tv-app/:
#   npm run wgt
#
# Env overrides:
#   TIZEN_CLI       path to the tizen CLI   (default: ~/tizen-studio/tools/ide/bin/tizen)
#   TIZEN_PROFILE   signing profile name    (default: filmstream-tv)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
TIZEN_CLI="${TIZEN_CLI:-$HOME/tizen-studio/tools/ide/bin/tizen}"
TIZEN_PROFILE="${TIZEN_PROFILE:-filmstream-tv}"

echo "==> vite build"
npm --prefix "$ROOT" run build

echo "==> stage Tizen manifest + icon into dist/"
cp "$ROOT/tizen/config.xml" "$DIST/config.xml"
cp "$ROOT/tizen/icon.png" "$DIST/icon.png"

echo "==> package signed .wgt (profile: $TIZEN_PROFILE)"
"$TIZEN_CLI" package -t wgt -s "$TIZEN_PROFILE" -- "$DIST"

echo "==> done: $(ls "$DIST"/*.wgt)"
