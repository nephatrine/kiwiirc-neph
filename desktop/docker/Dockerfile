FROM node:22-trixie-slim

ENV DEBIAN_FRONTEND=noninteractive

COPY desktop/docker/install-deps.sh /usr/local/bin/install-kiwi-deps
RUN bash /usr/local/bin/install-kiwi-deps

ENV CSC_IDENTITY_AUTO_DISCOVERY=false \
    ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    WINEDEBUG=-all \
    WINEDLLOVERRIDES="winemenubuilder.exe=d;mscoree=d;mshtml=d"

WORKDIR /workspace

CMD ["bash", "desktop/docker/build.sh"]
