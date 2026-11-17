#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

prefix="${1:-}"
attempts="${NPM_CI_ATTEMPTS:-3}"
retry_delay="${NPM_CI_RETRY_DELAY:-15}"

case "$attempts" in
    ''|*[!0-9]*) attempts=3 ;;
esac
if [ "$attempts" -lt 1 ]; then
    attempts=3
fi

case "$retry_delay" in
    ''|*[!0-9]*) retry_delay=15 ;;
esac

export npm_config_cache="${npm_config_cache:-${HOME:-/tmp}/.cache/npm}"
mkdir -p "$npm_config_cache"

case " ${NODE_OPTIONS:-} " in
    *" --dns-result-order=ipv4first "*) ;;
    *) export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--dns-result-order=ipv4first" ;;
esac

npm_args=(
    ci
    --no-audit
    --no-fund
    --prefer-offline
    --fetch-retries=5
    --fetch-retry-factor=2
    --fetch-retry-mintimeout=20000
    --fetch-retry-maxtimeout=120000
    --fetch-timeout=600000
    --maxsockets=8
)

if [ -n "$prefix" ]; then
    npm_args+=(--prefix "$prefix")
fi

for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    echo "npm ci attempt ${attempt}/${attempts}${prefix:+ for ${prefix}}"
    if npm "${npm_args[@]}"; then
        exit 0
    fi
    if [ "$attempt" -ge "$attempts" ]; then
        echo "npm ci failed after ${attempts} attempts." >&2
        exit 1
    fi
    echo "npm ci failed on attempt ${attempt}/${attempts}; retrying in ${retry_delay}s..." >&2
    sleep "$retry_delay"
    retry_delay=$((retry_delay * 2))
done
