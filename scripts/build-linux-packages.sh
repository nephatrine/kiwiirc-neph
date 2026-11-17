#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

package_set="${PACKAGE_SET:-git}"
case "$package_set" in
    git|stable)
        ;;
    *)
        echo "Invalid PACKAGE_SET: $package_set (expected git or stable)" >&2
        exit 1
        ;;
esac

output_dir="$repo_root/release-packages"
package_build_dir="$repo_root/desktop/release-packages"
release_tag=""
stable_version=""
git_version=""

if [ "$package_set" != "stable" ]; then
    git_version="$(bash scripts/package-version.sh)"
fi

if [ "$package_set" != "git" ]; then
    release_tag="${RELEASE_TAG:-$(git describe --tags --exact-match --match 'v*' HEAD 2>/dev/null || true)}"
    if [ -z "$release_tag" ]; then
        echo "Stable packages require RELEASE_TAG or an exact v* tag." >&2
        exit 1
    fi
    stable_version="${release_tag#v}"
fi

rm -rf "$output_dir"
mkdir -p "$output_dir"

echo "Package set: $package_set"
if [ -n "$git_version" ]; then
    echo "Git package version: $git_version"
fi
if [ -n "$stable_version" ]; then
    echo "Stable package version: $stable_version"
fi

if [ ! -f dist/index.html ]; then
    echo "dist/index.html is missing; build the web app first." >&2
    exit 1
fi
if [ ! -d desktop/node_modules ]; then
    echo "desktop/node_modules is missing; install desktop dependencies first." >&2
    exit 1
fi

build_package() {
    local package_name="$1"
    local package_version="$2"
    local conflict_name="$3"
    local config_file
    local deb
    local pkg
    local control_name
    local control_version
    local control_arch
    local arch_name
    local arch_version
    local arch_arch

    echo "Building ${package_name} ${package_version} (conflicts: ${conflict_name})"
    config_file="$(mktemp)"
    cat > "$config_file" <<EOF
{
    "extends": "$repo_root/desktop/electron-builder.yml",
    "extraMetadata": {
        "version": "$package_version"
    },
    "deb": {
        "packageName": "$package_name",
        "fpm": ["--conflicts=$conflict_name"]
    },
    "pacman": {
        "packageName": "$package_name",
        "fpm": ["--conflicts=$conflict_name"]
    }
}
EOF

    rm -rf "$package_build_dir"
    (
        cd desktop
        npx electron-builder --linux deb pacman \
            --config "$config_file" \
            --config.directories.output="$package_build_dir"
    )
    rm -f "$config_file"

    deb="$(find "$package_build_dir" -maxdepth 1 -type f -name '*.deb' -print -quit)"
    pkg="$(find "$package_build_dir" -maxdepth 1 -type f -name '*.pkg.tar.zst' -print -quit)"
    if [ -z "$deb" ] || [ -z "$pkg" ]; then
        echo "Missing package output for ${package_name} ${package_version}" >&2
        exit 1
    fi

    control_name="$(dpkg-deb -f "$deb" Package)"
    control_version="$(dpkg-deb -f "$deb" Version)"
    control_arch="$(dpkg-deb -f "$deb" Architecture)"
    cp "$deb" "$output_dir/${control_name}_${control_version}_${control_arch}.deb"

    arch_name="$(tar -xOf "$pkg" .PKGINFO | sed -n 's/^pkgname = //p')"
    arch_version="$(tar -xOf "$pkg" .PKGINFO | sed -n 's/^pkgver = //p')"
    arch_arch="$(tar -xOf "$pkg" .PKGINFO | sed -n 's/^arch = //p')"
    cp "$pkg" "$output_dir/${arch_name}-${arch_version}-${arch_arch}.pkg.tar.zst"

    echo "Built ${control_name} ${control_version} (${control_arch})"
    echo "Built ${arch_name} ${arch_version} (${arch_arch})"
}

if [ "$package_set" = "stable" ]; then
    build_package "kiwiirc-desktop" "$stable_version" "kiwiirc-desktop-git"
fi
if [ "$package_set" = "git" ]; then
    build_package "kiwiirc-desktop-git" "$git_version" "kiwiirc-desktop"
fi

echo
echo "Built Linux packages:"
ls -lh "$output_dir"/*.deb "$output_dir"/*.pkg.tar.zst
