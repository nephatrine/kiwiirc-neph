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
input_dir="${1:-$repo_root/release-packages}"

mapfile -t debs < <(find "$input_dir" -maxdepth 1 -type f -name '*.deb' -print | sort)
if [ ${#debs[@]} -eq 0 ]; then
    echo "No .deb files found in $input_dir" >&2
    exit 1
fi

publish_one() {
    local deb="$1"
    local package_name
    local package_version
    local architecture
    local delete_url
    local upload_url
    local status

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

    if [ "${DRY_RUN:-0}" = "1" ]; then
        echo "DELETE ${delete_url}"
        echo "PUT ${upload_url}"
        return
    fi

    status="$(curl \
        --silent \
        --show-error \
        --output /dev/null \
        --write-out '%{http_code}' \
        --request DELETE \
        --user "${packager_user}:${packager_token}" \
        "$delete_url" || true)"

    case "$status" in
        204|404)
            ;;
        *)
            echo "Failed to delete existing package: HTTP ${status}" >&2
            exit 1
            ;;
    esac

    curl \
        --fail-with-body \
        --silent \
        --show-error \
        --user "${packager_user}:${packager_token}" \
        --upload-file "$deb" \
        "$upload_url"

    echo "Published ${package_name} ${package_version} (${architecture})"
}

for deb in "${debs[@]}"; do
    publish_one "$deb"
done
