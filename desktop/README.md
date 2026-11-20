# Kiwi IRC Desktop

Kiwi IRC Desktop is an optional Electron shell for the Kiwi IRC web client. It
adds native notifications, a tray icon, local chat logs, local theme, emoji
pack, and plugin packages, filesystem profiles, and Linux/Windows packages. The
web client remains the primary target.

## Installation

Prebuilt releases and package registry pages are listed in the main
[README](../README.md#downloads). The desktop build is available as a Linux
AppImage, Windows portable executable, Debian package, and Arch package.

Desktop artifacts are unsigned. Verify the published `SHA256SUMS` before running
a downloaded build.

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

Use `kiwiirc-desktop-git` to track packaged commits instead of releases. The
stable and `-git` packages conflict, so install only one.

## Building from Source

Node.js 22 or newer is required.

```sh
npm ci
npm run build:release
cd desktop
npm install
npm start
```

`npm start` runs the production-style shell against the built `dist/` directory.

For development, run the webpack dev server in the repository root and start the
desktop shell against it in a second terminal:

```sh
# Terminal 1
npm run dev

# Terminal 2
cd desktop
npm run dev
```

If `npm install` is configured to block package install scripts, the Electron
binary may not download automatically. From `desktop/`, run:

```sh
node node_modules/electron/install.js
```

### Packaging

From `desktop/`:

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

Linux & Windows:

```sh
npm run dist:all
```

Artifacts are written to `desktop/release/`. Windows packaging requires Wine on
Linux.

### Container Build

From the repository root, the local Docker builder produces Linux artifacts on
supported architectures and Windows artifacts on x86_64 without installing Node,
Wine, or packaging tools on the host. It requires Docker with the Compose
plugin:

```sh
./desktop/docker/run.sh
```

The repository is mounted at `/workspace`; generated files are written back to
`dist/` and `desktop/release/`. Node modules, package-manager caches, and the
Wine prefix on x86_64 are kept in `~/.cache/kiwiirc-builder`, so host
`node_modules` directories are not replaced.

## Desktop Configuration

By default, the desktop app starts on the Personal screen with no default
network or gateway. Users add networks themselves.

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
`themes`, and `aliases`. See [CONFIGURATION.md](../CONFIGURATION.md) for the
general configuration reference.

Native HTTP blocks private and loopback addresses by default. Enable private
networks only when needed, and raise the upload limit for large WebDAV uploads:

```json5
{
    "desktopHttp": {
        "allowPrivateNetworks": false,
        "maxUploadBytes": 268435456
    }
}
```

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
The check only reads public release metadata, and the API endpoint and release
links must use HTTPS.

## Notifications

Desktop builds use native system notifications instead of browser Web Push.
Notifications are shown when the app is unfocused and **Desktop Notifications**
is enabled. Clicking a notification restores the window and opens the relevant
buffer or message.

The Web Push setting is hidden in desktop builds. Web builds keep browser
notifications and Web Push.

## Tray, Window & Startup

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

Window size, position, and maximized state are restored when they still fit on a
connected display.

**Settings → General → Launch at Login** starts Kiwi IRC when the user signs in.
It is available only in packaged Linux and Windows builds and defaults off. When
the app starts hidden, it stays hidden only if the tray is available and Close
to Tray is enabled; otherwise the window opens normally.

Close to Tray, Launch at Login, Spellcheck, window state, and automatic
update-check preferences are stored separately from the profile and are not
included in profile transfer.

## Input & Clipboard

Electron spellcheck is enabled for editable fields and uses the system
languages. Right-clicking a misspelled word shows suggestions and an **Add to
Dictionary** action, followed by the normal edit actions. **Settings → General →
Spellcheck** toggles the checker. A language picker is not yet available.

Pasting an image from the clipboard sends it through the same upload queue as
the file picker and drag-and-drop. The active upload service, size limits, and
error messages apply. Clipboard text paste is unchanged.

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

Installed themes are copied into the desktop user-data directory. They are not
available in the web client, but desktop profile archives include installed
themes. Uninstalling the active theme switches back to the default theme.

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
Supported formats are PNG, JPEG, GIF, WebP, AVIF, and SVG.

Installed packs are copied into the desktop user-data directory and are not
available in the web client, but desktop profile archives include installed
packs. All installed packs are active, and newer packages win when two packages
use the same pack ID.

## Installed Plugins

Desktop users can install local plugin archives from **Settings → General →
Plugins**. The block is hidden in restricted mode, and built-in plugins remain
listed and can be disabled there.

Choose a `.zip` containing either `plugin.json` at the archive root or one
top-level folder containing it:

```text
my-plugin.zip
└── my-plugin/
    ├── plugin.json
    ├── plugin.js
    └── assets/
        └── icon.png
```

`plugin.json` requires `name`; `description`, `version`, and `entry` are
optional. `entry` defaults to `plugin.js` and must be a `.js` or `.html` file
inside the package:

```json
{
  "name": "My Plugin",
  "description": "Does a thing",
  "version": "1.0.0",
  "entry": "plugin.js"
}
```

Installed packages are copied into the desktop user-data directory. Local plugin
files can use relative assets, and desktop profile archives include installed
plugins. Changes to the plugin list or enabled state apply after a reload, which
the settings block offers with a **Reload** button.

Plugin packages are trusted code. Do not install a plugin unless you trust its
author.

## Profiles & Transfer

Desktop state is stored in one default profile:

```text
Linux:   ~/.config/KiwiIRC/profiles/default/
Windows: %APPDATA%\KiwiIRC\profiles\default/
```

Personal startup remembers passwords by default. The per-network **Remember
Passwords for This Network** checkbox is available in Server Details only in
Personal startup mode. Password storage uses the OS keyring when available. If
encryption is unavailable, Kiwi warns before storing new secrets in a local
secrets file. Existing encrypted secrets are not downgraded while the keyring is
temporarily unavailable.

Existing browser-storage state is migrated into the default profile on first
desktop launch when no profile state exists.

The **Profile Transfer** section in App Settings exports and imports a portable
profile. The desktop build writes a ZIP archive containing `profile.json` plus
any installed themes, emoji packs, plugins, and custom network or station icons;
a JSON export is also offered for moving state into a browser build. Export is
available in every setup; import is only available in Personal setup mode.
Password export is optional; when enabled, the profile contains plaintext
passwords and requires confirmation. The desktop build uses native save/open
dialogs and backs up the current profile before importing. Importing skips
themes, emoji packs, and plugins that are already installed.

## Local Chat Logs

Desktop builds store channel and private-message history in a local SQLite
database. The default retention is 7 days; **App Settings → Chat Logs** can
change it or keep logs forever.

Redacted messages keep their original text locally and stay searchable, but are
marked in search results with the redacting user and reason where available.
This is a local audit marker, not content deletion.

Search matches word prefixes, so `otter` matches `otters`. Use **View → Search
Messages…** or `Ctrl+Shift+F` to search, and the same settings section to clear
the local database. Opening a result loads surrounding history around the
target; if the loaded context is not contiguous with the current scrollback, a
gap marker offers controls to load older or newer messages. For unjoined
channels, or when server history cannot provide the target, a temporary
read-only History buffer is built from local logs; it is not joined and is
discarded when closed or when the app exits. Chat logs are not included in
profile export/import.

## Logs & Troubleshooting

Desktop main-process events are written to `main.log` in Electron's app logs
directory. On Windows this is normally `%APPDATA%\KiwiIRC\logs\main.log`, with a
rotated `main.log.1` backup.

Use **File → Open Log Folder** to open it. Chat-log initialization failures,
auto-launch errors, native HTTP failures, renderer crashes, and canceled quits
are recorded there.

Freeze diagnostics are always on. When a window stops responding or the main
process event loop stalls, the app writes a metrics-only snapshot to
`%APPDATA%\KiwiIRC\diagnostics\freeze-*.json` (last 20 kept). Renderer long
tasks, slow synchronous IPC, and hang durations are also recorded in `main.log`.
**Capture Diagnostics Snapshot** in the tray menu writes one manually. Snapshots
never contain message text, nicknames, or credentials.

Chromium logging has two modes. Explicit command-line flags always win over the
app defaults:

- **Console:** `--enable-logging --log-level=1` opens a console window and
  prints warnings. Levels are `0` info, `1` warning, `2` error, `3` fatal. Add
  `--verbose` if the app's quiet defaults would otherwise replace the level.
- **File:** `KIWI_DIAGNOSTICS=1` (or `--diagnostics`) writes
  `%APPDATA%\KiwiIRC\chrome_debug.log` at info level.

For a freeze, collect the newest `freeze-*.json`, `main.log` (and `.1`), and a
dump of the hung process (Task Manager → **Create dump file**, or
`procdump -ma -h <pid>`).

## Plugin Trust

Plugins are trusted code and run with the page's privileges. Only install
plugins from sources you trust.
