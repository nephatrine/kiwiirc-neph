#!/usr/bin/env bash
set -euo pipefail

cd /workspace

export HOME="${HOME:-/tmp/kiwi-home}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export WINEPREFIX="${WINEPREFIX:-$HOME/.wine}"
export npm_config_cache="${npm_config_cache:-$XDG_CACHE_HOME/npm}"

mkdir -p "$HOME" "$XDG_CACHE_HOME" "$WINEPREFIX" "$npm_config_cache"

rm -rf dist

bash scripts/build-web.sh
bash desktop/scripts/build-artifacts.sh

echo
echo "Build artifacts:"
ls -lh desktop/release/*.AppImage desktop/release/*.exe desktop/release/SHA256SUMS
