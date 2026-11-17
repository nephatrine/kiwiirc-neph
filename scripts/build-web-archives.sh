#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

format="${1:-both}"
case "$format" in
    both|zip|tgz)
        ;;
    *)
        echo "Usage: $0 [both|zip|tgz]" >&2
        exit 1
        ;;
esac

if [ ! -f dist/index.html ]; then
    echo "dist/index.html is missing; run npm run build:release first." >&2
    exit 1
fi

rm -f kiwiirc-release.tar.gz kiwiirc-release.zip

if [ "$format" = "both" ] || [ "$format" = "tgz" ]; then
    tar -C dist --exclude='*.map' -czf "$repo_root/kiwiirc-release.tar.gz" .
    echo "Built kiwiirc-release.tar.gz"
fi

if [ "$format" = "both" ] || [ "$format" = "zip" ]; then
    (
        cd dist
        zip -qr "$repo_root/kiwiirc-release.zip" . -x '*.map'
    )
    echo "Built kiwiirc-release.zip"
fi
