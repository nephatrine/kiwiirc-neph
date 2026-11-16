#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

package_version="$(bash scripts/package-version.sh)"
release_tag="$(git describe --tags --exact-match --match 'v*' HEAD 2>/dev/null || true)"
output_dir="$repo_root/release-packages"

rm -rf "$output_dir"
mkdir -p "$output_dir"

echo "Git package version: $package_version"
if [ -n "$release_tag" ]; then
    echo "Release package version: ${release_tag#v}"
fi

npm ci
npm run build:release
npm ci --prefix desktop
npm run icons --prefix desktop

build_package() {
    local package_name="$1"
    local package_version="$2"
    local deb
    local control_name
    local control_version
    local control_arch
    local target

    echo "Building ${package_name} ${package_version}"
    rm -rf desktop/release
    (
        cd desktop
        npx electron-builder --linux deb \
            --config.deb.packageName="$package_name" \
            --config.extraMetadata.version="$package_version"
    )

    deb="$(find desktop/release -maxdepth 1 -type f -name '*.deb' -print -quit)"
    if [ -z "$deb" ]; then
        echo "No .deb produced for ${package_name} ${package_version}" >&2
        exit 1
    fi

    control_name="$(dpkg-deb -f "$deb" Package)"
    control_version="$(dpkg-deb -f "$deb" Version)"
    control_arch="$(dpkg-deb -f "$deb" Architecture)"
    target="$output_dir/${control_name}_${control_version}_${control_arch}.deb"

    cp "$deb" "$target"
    echo "Built $(basename "$target")"
}

if [ -n "$release_tag" ]; then
    build_package "kiwiirc-desktop" "${release_tag#v}"
fi
build_package "kiwiirc-desktop-git" "$package_version"

echo
echo "Built Debian packages:"
ls -lh "$output_dir"/*.deb
