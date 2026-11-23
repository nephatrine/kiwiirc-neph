# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.0] - 2026-11-23

### Added

- **Desktop App**: Added an optional Electron shell with a secure `app://`
  bridge, a desktop-only JSON5 configuration overlay, native HTTP for emoji
  packs, downloads, and uploads, a direct-media proxy with Range support, and
  Linux/Windows packaging. Desktop builds use native notifications instead of
  Web Push.
- **Desktop Profiles & Transfer**: Added filesystem-backed state and metadata
  storage, legacy localStorage migration, OS-backed password storage through
  `safeStorage` with a warned plaintext fallback, and Personal startup password
  memory with a per-network opt-out. Added portable profile export/import as a
  ZIP carrying state, themes, emoji packs, plugins, and custom icons, with an
  optional plaintext-password export.
- **Desktop Updates & Distribution**: Added check-only Gitea release
  notifications with manual and automatic checks, a tray indicator, and a
  release-page link; updates are never downloaded or installed. Release
  workflows validate tags, build the web bundle, Linux AppImage, and Windows
  portable executable for release assets with a combined `SHA256SUMS`, and build
  stable packages for the Debian and Arch registries.
- **Desktop Local Content**: Added local theme, emoji pack, and plugin
  installation from ZIP archives, with installed-content listing, uninstall
  controls, plugin loaded/failed/disabled status, enable toggles, and a reload
  prompt. Added the `kiwi-theme://`, `kiwi-emoji://`, `kiwi-icon://`, and
  `kiwi-plugin://` protocols. Installed content is stored in the desktop
  user-data directory and included in profile archives.
- **Desktop Chat Logs**: Added local SQLite chat history with FTS search,
  configurable retention, redaction handling, word-prefix matching, a desktop
  search dialog, historical context loading with gap markers, and an Open
  Channel Logs action for unavailable or exhausted server history. The desktop
  log search is filtered to the current network and buffer. Unjoined channels
  use a read-only local-log History buffer instead of rejoining, and searched
  messages are briefly highlighted.
- **File Uploads**: Added desktop-only Catbox, Filebin, ShareBin.eu, Uguu~, and
  WebDAV services alongside Litterbox, with Catbox user hashes, ShareBin
  retention and chunked uploads, WebDAV access URLs and optional Basic auth, a
  WebDAV password stored in the desktop secret store, and unique
  timestamp-and-random upload names.
- **Message Layouts & Presets**: Added Corporate and Cyberdeck message layouts
  and refined timestamp, action, and status spacing in the inline and
  traditional layouts so 12-hour times and narrow rows stay aligned. Added
  preset menus in the browser and Electron app for one-click NephNET, AIM,
  Discord, IRC, and Teams combinations; the browser switcher is optional and
  both menus list only presets whose themes are enabled.
- **Nicklist & Channel Settings**: Added optional grouped nicklists with Owner,
  Operator, Half-Op, Voiced, Users/Online, and Offline headings. Split
  per-buffer Preferences from channel Settings and hid the Settings tab when the
  channel has no settings to show.
- **Message Search**: Added server-side history search for `draft/search` and
  `soju.im/search`, with a source selector for server history or desktop local
  logs, pagination, one channel/nick target per server search, read-only context
  for unopened buffers, and `/search <terms>` with server-first and local-log
  fallback. The search dialog follows the theme; results load context on first
  click, and unloaded local results become Open Log when server history cannot
  reach them.
- **Link Previews**: Expanded link previews with provider players and embeds for
  major video, audio, map, and presentation services. Added verified generic web
  metadata cards for selected news, standards, archive, developer, and wiki
  sites; pages outside the allowlist are not fetched.
- **Preview Cards**: Reworked link preview and bridged cards into a consistent
  content-first card with thumbnails, lightbox galleries, safe wrapping, and
  clickable links. Added desktop metadata cards from Open Graph, Twitter Card,
  JSON-LD, and oEmbed. Fallbacks degrade from players to oEmbed cards to page
  metadata and failed cards remove their handles. Desktop player embeds send
  valid HTTPS Referer values and a desktop-specific Twitch `parent`, so they
  work under the `app://` origin.
- **Emoji Packs**: Added a global Emoji Packs settings block with a Local/Remote
  preference, added network and channel Default/Always/Never policies, and added
  desktop emoji pack installation from ZIP archives with installed-pack
  management and the `kiwi-emoji://` protocol.
- **Remote Autocomplete**: Added `/auto`, which sends
  `+draft/autocomplete-request` TAGMSGs for the current channel or query and
  merges responses from multiple bots with each suggestion attributed to its
  source. The `/auto` prefix is stripped from the sent message, bare `/auto`
  toggles session-only always-auto mode for the network, and an open list
  accepts Enter to send or Tab to complete.
- **IRC Links & Connections**: Added `irc://` and `ircs://` handling in Personal
  startup, focusing an existing network or opening a prefilled Add Network page,
  with initial channel lists captured in network settings and a prompt before
  joining link channels. Added an HTTPS mixed-content warning when a direct
  `ws://` endpoint is configured, and desktop protocol-handler registration
  defaults on.
- **Plugins**: Added `kiwi.addSettingsBlock()`, `kiwi.registerCommand()`,
  `kiwi.addAutocompleteProvider()`, async-capable `addOutgoingMessageFilter()`,
  `addIncomingMessageFilter()`, `addIncomingTopicFilter()`,
  `addBlockRenderer()`, `getSecret()`/`setSecret()`, the data-free
  `helpers/CommandTree`, layout chrome insets for framing plugins, and sidebar
  active-view state. These let plugins add settings blocks, commands, local
  completion, outgoing and incoming message handling, topic handling, block
  renderers, and secret storage without assuming a specific theme.
- **Bongo Companion**: Added automatic placement, using Bottom Right while a
  right sidebar is open and Top Right when it is closed, plus automatic sizing
  that grows while the nicklist is visible; both are now the default. Added
  independent position and size controls, outside-click dismissal for the stats
  card, reduced-motion-aware animations, positioning that accounts for full-page
  views and frame insets, and theme-aware popup colors.
- **Radio**: Added station management for adding, editing, removing, and
  restoring user stations and hidden station entries, with homepage links,
  multiple ordered stream URLs and fallback, URL or desktop-local icons, and
  settings for Enable Radio, Show Now Playing, Show Waveform, and Show Station
  Icons. Expanded waveform styles, added a MilkDrop-inspired WebGL visualizer
  with fullscreen and playback controls, and moved desktop metadata fetching to
  native HTTP with genre, bitrate, listener details, manual lookup, and backoff.
  The station browser remains available with no stations, and the header toggles
  back to the station list.
- **FiSH Encryption**: Added the bundled FiSH plugin with Blowfish ECB/CBC
  encryption for queries, channels, notices, actions, and topics, DH1080 key
  exchange, passphrase-locked key storage, undecryptable-message placeholders,
  multiline handling, and compatibility with mIRC, ZNC, and WeeChat FiSH
  clients.
- **Chat Input**: Added a visible warning when a space-prefixed command is
  cancelled, with actions to edit it or send it as a message. Added a Time
  System selector for 12-hour, 24-hour, and decimal time. Custom
  `timestamp_format` values still render as configured and hide the selector.
- **Simple Typography**: Added Simple Typography for displayed message
  punctuation and Typographic Replacements for sent messages on UTF-8 networks.
  Code spans, fenced code, and links are left unchanged.
- **Network List & Icons**: Added per-network move-up controls, OFTC and Rekt
  fallback icons, and a per-network icon URL in Server Details → Advanced that
  overrides server-provided and built-in icons. Desktop users can select a local
  image, which is copied into the app data directory and served through
  `kiwi-icon://`.

### Changed

- **Settings**: Reorganized settings and made many buffer-specific and some
  network-specific settings global settings now. Many defaults changed. Please
  go through your appsettings page and re-adjust to match your preferences if
  needed.
- **Simple Markdown**: Messages now supports triple-backtick fenced code blocks,
  ignores the language hint, preserves the fence lines, and excludes their
  contents from link, emoji, and typography processing.
- **Send Guards**: Expanded Accidental Message Protection beyond space-prefixed
  commands to warn before sending multiline messages on networks without
  `draft/multiline`, large pastes, and password-like single words, with options
  to edit or send anyway.
- **Themes**: Softened the message-list date and unread separator from a 2px
  dashed accent to a 1px dashed accent at 25% opacity in the dark themes that
  inherit `common/base.css`; Kiwi Dark keeps its original separator.
- **Raw Buffer**: Raw protocol lines now bypass message formatting, URL,
  channel, user, emoji, and preview processing and use a compact monospace row
  instead of the normal message layouts. Timestamps, `[S]`/`[C]` prefixes, and
  visible control glyphs are preserved.
- **WHO Polling**: The away-status fallback now runs every three minutes instead
  of every 30 seconds, skips channels with more than 100 users, and stops stale
  loops when a buffer has been removed and replaced by one with the same name.
- **History**: Hidden-only chathistory batches now advance a separate cursor and
  continue loading older batches automatically. Trimming restores Load Previous
  Messages, requests older history from the oldest remaining message, and is
  briefly delayed after returning to the bottom.
- **File Uploads**: The preferred upload service and service-specific retention
  settings are now global, and networks default to preferring FILEHOST when
  available with a per-network Use FILEHOST setting. Per-network service and
  retention overrides were removed, and file upload results append to the
  originating buffer's draft instead of sending immediately.
- **Autocomplete**: Nick completion now includes known relayed users from the
  current buffer, including their display names as searchable labels; display
  names are never inserted into the message. Tab accepts the highlighted
  suggestion, Enter accepts it and sends, Space and punctuation type normally,
  and the arrow keys and Shift+Tab navigate the list.
- **Limnoria**: `/lim`, command suggestions, syntax hints, settings, and command
  data now come from the bundled `suggest-limnoria` plugin. Core no longer
  contains Limnoria command names, syntax, or delivery rules.
- **Radio**: Stations are now starred from the station browser instead of the
  player.
- **Performance**: Reduced message-list reactivity and renderer memory growth by
  caching avatar and host-name settings per buffer, avoiding per-message setting
  reads, scoping row reactivity, precomputing author-repeat and unread state,
  and bounding avatar caches. Coalesced scroll and tick work, avoided redundant
  scrollback sorting, shared batch timers, cached radio waveform colors, bounded
  hidden raw buffers, and reduced IRC ping-timeout churn.

### Removed

- Removed the Network Preferences block; its controles now live in the active
  network's App Settings tab.
- Removed the Export State troubleshooting action; `kiwi.log.getLogBuffer()`
  remains available for raw log diagnostics.
- Removed the unused top-level `bnc` object, `startupOptions.bouncer`, the
  `kiwiBnc` and `znc` startup aliases, and the `znc` preset-network type alias.
  Personal startup now restores a saved bouncer control connection
  automatically.
- Removed the special Custom Theme URL field. Theme URLs are always loaded as
  `<url>/theme.css`, and a theme named `Custom` is treated like any other theme.
- Removed the Limnoria Prefix setting and the Limnoria-specific remote
  autocomplete path.

### Fixed

- **Chat & IRC Protocol**: Casefold user and channel state with the negotiated
  `CASEMAPPING`, apply negated `RPL_ISUPPORT` tokens, fall back to the modern
  `(ov)@+` `PREFIX` only when the server advertises none, preserve empty
  trailing parameters, enforce advertised byte limits for `/join`, `/topic`,
  `/kick`, `/away`, and `/nick`, and send long multiline messages in
  grapheme-safe chunks.
- **Messages**: Real names in the Modern layout now render IRC formatting,
  links, and emoji, matching the user box.
- **Simple Markdown**: Simple Markdown now supports multiline messages,
  including inline formatting across line breaks.
- **Read Markers**: Read state now follows the exact sent `MARKREAD` timestamp,
  correlates labeled responses with pending markers, uses the message's local
  time to avoid clock-offset drift, falls back to timestamp references without a
  `msgid`, treats `MARKREAD *` as no stored marker, and ignores stale server
  markers.
- **Connection Lifecycle**: Reconnects now reset connection-scoped state, cancel
  stale timers and batch queues, ignore late socket and SASL callbacks, scope
  gateway channels to their own socket, dispose probe channels, and defer
  bouncer saves until a controller is available.
- **Startup Connect**: Temporary and Remember Me off flows no longer reset the
  live network after connecting, duplicate connect calls are ignored during
  negotiation, and probe channels cannot collide with network channel IDs.
- **History**: `CHATHISTORY` timeouts now start when a request is sent, retry
  with backoff, and keep manual loading available. The LATEST-to-live boundary
  uses the newest stored message, nested labeled-response batches preserve
  chathistory metadata, history-end is tracked per request direction, and
  reaction-only batches no longer create false gaps after reconnect.
- **Mobile Layout**: Limited the mobile state-browser drawer width, updated
  NephDeck and NephWave chrome offsets to follow the drawer width, and moved
  NephDeck app settings inside its mobile chrome.
- **Shutdown**: Replaced the deprecated `unload` handler with `pagehide`, so
  connection shutdown no longer triggers the Chromium unload policy violation.
- **Link Previews**: Failed previews no longer trigger message re-rendering
  loops that refetched the same URL. Concurrent preview requests are shared,
  failed previews are cached briefly before retrying, and topic preview handles
  now open in the pinned media area.
- **Avatars**: Image avatars now render as plain HTML and keep a stable wrapper,
  so the message list no longer re-lays out on every animation frame and avatars
  no longer stretch during theme or preset changes.
- **Localization**: Fixed account-registration messages that displayed literal
  `{version}`, `{account}`, `{min}`, and `{max}` placeholders.

## [2.1.0] - 2026-11-03

### Added

- **Themes**: Added NephWave, a standalone theme with an optional desktop shell
  plugin.
- **Chat & IRCv3**: Added Twitch IRC support, incoming `draft/channel-rename`,
  and `draft/oper-tag` operator badges.
- **Bouncer**: Added `bouncer-networks` and notify support for Soju and
  compatible bouncers, an always-visible BNC network, BNC/Account/Register
  startup tabs, and BouncerServ completion and cheatsheet.
- **Login & Accounts**: Added independent Anonymous, Account, and Register
  fields with server-advertised length limits, SASL and server-password
  validation, password strength, and nick suggestions.
- **Limnoria**: Added per-network `/lim` settings and local command completion
  for core plugins including Admin, Channel, Factoids, Karma, Quote, RSS, and
  Services. Commands use prefix or private delivery as appropriate, with remote
  autocomplete still available on Tab.
- **Emoji**: Added local `customEmojis` for messages and reactions, IRCv3
  `draft/EMOJI` server and `draft/emoji` channel packs, per-channel loading
  policies, prompts for unknown channel packs, a custom picker category, and
  pack-aware autocomplete.
- **Media & Previews**: Added X/Twitter media previews and Libera network icons.
- **Plugins**: Added an app-level `addUi('app', ...)` mount point, an
  `input.activity` event, and a generic media playback registry.
- **Build & Tooling**: Added Bongo Companion WebP optimization and
  `deploy/nginx.conf.example` with caching, MIME, and WebSocket guidance.

### Changed

- **Bridging & Relays**: Bridged display names and avatars are now bot-only and
  sanitized, RELAYMETA applies the `bot` and `color` keys, multiline bridge
  messages render rich cards, and bridge previews no longer duplicate an
  existing media preview.
- **Networking & Bouncer**: Per-network settings now cover notifications,
  persistence, typing, rerouting, bot filtering, redactions, uploads, Web Push,
  and FILEHOST credentials. Bouncer-managed networks use explicit Save and
  Connect/Reconnect actions.
- **Login & Network Settings**: Welcome and Custom Server tabs now share
  validation and field behavior, field labels describe the underlying value,
  saved anonymous networks open on Anonymous, network details group IRC and SASL
  credentials, reconnect-locked fields are marked, Advanced options only show
  relevant fields, and the connection picker only offers IRC/IRCS when a gateway
  is configured.
- **Chat Behavior**: `@everyone` replaces `@everybody`, consecutive replies to
  the same message show one preview, CTCP auto-replies are available, operator
  login posts a visible line, and bot badges use Boxicons.
- **Emoji & Messages**: Emoji tokens render after punctuation. The Modern layout
  enlarges emoji-only messages to 3em.
- **Themes & UI**: NephDeck is now one theme with Amber, Green, and Cyan
  presets; Boxicons replaces Font Awesome; action buttons, disabled controls,
  emoji metadata, and radio styling are unified; the radio player ships as a
  bundled plugin with service registration; the channels sidebar plugin is
  renamed to `static/plugins/channels-sidebar.html`.
- **Build & Performance**: Replaced several third-party libraries to reduce the
  client bundle by about 86 KB, direct connections request the IRCv3
  `text.ircv3.net` subprotocol, and production builds minify static assets.
  Unicode emoji data, the Limnoria command index, and JSON5 now load in separate
  chunks, and release builds omit source maps.
- **Metadata**: Servers advertising `max-keys=0` no longer receive Kiwi's own
  metadata requests, Soju's pinned/muted/blocked keys remain mapped to settings,
  and subscriptions use one per-connection key list.

### Removed

- **Embedly**: Removed optional Embedly card support and the `embedly`
  configuration. Existing blocks are ignored.
- **Configuration**: Removed the legacy `emojis` and `emojiLocation` keys in
  favor of `customEmojis`.

### Fixed

- **Web Push & Notifications**: Registration is deferred until startup history
  is ready, focused windows and CTCP/self-mentions no longer notify, and
  per-network workers recover from activation and registration failures.
- **History & Reconnect**: History requests time out, pending requests clear on
  reconnect, auto-reconnect no longer sticks in Connecting, and early reconnects
  use normal join text.
- **Chat & Input**: Slash commands handle non-breaking spaces, multiline notices
  keep their prefix, redactions and spoilers behave correctly, and `/roll`, CTCP
  relay metadata, SASL `900` after `001`, current-account tracking,
  team-highlight word boundaries, WHO throttling, and echo matching are
  corrected. As-typed emoji conversion replaces only the matched shortcode,
  preserving surrounding text such as `ten-:smile:`, and shortcodes stay literal
  inside monospace or code blocks.
- **UI & Themes**: Bongo animation frames preload, modern-layout hover padding
  is fixed, emoji categories track scrolling, link preview handles open
  correctly, links without native media no longer show preview controls, network
  preference labels stack, NephWave notification colors are distinct, and
  greeting text survives probe updates.
- **Network Settings**: Disconnecting updates state immediately, saved networks
  adopt the current startup transport settings, Ignore Bots appears only when
  supported, and the Information tab falls back to the `004` version when `002`
  has none.
- **Diagnostics**: Uncaught errors and promise rejections are logged and shown
  in the active buffer, and startup errors show their message instead of a blank
  screen.

## [2.0.0] - 2026-10-17

### Added

- **Themes & Formatting**: Added a theme system with 39 built-in themes and a
  custom theme URL. Markdown-style formatting, IRC colours (0-99 and hex),
  spoilers, and a formatting toolbar with colour and emoji pickers. Emoji
  shortcodes convert while typing and on incoming messages.
- **Conversations**: Added threaded replies (`+reply`, falling back to
  `+draft/reply`), per-message reactions (`+draft/react`), typing indicators
  (`+typing`), long messages sent as one `draft/multiline` batch, and redaction
  (`draft/message-redaction`) with a confirmation prompt and click-to-reveal.
  Messages rerouted with `+channel-context` appear in the correct buffer.
- **History & Read State**: Added `draft/chathistory` and `draft/event-playback`
  for gap-filling, including replayed joins, parts, and modes.
  `draft/read-marker` keeps read state in sync across sessions, and
  `echo-message` with `labeled-response` confirms outgoing messages.
- **Accounts & Login**: Added SASL login, preferring `SCRAM-SHA-256` over
  `PLAIN`, with a "Remember me" toggle that can purge saved state and a separate
  "Remember password" toggle beneath it. The login page offers Anonymous,
  Account, and Register tabs driven by a pre-login server probe.
  `draft/account-registration` adds a Register Account action for connected
  guests and a Register tab when the probe sees `before-connect`, with an inline
  `VERIFY` step. `draft/persistence` adds a Preferred Persistence setting (Keep
  As-Is by default).
- **Profiles & Branding**: Added `draft/metadata-2` and `draft/metadata-3` for
  display names, pronouns, descriptions, homepages, status, and
  contrast-adjusted colours, with a fallback avatar. `NETWORK` and `draft/ICON`
  brand the network, with an Ergo icon fallback and channel avatars.
- **Media & Uploads**: Added image, audio, and video embeds, with iframe
  previews for YouTube, Twitch, SoundCloud, Spotify, Streamable, RedGifs, and
  Giphy. Imgur single images are shown as images. Uploads work from the input
  bar, file picker, drag-drop, and paste, through Litterbox or the server
  `FILEHOST` (`draft/FILEHOST`, then `soju.im/FILEHOST`), with per-user service
  and retention overrides.
- **Buffers & Notifications**: Added favourite pinning and mute, plain-text
  buffer export, and desktop notifications independent of synthesized sounds.
- **Radio**: Added a built-in station player in the sidebar with a station list,
  starred stations, volume control, and a theme-coloured waveform.
- **Bridging & Relays**: Bot messages prefixed with `<Name>` are attributed to
  the bridged user, with their own nick colour and avatar. `draft/relaymsg`
  relays give those users a limited profile panel, and bots advertising
  `RELAYMETA` are queried over CTCP for display names and avatars.
- **Diagnostics**: Added an anonymized state and log dump for troubleshooting.

### Changed

- Replies, reactions, and redactions now reference messages by IRCv3 `msgid`
  rather than a local ID.
- Settings and headers follow network capabilities and viewport size.
- Reconnect delays are capped, and channel joins are healed after reconnect.
- `/list` is deferred for 30 seconds after connect, then rate-limited.
- Replaced image emoticons with Unicode emoji.

### Removed

- Removed support for legacy IE11 and EdgeHTML browsers and their polyfills.
- Removed the legacy BNC `bufferSeen` mechanism in favour of
  `draft/read-marker`.
- Removed `znc.in/self-message` support in favour of `echo-message`.

### Fixed

- **Security**: Updated dependencies, including PostCSS, to address known
  vulnerabilities.
- **Same-Origin Links**: Same-origin document links, including `.svg`, now
  download instead of opening. Same-origin iframes are not rendered.
