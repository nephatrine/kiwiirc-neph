#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

release_tag="${RELEASE_TAG:-}"
root_version="$(node -p "require('./package.json').version")"
desktop_version="$(node -p "require('./desktop/package.json').version")"

if [ -n "$release_tag" ]; then
    case "$release_tag" in
        v*) ;;
        *)
            echo "Release tag must start with v: $release_tag" >&2
            exit 1
            ;;
    esac
    if ! git rev-parse --verify "refs/tags/$release_tag" >/dev/null 2>&1; then
        echo "Release tag does not exist: $release_tag" >&2
        exit 1
    fi
    version="${release_tag#v}"
else
    version="$root_version"
fi

if [ "$root_version" != "$desktop_version" ]; then
    echo "Root version $root_version does not match desktop version $desktop_version." >&2
    exit 1
fi
if [ "$version" != "$root_version" ]; then
    echo "Release version $version does not match package version $root_version." >&2
    exit 1
fi

rm -rf dist release-assets
rm -f kiwiirc-release.tar.gz kiwiirc-release.zip

npm ci
npm run lint
npm test
npm run build:release
bash scripts/build-web-archives.sh both

bash desktop/scripts/build-artifacts.sh

mkdir -p release-assets
cp kiwiirc-release.tar.gz kiwiirc-release.zip release-assets/

shopt -s nullglob
for file in \
    desktop/release/*.AppImage \
    desktop/release/*.exe
do
    if [ -f "$file" ]; then
        cp "$file" release-assets/
    fi
done

require_file() {
    if [ ! -s "$1" ]; then
        echo "Missing release asset: $1" >&2
        exit 1
    fi
}

require_file release-assets/kiwiirc-release.tar.gz
require_file release-assets/kiwiirc-release.zip

for pattern in '*.AppImage' '*-portable.exe'; do
    if ! compgen -G "release-assets/$pattern" > /dev/null; then
        echo "Missing release asset matching $pattern" >&2
        exit 1
    fi
done

cd release-assets
rm -f SHA256SUMS
sha256sum -- * > SHA256SUMS
