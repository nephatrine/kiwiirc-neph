#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

if [ ! -f dist/index.html ]; then
    echo "dist/index.html is missing; run npm run build:release first." >&2
    exit 1
fi

export CSC_IDENTITY_AUTO_DISCOVERY="${CSC_IDENTITY_AUTO_DISCOVERY:-false}"
export ELECTRON_SKIP_BINARY_DOWNLOAD="${ELECTRON_SKIP_BINARY_DOWNLOAD:-1}"
export WINEDEBUG="${WINEDEBUG:--all}"
export WINEDLLOVERRIDES="${WINEDLLOVERRIDES:-winemenubuilder.exe=d;mscoree=d;mshtml=d}"
export WINEPREFIX="${WINEPREFIX:-$HOME/.wine}"
export npm_config_cache="${npm_config_cache:-$HOME/.cache/npm}"

mkdir -p "$HOME" "$WINEPREFIX" "$npm_config_cache"

ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --prefix desktop
npm run icons --prefix desktop

if [ ! -f "$WINEPREFIX/.kiwi-initialized" ]; then
    xvfb-run -a wineboot --init
    wineserver -w
    touch "$WINEPREFIX/.kiwi-initialized"
fi

rm -rf desktop/release
xvfb-run -a npm run dist:all --prefix desktop
wineserver -w

cd desktop/release
shopt -s nullglob
artifacts=( *.AppImage *.exe )
if [ ${#artifacts[@]} -eq 0 ]; then
    echo "No desktop artifacts were produced." >&2
    exit 1
fi

for pattern in '*.AppImage' '*-portable.exe'; do
    if ! compgen -G "$pattern" > /dev/null; then
        echo "Missing desktop artifact matching $pattern" >&2
        exit 1
    fi
done

sha256sum "${artifacts[@]}" > SHA256SUMS
