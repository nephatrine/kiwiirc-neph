#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

dpkg --add-architecture i386
apt-get update
apt-get install -y --no-install-recommends \
    binutils \
    ca-certificates \
    fakeroot \
    git \
    imagemagick \
    librsvg2-bin \
    wine \
    wine32 \
    wine64 \
    xauth \
    xvfb \
    xz-utils \
    zip
rm -rf /var/lib/apt/lists/*
