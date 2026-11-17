#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

package_owner="${PACKAGE_OWNER:?PACKAGE_OWNER is required}"
packager_user="${PACKAGER_USER:?PACKAGER_USER is required}"
packager_token="${PACKAGER_TOKEN:?PACKAGER_TOKEN is required}"
gitea_url="${GITEA_URL:-https://code.nephatrine.net}"
distribution="${DISTRIBUTION:-trixie}"
component="${COMPONENT:-main}"
arch_repository="${ARCH_REPOSITORY:-core}"
input_dir="${1:-$repo_root/release-packages}"

delete_package() {
    local url="$1"
    local response_file
    local status

    if [ "${DRY_RUN:-0}" = "1" ]; then
        echo "DELETE ${url}"
        return
    fi

    response_file="$(mktemp)"
    status="$(curl \
        --silent \
        --show-error \
        --output "$response_file" \
        --write-out '%{http_code}' \
        --request DELETE \
        --user "${packager_user}:${packager_token}" \
        "$url" || true)"

    case "$status" in
        204|404)
            rm -f "$response_file"
            ;;
        *)
            echo "Failed to delete existing package: HTTP ${status}" >&2
            cat "$response_file" >&2
            rm -f "$response_file"
            exit 1
            ;;
    esac
}

upload_package() {
    local file="$1"
    local url="$2"
    local response_file

    if [ "${DRY_RUN:-0}" = "1" ]; then
        echo "PUT ${url}"
        return
    fi

    response_file="$(mktemp)"
    if ! curl \
        --fail-with-body \
        --silent \
        --show-error \
        --output "$response_file" \
        --user "${packager_user}:${packager_token}" \
        --upload-file "$file" \
        "$url"
    then
        cat "$response_file" >&2
        rm -f "$response_file"
        exit 1
    fi
    rm -f "$response_file"
}

publish_debian() {
    local deb="$1"
    local package_name
    local package_version
    local architecture
    local delete_url
    local upload_url

    package_name="$(dpkg-deb -f "$deb" Package)"
    package_version="$(dpkg-deb -f "$deb" Version)"
    architecture="$(dpkg-deb -f "$deb" Architecture)"

    if [ -z "$package_name" ] || [ -z "$package_version" ] || [ -z "$architecture" ]; then
        echo "Invalid package metadata in $deb" >&2
        exit 1
    fi

    delete_url="${gitea_url}/api/packages/${package_owner}/debian/pool/${distribution}/${component}/${package_name}/${package_version}/${architecture}"
    upload_url="${gitea_url}/api/packages/${package_owner}/debian/pool/${distribution}/${component}/upload"

    echo "Publishing ${package_name} ${package_version} (${architecture})"
    delete_package "$delete_url"
    upload_package "$deb" "$upload_url"
    echo "Published ${package_name} ${package_version} (${architecture})"
}

publish_arch() {
    local pkg="$1"
    local info
    local package_name
    local package_version
    local architecture
    local delete_url
    local upload_url

    info="$(tar -xOf "$pkg" .PKGINFO)"
    package_name="$(printf '%s\n' "$info" | sed -n 's/^pkgname = //p')"
    package_version="$(printf '%s\n' "$info" | sed -n 's/^pkgver = //p')"
    architecture="$(printf '%s\n' "$info" | sed -n 's/^arch = //p')"

    if [ -z "$package_name" ] || [ -z "$package_version" ] || [ -z "$architecture" ]; then
        echo "Invalid package metadata in $pkg" >&2
        exit 1
    fi

    delete_url="${gitea_url}/api/packages/${package_owner}/arch/${arch_repository}/${package_name}/${package_version}/${architecture}"
    upload_url="${gitea_url}/api/packages/${package_owner}/arch/${arch_repository}"

    echo "Publishing ${package_name} ${package_version} (${architecture})"
    delete_package "$delete_url"
    upload_package "$pkg" "$upload_url"
    echo "Published ${package_name} ${package_version} (${architecture})"
}

mapfile -t debs < <(find "$input_dir" -maxdepth 1 -type f -name '*.deb' -print | sort)
mapfile -t arch_packages < <(find "$input_dir" -maxdepth 1 -type f -name '*.pkg.tar.zst' -print | sort)

if [ ${#debs[@]} -eq 0 ] && [ ${#arch_packages[@]} -eq 0 ]; then
    echo "No Linux packages found in $input_dir" >&2
    exit 1
fi

for deb in "${debs[@]}"; do
    publish_debian "$deb"
done

for pkg in "${arch_packages[@]}"; do
    publish_arch "$pkg"
done
