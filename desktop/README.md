# Kiwi IRC Desktop

Optional Electron shell for the Kiwi IRC web application. The web build remains
the primary target.

## Proof of Concept

The current shell loads the existing `dist/` build through a secure `app://`
protocol, uses a sandboxed preload bridge, and sends external links to the
system browser.

## Development

Build the web app first:

```sh
npm run build:release
```

Install desktop dependencies:

```sh
cd desktop
npm install
```

Run the production-style shell:

```sh
npm start
```

Run against the webpack development server on `http://localhost:8080`:

```sh
npm run dev
```

The development server must already be running in the repository root.

If `npm install` is configured to block package install scripts, the Electron
binary may not download automatically. Run:

```sh
node node_modules/electron/install.js
```

## Desktop Configuration

The desktop app starts on the Personal screen with no default network or
gateway. Users add networks themselves.

Deployment-level settings from `config.json` can be overridden in a desktop
configuration file:

```text
Linux:   ~/.config/KiwiIRC/config.json5
Windows: %APPDATA%\KiwiIRC\config.json5
```

Use **File → Open Desktop Configuration Folder** to create the file and open its
folder, and **File → Reload Desktop Configuration** after editing it.

The file is JSON5, so comments are allowed. For example, to use a webirc
gateway:

```json5
{
    "kiwiServer": "https://irc.example.com/webirc/kiwiirc/",
}
```

The overlay accepts any normal config key, including `kiwiServer`,
`presetNetworks`, `serverProtocols`, `startupOptions`, `fileupload`, `plugins`,
`themes`, and `aliases`.

Native desktop HTTP is controlled separately:

```json5
{
    "desktopHttp": {
        // Disabled by default. Enable only for networks you trust.
        "allowPrivateNetworks": false,
        "requestTimeoutMs": 15000,
        "maxResponseBytes": 10485760,
        "maxDownloadBytes": 104857600,
        "maxMediaBytes": 104857600,
        "maxRequestBytes": 104857600,
        "maxRedirects": 5
    }
}
```

Direct image, audio, and video previews use the `kiwi-media://` protocol in
desktop builds. It follows the same private-network policy as native HTTP and
does not proxy iframe embeds.

## Profile Data

Desktop state is stored in one default profile:

```text
Linux:   ~/.config/KiwiIRC/profiles/default/
Windows: %APPDATA%\KiwiIRC\profiles\default/
```

The profile contains `state.json`, `metadata-cache.json`, and their `.bak`
backups. Passwords are kept in `secrets.json`, never in `state.json`.

Personal startup remembers passwords by default. The per-network **Remember
Passwords for This Network** checkbox is available in Server Details only in
Personal startup mode. Password storage uses the OS keyring when available. On
Linux without a usable keyring, Electron's `basic_text` backend is used with a
warning. If encryption is unavailable, new secrets are written to
`secrets.json` as plaintext with a warning. An existing encrypted secrets file
is never downgraded while the keyring is temporarily unavailable.

Existing `app://` localStorage state is migrated into the default profile on
first desktop launch when no profile state exists.

## Icons

The desktop icons are generated from `static/kiwi.svg`:

```sh
npm run icons
```

This writes a multi-resolution `build/icon.ico` for Windows and PNG sizes under
`build/icons/` for Linux. The generated files are committed so packaging does
not need SVG tooling. Regenerating requires `rsvg-convert` and ImageMagick.

## Packaging

Linux:

```sh
npm run dist:linux
```

Windows:

```sh
npm run dist:win
```

Both:

```sh
npm run dist:all
```

Artifacts are written to `desktop/release/`. Windows packaging requires Wine on
Linux.

## Container Build

The local Docker builder produces Linux and Windows artifacts without installing
Node, Wine, or packaging tools on the host. It requires Docker with the Compose
plugin:

```sh
./desktop/docker/run.sh
```

The repository is mounted at `/workspace`; generated files are written back to
`dist/` and `desktop/release/`. The release directory includes a `SHA256SUMS`
file covering the installers. Node modules, Wine, and package-manager caches are
kept in `~/.cache/kiwiirc-desktop-builder`, so the host `node_modules`
directories are not replaced.

The first build initializes Wine and downloads the Electron runtimes for both
platforms, so it takes longer than later builds.
