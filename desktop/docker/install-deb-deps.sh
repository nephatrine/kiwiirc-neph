#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends \
    binutils \
    ca-certificates \
    curl \
    fakeroot \
    imagemagick \
    librsvg2-bin \
    xz-utils
rm -rf /var/lib/apt/lists/*
