#!/usr/bin/env bash
set -euo pipefail

for command in wine wineserver wineboot xvfb-run; do
    if ! command -v "$command" >/dev/null 2>&1; then
        exit 1
    fi
done
