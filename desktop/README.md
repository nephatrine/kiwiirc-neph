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

Desktop defaults `buffers.hide_preview_cards` and `buffers.show_topic_in_header`
to `true`. It also defaults `buffers.scrollback_size` to `500` instead of the
web default of `250`, and enables `allowRegisterProtocolHandler` by default. The
protocol registration action still requires Personal startup and a configured
gateway. Set any of these in `config.json5` to override the desktop defaults.

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
        "maxUploadBytes": 268435456,
        "maxRedirects": 5
    }
}
```

`maxUploadBytes` limits native upload requests separately from normal HTTP
requests. Raise it for WebDAV or other uploads larger than 256 MB.

## Update Checks

Desktop builds check the latest Gitea release and link to its release page. They
do not download or install updates automatically.

- **Settings → General → Updates** shows the current version, a Check for
  Updates button, and the last result.
- **Check Automatically** runs a check shortly after startup and at the
  configured interval, 24 hours by default.
- **Help → Check for Updates…** performs a manual check.
- A newer release adds an **Update Available** tray item and shows one native
  notification per version.

Update checks are configurable in `config.json5`:

```json5
{
    "updates": {
        "apiUrl": "https://code.nephatrine.net/api/v1/repos/nephatrine/kiwiirc/releases/latest",
        "checkIntervalHours": 24,
        "notify": true
    }
}
```

Set `notify` to `false` to keep the tray and settings status without native
notifications. Update notifications are separate from IRC message notifications.
The check only reads public release metadata.

Direct image, audio, and video previews use the `kiwi-media://` protocol in
desktop builds. It follows the same private-network policy as native HTTP and
does not proxy iframe embeds. YouTube and Twitch embeds receive a scoped HTTPS
`Referer` from the Electron session so the players accept the `app://` desktop
origin; Twitch uses `parent=localhost` in desktop builds.

## Installed Themes

Desktop users can install local theme archives from **Settings → General →
Appearance → Installed Themes**.

Choose a `.zip` containing either `theme.css` at the archive root or one
top-level folder containing it:

```text
my-theme.zip
└── my-theme/
    ├── theme.css
    └── theme.json
```

`theme.json` is optional:

```json
{
  "name": "My Theme",
  "mode": "dark",
  "google_fonts": [
    "Inter:wght@400;700"
  ]
}
```

Theme packages are self-contained. If a theme uses Kiwi’s common base styles,
include a copy of `static/themes/common/base.css` in the package and import it
relative to `theme.css`.

Installed themes are copied into the desktop user-data directory and served
through the dedicated `kiwi-theme://` protocol. They are not available in the
web client and are not included in profile exports. Uninstalling the active
theme switches back to the default theme.

The installer rejects path traversal, symlinks, encrypted entries, ZIP64,
unsupported compression, excessive expansion, invalid `theme.json` files, and
archives without a supported `theme.css` layout.

## Installed Emoji Packs

Desktop users can install local emoji pack archives from **Settings → General →
Emoji Packs → Installed Emoji Packs**.

Choose a `.zip` containing either `emoji.json` at the archive root or one
top-level folder containing it:

```text
my-pack.zip
└── my-pack/
    ├── emoji.json
    └── images/
        ├── kiwi.png
        └── party.svg
```

`emoji.json` uses the IRC custom emoji pack document format: a JSON array of
packs with `id`, `name`, optional `description`, `authors`, and `homepage`, and
an `emoji` object mapping shortcodes to image objects. Image `url` values may be
absolute `http`/`https` URLs or paths relative to the installed package:

```json
[
  {
    "id": "my-pack",
    "name": "My Pack",
    "emoji": {
      "kiwi": {
        "url": "images/kiwi.png",
        "alt": "kiwi bird"
      },
      "party": {
        "url": "images/party.svg",
        "alt": "party kiwi"
      }
    }
  }
]
```

Relative images are served through the dedicated `kiwi-emoji://` protocol.
Supported formats are PNG, JPEG, GIF, WebP, AVIF, and SVG. Non-empty `required`
extension lists are rejected because no pack extensions are implemented.

Installed packs are copied into the desktop user-data directory and are not
available in the web client or included in profile exports. All installed packs
are active, and newer packages win when two packages use the same pack ID.

The installer rejects path traversal, symlinks, encrypted entries, ZIP64,
unsupported compression, excessive expansion, invalid `emoji.json` files, unsafe
or missing image paths, unsupported image formats, duplicate pack IDs within one
document, and archives without a supported `emoji.json` layout.

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
warning. If encryption is unavailable, new secrets are written to `secrets.json`
as plaintext with a warning. An existing encrypted secrets file is never
downgraded while the keyring is temporarily unavailable.

Existing `app://` localStorage state is migrated into the default profile on
first desktop launch when no profile state exists.

## Notifications

Desktop builds use native system notifications instead of browser Web Push.
Notifications are shown when the app is unfocused and **Show Notifications** is
enabled. Clicking a notification restores the window and opens the relevant
buffer or message.

The Web Push setting is hidden in desktop builds, and the desktop client does
not negotiate `draft/webpush` or `soju.im/webpush`. Web builds keep the existing
browser notification and Web Push behavior.

## Tray and Close to Tray

Desktop builds show a system tray icon while the app is running. The tray menu
provides Show/Hide, an Update Available item when a newer release is found, a
Close to Tray toggle, and Quit. The unread count and highlight state are
reflected in the tray tooltip and, where the OS supports it, the application
badge.

Close to Tray is enabled by default when the tray is available. Closing the
window then hides it instead of disconnecting IRC sessions. Disable it from
**Settings → General → Close to Tray**, or from the tray menu. If the tray
cannot be created, close-to-tray is disabled for the session and the window
closes normally.

Close to Tray, Launch at Login, Spellcheck, and automatic update-check
preferences are stored in `<userData>/desktop-settings.json` and are not part of
profile export/import.

## Auto-Launch

**Settings → General → Launch at Login** starts Kiwi IRC when the user signs in.
It is available only in packaged builds and defaults off.

Windows and macOS use the Electron login-item API. Linux writes an XDG autostart
entry under `$XDG_CONFIG_HOME/autostart/kiwiirc-desktop.desktop`, using
`APPIMAGE` when running as an AppImage.

When the app starts with `--hidden`, it stays hidden only if the tray is
available and Close to Tray is enabled. Otherwise the window opens normally.

## Spellcheck

Electron spellcheck is enabled for editable fields and uses the system
languages. Right-clicking a misspelled word shows suggestions and an **Add to
Dictionary** action, followed by the normal edit actions.

**Settings → General → Spellcheck** toggles the checker. A language picker is
not yet available.

## Clipboard Image Paste

Pasting an image from the clipboard sends it through the same upload queue as
the file picker and drag-and-drop. The existing upload service, size limits, and
error messages apply. Clipboard text paste is unchanged.

## Window State

Window size, position, and maximized state are stored in `window-state.json`
under the app data directory and restored when they still fit on a connected
display.

## Chat Logs

Desktop builds store channel and private-message history in
`profiles/default/chat-logs.sqlite` using SQLite FTS5. The default retention is
7 days; App Settings → Chat Logs can change it or keep logs forever. Redacted
messages keep their original text locally and stay searchable, but are marked in
search results with the redacting user and reason where available. This is a
local audit marker, not content deletion. Search matches word prefixes, so
`otter` matches `otters`. Use **View → Search Chat Logs…** or `Ctrl+Shift+F` to
search, and the same settings section to clear the local database. Opening a
result loads surrounding history around the target; if the loaded context is not
contiguous with the current scrollback, a gap marker offers controls to load
older or newer messages. For unjoined channels, or when server history cannot
provide the target, a temporary read-only History buffer is built from local
logs; it is not joined and is discarded when closed or when the app exits. When
local logs outlast server history, an exhausted gap can open that local context
view without changing the live channel. Chat logs are not included in profile
export/import.

## Main Logs

Desktop main-process errors are written to `main.log` in Electron's app logs
directory. On Windows this is normally `%APPDATA%\KiwiIRC\logs\main.log`. The
file rotates to `main.log.1` when it grows beyond 1 MiB.

Use **File → Open Log Folder** to open it. Chat-log initialization failures,
auto-launch errors, native HTTP failures, renderer crashes, and canceled quits
are recorded there.

Chromium verbose logging is suppressed in packaged builds. Run with `--verbose`
to restore it when troubleshooting.

## Profile Transfer

The **Profile Transfer** section in App Settings exports and imports a portable
JSON profile containing networks and settings. Export is available in every
setup; import is only available in Personal setup mode. Password export is
optional; when enabled, the file contains plaintext passwords and requires
confirmation. The desktop build uses native save/open dialogs and backs up the
current profile before importing. Browser builds use a download and file picker.

## Icons

The desktop icons are generated from `static/kiwi.svg`:

```sh
npm run icons
```

This writes a multi-resolution `build/icon.ico` for Windows, PNG sizes under
`build/icons/` for Linux, and the runtime tray and overlay assets under
`assets/`. The generated files are committed. Packaging uses those committed
assets and does not regenerate them. Run `npm run icons` only after changing
`static/kiwi.svg`. Regenerating requires `rsvg-convert` and ImageMagick.
Timestamp metadata is stripped to keep repeated builds with the same tooling
stable.

## Packaging

Linux AppImage:

```sh
npm run dist:linux
```

Debian package:

```sh
npm run dist:linux:deb
```

Windows portable:

```sh
npm run dist:win
```

Both:

```sh
npm run dist:all
```

Artifacts are written to `desktop/release/`. Windows packaging requires Wine on
Linux.

## Linux Package Registries

Debian and Arch packages are published to the Gitea package registries. Pushes
to `master` publish `kiwiirc-desktop-git` with a commit-based version. Release
workflows publish `kiwiirc-desktop` at the release version. Pull requests and
manual test runs do not publish packages. The stable and git packages conflict,
so install only one of them.

### Browse Packages

- [Stable Debian Package](https://code.nephatrine.net/nephatrine/-/packages/debian/kiwiirc-desktop)
- [Stable Arch Package](https://code.nephatrine.net/nephatrine/-/packages/arch/kiwiirc-desktop)
- [Unstable Debian Package](https://code.nephatrine.net/nephatrine/-/packages/debian/kiwiirc-desktop-git)
- [Unstable Arch Package](https://code.nephatrine.net/nephatrine/-/packages/arch/kiwiirc-desktop-git)

Stable package pages appear after a release publishes them; the `-git` pages are
available from `master` builds. Release downloads are available from the
[releases page](https://code.nephatrine.net/nephatrine/kiwiirc/releases).

### Debian

```sh
sudo curl \
    https://code.nephatrine.net/api/packages/nephatrine/debian/repository.key \
    -o /etc/apt/keyrings/gitea-nephatrine.asc

echo "deb [signed-by=/etc/apt/keyrings/gitea-nephatrine.asc] \
https://code.nephatrine.net/api/packages/nephatrine/debian trixie main" \
    | sudo tee /etc/apt/sources.list.d/kiwiirc.list

sudo apt update
sudo apt install kiwiirc-desktop
```

Use `kiwiirc-desktop-git` to track packaged commits instead of releases.

### Arch

```sh
sudo wget \
    https://code.nephatrine.net/api/packages/nephatrine/arch/repository.key \
    -O /tmp/gitea-nephatrine.asc
gpg --show-keys /tmp/gitea-nephatrine.asc
sudo pacman-key --add /tmp/gitea-nephatrine.asc
sudo pacman-key --lsign-key <key-id>
```

Add the repository to `/etc/pacman.conf`:

```ini
[nephnet]
SigLevel = Required
Server = https://code.nephatrine.net/api/packages/nephatrine/arch/nephnet/$arch
```

Then install:

```sh
sudo pacman -Sy
sudo pacman -S kiwiirc-desktop
```

Use `kiwiirc-desktop-git` to track packaged commits instead of releases.

## Container Build

The local Docker builder produces Linux artifacts on all supported architectures
and Windows artifacts on x86_64, without installing Node, Wine, or packaging
tools on the host. Wine and Xvfb are installed only on x86_64. The build scripts
use them when available and otherwise build the Linux AppImage only. It requires
Docker with the Compose plugin:

```sh
./desktop/docker/run.sh
```

The repository is mounted at `/workspace`; generated files are written back to
`dist/` and `desktop/release/`. The release directory includes a `SHA256SUMS`
file covering the desktop artifacts. Node modules, package-manager caches, and
the Wine prefix on x86_64 are kept in `~/.cache/kiwiirc-builder`, so the host
`node_modules` directories are not replaced.

When Wine and Xvfb are available, the first build initializes Wine under Xvfb
and downloads the Electron runtimes for Linux and Windows. Otherwise it
downloads only the Linux runtime. Either way, the first build takes longer than
later builds.

## Release Automation

Pushing a `v*` tag, or running the manual release workflow, builds the web
bundle and both desktop platforms in CI. The tag version must match both
`package.json` and `desktop/package.json`.

The release includes:

- the web release ZIP and TGZ
- `KiwiIRC-<version>-x86_64.AppImage`
- `KiwiIRC-<version>-x64-portable.exe`
- a combined `SHA256SUMS`

Stable Debian and Arch packages are published separately to the package
registry. Pushes to `master` publish the `-git` packages.

The test workflow desktop jobs build and upload
`KiwiIRC-<version>-x86_64.AppImage` on x86_64 and
`KiwiIRC-<version>-arm64.AppImage` on arm64. The x86_64 job also builds and
uploads `KiwiIRC-<version>-x64-portable.exe`. They run on pushes, pull requests,
and manual runs and are intended for packaging smoke tests. The shared build
path is `scripts/release-build.sh`, with desktop packaging in
`desktop/scripts/build-artifacts.sh`.

Windows and macOS artifacts are currently unsigned. Code signing and
notarization remain pending certificates.
