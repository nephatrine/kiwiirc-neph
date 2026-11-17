#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

install_wine=0
case "$(uname -m)" in
    x86_64|amd64)
        install_wine=1
        ;;
esac

packages=(
    binutils
    ca-certificates
    fakeroot
    git
    xz-utils
    unzip
    zip
    zstd
)

if [ "$install_wine" = "1" ]; then
    dpkg --add-architecture i386
    packages+=(xauth xvfb wine wine32 wine64)
fi

apt-get update
apt-get install -y --no-install-recommends "${packages[@]}"
rm -rf /var/lib/apt/lists/*
