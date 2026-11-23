# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.0] - 2026-11-23

### Added

- **Desktop App**: Added the optional Electron shell with a secure `app://`
  origin, native HTTP/media proxying, desktop JSON5 config, Linux/Windows
  packaging, and native notifications.
- **Desktop Profiles**: Added filesystem profiles, OS-backed secrets with
  fallbacks, Personal password memory, and ZIP import/export with optional
  passwords.
- **Desktop Updates**: Added check-only Gitea release notifications and
  validated Linux/Windows release workflows with stable packages and
  `SHA256SUMS`.
- **Desktop Local Content**: Added ZIP install/manage for themes, emoji packs,
  and plugins, with local protocols and profile inclusion.
- **Desktop Chat Logs**: Added local SQLite history with FTS search, retention,
  redaction, context gaps, and an Open Channel Logs fallback.
- **File Uploads**: Added Catbox, Filebin, ShareBin.eu, Uguu~, and WebDAV
  alongside Litterbox, including chunked uploads, retention, WebDAV auth, and
  random names.
- **Message Layouts & Presets**: Added Corporate/Cyberdeck layouts, spacing
  fixes, and NephNET/AIM/Discord/IRC/Teams presets.
- **Nicklist & Channel Settings**: Added grouped nicklists and split buffer
  Preferences from channel Settings.
- **Message Search**: Added `draft/search`/`soju.im/search`, server/local
  selection, pagination, context, and `/search`.
- **Link Previews & Cards**: Added provider players/embeds, verified metadata
  cards, consistent thumbnails/galleries/links, and desktop Open
  Graph/Twitter/JSON-LD/oEmbed fallbacks.
- **Emoji Packs**: Added global/network/channel Emoji Pack policies and desktop
  ZIP management.
- **Remote Autocomplete**: Added `/auto` for `+draft/autocomplete-request`,
  multi-bot suggestions, and session-only always-auto mode.
- **IRC Links & Connections**: Added `irc://`/`ircs://` startup handling,
  prefilled joins, mixed-content warnings, and desktop protocol registration.
- **Plugins**: Added `kiwi.addSettingsBlock()`, `registerCommand()`,
  `addAutocompleteProvider()`, async `addOutgoingMessageFilter()`,
  `addIncomingMessageFilter()`, `addIncomingTopicFilter()`,
  `addBlockRenderer()`, `getSecret()`/`setSecret()`, `helpers/CommandTree`,
  layout insets, and sidebar view state.
- **Bongo Companion**: Added automatic placement/sizing, independent controls,
  reduced-motion animations, and frame-aware positioning.
- **Radio**: Added station add/edit/remove/restore, fallback streams, icons,
  waveform styles, a fullscreen WebGL visualizer, and native metadata.
- **FiSH Encryption**: Added bundled FiSH with Blowfish ECB/CBC, DH1080
  exchange, locked keys, placeholders, multiline, and mIRC/ZNC/WeeChat
  compatibility.
- **Chat Input**: Added cancelled-command warnings and a 12/24-hour/decimal Time
  System selector.
- **Simple Typography**: Added display-time Simple Typography and outgoing
  replacements on UTF-8 networks.
- **Network List & Icons**: Added reordering, OFTC/Rekt fallback icons, and
  custom icon URLs/local images.

### Changed

- **Settings**: Reorganized settings, made many options global, and changed
  several defaults. Review App Settings after upgrading.
- **Simple Markdown**: Added fenced code blocks with language hints ignored,
  fence lines preserved, and code excluded from links/emoji/typography.
- **Send Guards**: Expanded Accidental Message Protection to multiline messages,
  large pastes, and password-like single words.
- **Themes**: Softened the date and unread separator in themes inheriting
  `common/base.css`; Kiwi Dark keeps its separator.
- **Raw Buffer**: Raw lines now bypass message/link/emoji/preview processing and
  use compact monospace rows with timestamps and control glyphs preserved.
- **WHO Polling**: The away fallback now runs every three minutes, skips
  channels over 100 users, and stops stale loops.
- **History**: Hidden-only chathistory batches load older batches automatically,
  and trimming restores Load Previous Messages.
- **File Uploads**: Preferred service and retention are global, FILEHOST is
  preferred per network, and results append to the buffer draft.
- **Autocomplete**: Nick completion includes relayed users and display names
  without inserting those names; Tab/Enter and navigation are unified.
- **Limnoria**: `/lim`, suggestions, syntax, settings, and command data now come
  from `suggest-limnoria`.
- **Radio**: Stations are starred from the station browser instead of the
  player.
- **Performance**: Reduced message-list reactivity and memory growth by caching
  settings, scoping rows, bounding caches, coalescing timers, and avoiding
  redundant sorting and ping-timeout churn.

### Removed

- Removed the Network Preferences block; its controls now live in Active
  Network's App Settings.
- Removed the Export State action; `kiwi.log.getLogBuffer()` remains available.
- Removed the legacy `bnc`, `startupOptions.bouncer`, `kiwiBnc`, and `znc`
  aliases; Personal startup restores saved bouncer control connections.
- Removed the Custom Theme URL field. Theme URLs always load `<url>/theme.css`,
  and `Custom` is treated like any other theme.
- Removed the Limnoria Prefix setting and its remote autocomplete path.

### Fixed

- **Chat & IRC Protocol**: Fixed casefolding, negated `RPL_ISUPPORT` tokens,
  `PREFIX` fallback, empty trailing parameters, advertised byte limits, and
  grapheme-safe splitting of long messages.
- **Messages**: Real names in the Modern layout now render IRC formatting,
  links, and emoji like the user box.
- **Simple Markdown**: Multiline messages now keep inline formatting across line
  breaks.
- **Read Markers**: Read state now follows the exact sent timestamp, handles
  labeled responses, local-time drift, timestamp fallbacks, and stale markers.
- **Connection Lifecycle**: Reconnects now reset state, cancel stale timers and
  batches, ignore late socket/SASL callbacks, scope gateway channels, dispose
  probes, and defer bouncer saves.
- **Startup Connect**: Temporary and Remember Me off flows no longer reset the
  live network, duplicate connects are ignored, and probe channels cannot
  collide with network IDs.
- **History**: `CHATHISTORY` requests now time out correctly, retry with
  backoff, preserve nested metadata, track history-end per direction, and avoid
  false reaction gaps.
- **Mobile Layout**: Limited the mobile drawer width, updated NephDeck/NephWave
  offsets, and moved NephDeck settings inside mobile chrome.
- **Shutdown**: Replaced `unload` with `pagehide`, avoiding the Chromium unload
  policy violation.
- **Link Previews**: Failed previews no longer loop or refetch; concurrent
  requests are shared, failures are briefly cached, and topic handles open in
  the pinned media area.
- **Avatars**: Image avatars now render as plain HTML with a stable wrapper, so
  rows no longer re-layout every frame or stretch on theme changes.
- **Localization**: Fixed account-registration messages showing literal
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
