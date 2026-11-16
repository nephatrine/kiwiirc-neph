#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
    echo "Full git history is required to calculate the package version." >&2
    exit 1
fi

last_tag="$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)"
if [ -n "$last_tag" ]; then
    base_version="${last_tag#v}"
    commit_count="$(git rev-list --count "${last_tag}..HEAD")"
else
    base_version="$(node -p "require('./package.json').version")"
    commit_count="$(git rev-list --count HEAD)"
fi

short_sha="$(git rev-parse --short=8 HEAD)"
version="${base_version}+${commit_count}.g${short_sha}"

if ! [[ "$version" =~ ^[0-9][A-Za-z0-9.+~:-]*$ ]]; then
    echo "Invalid Debian package version: $version" >&2
    exit 1
fi

printf '%s\n' "$version"
