#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

build_windows=0
if bash scripts/windows-build-available.sh; then
    build_windows=1
elif [ "${REQUIRE_WINDOWS:-0}" = "1" ]; then
    echo "Windows build tools are required but unavailable." >&2
    exit 1
else
    echo "Wine or Xvfb not found; building the Linux AppImage only." >&2
fi

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

case " ${NODE_OPTIONS:-} " in
    *" --dns-result-order=ipv4first "*) ;;
    *) export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--dns-result-order=ipv4first" ;;
esac

mkdir -p "$HOME" "$npm_config_cache"
if [ "$build_windows" = "1" ]; then
    mkdir -p "$WINEPREFIX"
fi

ELECTRON_SKIP_BINARY_DOWNLOAD=1 bash scripts/npm-ci.sh desktop

if [ "$build_windows" = "1" ] && [ ! -f "$WINEPREFIX/.kiwi-initialized" ]; then
    xvfb-run -a wineboot --init
    wineserver -w
    touch "$WINEPREFIX/.kiwi-initialized"
fi

rm -rf desktop/release
npm run dist:linux --prefix desktop
if [ "$build_windows" = "1" ]; then
    xvfb-run -a npm run dist:win --prefix desktop
    wineserver -w
fi

cd desktop/release
shopt -s nullglob
artifacts=( *.AppImage *.exe )
if [ ${#artifacts[@]} -eq 0 ]; then
    echo "No desktop artifacts were produced." >&2
    exit 1
fi

required_patterns=('*.AppImage')
if [ "$build_windows" = "1" ]; then
    required_patterns+=('*-portable.exe')
fi

for pattern in "${required_patterns[@]}"; do
    if ! compgen -G "$pattern" > /dev/null; then
        echo "Missing desktop artifact matching $pattern" >&2
        exit 1
    fi
done

sha256sum "${artifacts[@]}" > SHA256SUMS
