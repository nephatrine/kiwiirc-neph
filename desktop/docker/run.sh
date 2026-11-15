#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/kiwiirc-builder"
mkdir -p "$cache_dir/node_modules" "$cache_dir/desktop-node_modules"

cd "$repo_root"

HOST_UID="$(id -u)" HOST_GID="$(id -g)" \
    docker compose -f desktop/docker/compose.yaml up --build
