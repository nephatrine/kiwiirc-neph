# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Chat Logs**: Added an Open Channel Logs action when server chathistory is
  unavailable or exhausted, with the desktop log search filtered to the current
  network and buffer.
- **Message Search**: Added server-side history search for servers advertising
  `draft/search` or `soju.im/search`, with a source selector for server history
  or desktop local logs, server-side pagination, one channel/nick target per
  server search, and read-only server context for results in unopened buffers.
- **Message Search**: Added `/search <terms>` for the current channel or query,
  preferring server history and falling back to desktop local logs when needed.
- **Autocomplete**: Nick completion now includes known relayed users from the
  current buffer, including their display names as searchable labels. Display
  names are never inserted into the message.
- **IRC Links**: Personal startup now handles `irc://` and `ircs://` links by
  focusing an existing network or opening a prefilled Add Network page. Initial
  channel lists can be captured in network settings, and existing networks
  prompt before joining channels from a link.
- **Emoji Packs**: Added a global Emoji Packs settings block with a Local
  Packs/Remote Packs preference, moved Load Remote Emoji out of Chat Messages,
  moved the per-channel pack controls into the network App Settings tab, and
  added desktop emoji pack installation from ZIP archives with installed pack
  management and the `kiwi-emoji://` image protocol.
- **Desktop**: Added an optional Electron shell with a secure `app://` bridge, a
  desktop-only JSON5 configuration overlay, the Personal startup screen, native
  HTTP for emoji packs, downloads, and uploads, a direct-media proxy with Range
  support, and Linux/Windows packaging.
- **Desktop Profiles**: Added filesystem-backed state and metadata storage,
  legacy localStorage migration, OS-backed password storage through
  `safeStorage`, and a warned plaintext fallback when encryption is unavailable.
  Personal startup remembers passwords by default, with a per-network opt-out in
  Server Details.
- **Desktop Profile Transfer**: Added portable browser/desktop profile export
  and import, with optional password-included files and a desktop profile backup
  before import.
- **Desktop Themes**: Added local theme installation from ZIP archives, with
  installed theme listing and uninstall controls in Appearance. Themes are
  stored in the desktop user-data directory and served through `kiwi-theme://`.
- **Plugins**: Added `kiwi.addSettingsBlock()` so plugins can append a settings
  block to General or the active-network App Settings tab without creating
  another tab. Added `kiwi.registerCommand()` for client input commands,
  `kiwi.addAutocompleteProvider()` for local completion and syntax hints, and
  the data-free `helpers/CommandTree` module for `suggest-*` plugins.
- **Limnoria**: Moved `/lim`, command suggestions, syntax hints, settings, and
  all command data into the bundled `suggest-limnoria` plugin. Core no longer
  contains Limnoria command names, syntax, or delivery rules. Without the
  plugin, `/lim` is not a client command.
- **Network List**: Added per-network move-up controls and the OFTC fallback
  network icon.
- **Network Icons**: Added a per-network icon URL in Server Details → Advanced
  that overrides server-provided and built-in icons. Desktop users can choose a
  local image, which is copied into the app data directory and served through
  `kiwi-icon://`. Added the nightride fallback for `NETWORK=RektNetwork`.
- **Plugin Layout API**: Added viewport-edge layout chrome insets that framing
  plugins can register and other plugins can consume. NephWave and NephDeck now
  report their frame insets, and Bongo Companion positions itself from the
  combined insets instead of assuming a specific theme. Sidebar tracking now
  clears while a full-page active view is open, with
  `kiwi.state.ui.active_view_open` exposing that state.
- **Bongo Companion**: Automatic sizing now returns to Normal while a full-page
  view covers the sidebar, and automatic positioning uses Bottom Right while a
  full-page view is open regardless of the sidebar underneath.
- **Bongo Companion**: Added Automatic placement, which uses Bottom Right while
  a right sidebar is open and Top Right when it is closed. Automatic is now the
  default position. Added a Size selector with Automatic, Normal, and Larger
  options; Automatic uses the larger companion only while the nicklist is
  visible. The stats card closes when clicking outside, shows explicit position
  and size controls independently, and animates position and size changes when
  reduced-motion preferences allow it.
- **Radio**: The player and station browser now remain available when no
  stations are defined. Added a General settings block for Enable Radio, Show
  Now Playing, and Show Waveform, plus Show Station Icons for hiding artwork and
  the empty artwork column in the station browser. Added station management for
  adding, editing, removing, and restoring user stations and hidden station-file
  entries, with URL or desktop-local icons. Stations can have a homepage URL and
  multiple ordered stream URLs with automatic fallback. The station channels
  field was removed; channel names in descriptions remain clickable. Waveform
  styles include None, Bars, Mirror Bars, Wave, Area Wave, LED Spectrum, Pulse,
  and Peak Caps. The player favorite button was removed; stations are starred
  from the station browser. Desktop builds now use native HTTP for station and
  now-playing metadata, fetch station details in a staggered background queue,
  show genre, bitrate, and listener details, and support manual details lookup.
  Failed metadata requests back off instead of retrying continuously. Added a
  MilkDrop-inspired station-browser visualizer with a WebGL feedback effect, 2D
  fallback, fullscreen mode, and playback controls.
- **App Settings**: Added a Channel Defaults section for global per-channel
  defaults such as joins/parts, topic/nick/mode changes, formatting, nicklist
  colors, notification level, sound, and unread counts. Added the remaining
  global display, input, history, and notification controls that were previously
  config-only.
- **Chat Input**: Added a visible warning when a space-prefixed command is
  cancelled, with actions to edit it or send it as a message. Added App Settings
  controls for the emoji and color pickers.
- **Remote Autocomplete**: Added the `/auto` input command. Tab requests are
  opt-in per message, can target the current channel or query, and merge
  responses from multiple bots with each suggestion attributed to its source.
  The `/auto` prefix is stripped from the sent message. Running `/auto` by
  itself toggles a session-only, per-network always-auto mode that highlights
  the input bar and removes the need to prefix each request.
- **Notifications**: Added a Team Highlights setting for `@here`, `@channel`,
  and `@everyone`.
- **Avatars**: Added an Avatars settings category with fallback style, custom
  fallback URL, image background, and away status position controls. Fallbacks
  include local initials, a local identicon, and remote DiceBear Identicon,
  Rings, Bottts, Cameo, and animated Gaze styles.
- **Desktop Window**: Remember the window size, position, and maximized state
  across launches.
- **Link Previews**: Added provider-owned players and embeds for TED, Mixcloud,
  Wistia, Loom, Art19, Pinterest, TikTok, Prezi, OpenStreetMap, Yandex Maps,
  YouTube playlists, and Twitch VODs. Vimeo uses its official player and
  supports channel, showcase, and player URLs. Imgur gallery/album pages use a
  curated iframe; single-image Imgur links remain direct media. OpenStreetMap
  uses its `export/embed.html` endpoint and Yandex Maps uses the public map
  widget, both keyless. Prezi uses its public embed URL. SlideShare
  presentations use its oEmbed iframe on desktop, while Flickr, Dailymotion,
  Reddit, and Speaker Deck provide oEmbed/API cards. Reddit is oEmbed-only
  because Reddit no longer serves unauthenticated JSON. Providers use browser
  fetch on web and the native HTTP bridge on desktop; unsupported or blocked
  requests fall back to the plain chat link.
- **Amazon Previews**: Added URL-derived Amazon product cards on web and
  desktop. The card uses the product ASIN and URL slug, links to the canonical
  product page, and never fetches the Amazon page or uses PA-API/Creators API.
- **Web Metadata Previews**: Added verified generic web allowlisting for NPR,
  Fox News, The Independent, DW, W3C, and Apache. Added CORS-compatible named
  cards for Wikipedia, Internet Archive, Stack Overflow, Fandom, X, Write.as,
  and Lemma. Generic web pages outside the allowlist are not fetched.
- **Tier D Previews**: Added desktop metadata cards for public pages using Open
  Graph, Twitter Card, and JSON-LD fields. Manual previews are always available;
  Show Media Previews controls automatic Tier A/C previews and Show Metadata
  Previews controls automatic Tier B/D previews and is available on web for
  named web-capable providers and the generic allowlist. Added desktop JSON/XML
  oEmbed discovery, GitHub repository cards using the public API, Gitea/Forgejo,
  Bitbucket, and GitLab repository cards, itch.io game cards, and GameTracker
  server cards using the page title and full-width server banner. Tier B
  failures fall back to page metadata, Tier C player failures fall back to Tier
  B oEmbed cards and then Tier D page metadata on desktop or allowlisted web
  hosts, and failed Tier D cards remove their preview handles.
- **Desktop Chat Logs**: Added local SQLite chat history with FTS search,
  configurable retention, redaction handling, and a desktop search dialog.
  Redacted messages retain their local text and are marked in search results.
  Search results load historical context around the target, with gap markers and
  controls to load missing context in either direction. Unjoined channels use a
  temporary read-only local-log History buffer rather than rejoining, and
  exhausted server-history gaps can open local log context.

### Changed

- **Raw Buffer**: Raw protocol lines now bypass message formatting, URL,
  channel, user, emoji, and preview processing, and use a compact monospace row
  instead of the normal message layouts. Timestamps, `[S]`/`[C]` prefixes, and
  visible control glyphs are preserved.
- **WHO Polling**: The away-status fallback now runs every three minutes instead
  of every 30 seconds and skips channels with more than 100 users. A stale loop
  also stops when its buffer has been removed and replaced by another buffer
  with the same name.
- **Chat Logs**: Jumping to a searched or linked message now briefly highlights
  the target message so it is easy to find in the buffer.
- **Tooling**: `npm run lint` and `npm run format` now include the desktop
  Electron and desktop script code.
- **Message Search**: The search dialog now follows the selected theme. The
  header search button is hidden when no search source is available. The state
  browser button now appears only on desktop layouts while a special buffer is
  selected; it is hidden in restricted single-network mode without a source and
  disabled otherwise. Unloaded local results use the same load flow as server
  results; if server history cannot reach a local result, the result changes to
  Open Log and opens a local context buffer.
- **History**: Hidden-only chathistory batches now advance a separate cursor and
  continue loading older batches automatically. Trimming clears that cursor so
  the next request starts from the oldest remaining message.
- **History**: Trimming now restores Load Previous Messages and requests older
  history from the oldest remaining message. Trimming is delayed briefly after
  returning to the bottom and cancelled if the user scrolls back up.
- **File Uploads**: Upload results are appended to the originating buffer's chat
  input instead of being sent immediately, preserving any existing draft.
- **Desktop**: `allowRegisterProtocolHandler` now defaults to `true` for desktop
  installations. The default IRC client action still requires Personal startup
  and a configured gateway.
- **App Settings**: Reordered Channel Defaults and shortened its labels.
- **Chat Messages**: Reorganized message settings, renamed preview and nickname
  labels, defaulted presence changes off, and defaulted desktop scrollback to
  500 messages.
- **App Settings**: Moved preview controls to Appearance and the direct-message
  block control to General, with shorter labels.
- **Chat Messages**: The Show Message Info on Touch setting now only appears on
  devices that report touch input.
- **Timestamps**: Added a Time System selector for 12-hour, 24-hour, and decimal
  time. Custom `timestamp_format` values continue to render as configured and
  hide the selector.
- **Autocomplete**: Tab accepts the highlighted suggestion, while Enter accepts
  it and sends the message. Space and punctuation type normally instead of
  selecting it, while the arrow keys and Shift+Tab navigate the list.
- **App Settings**: Added an Appearance category for theme and monospaced font
  controls in the General tab, and a per-network tab named after the active
  network for persistence, typing, bot, rerouting, redaction, and notification
  controls. Renamed the network controls to Redacted Messages, Desktop
  Notifications, and Register Web Push.
- **File Uploads**: The preferred upload service and service-specific retention
  settings are now global. Added desktop-only Catbox, Filebin, ShareBin.eu,
  Uguu~, and WebDAV services alongside Litterbox, including Catbox user hashes,
  ShareBin retention, chunked ShareBin uploads, and WebDAV access URLs, optional
  Basic auth, and unique timestamp-and-random upload names. Networks default to
  preferring FILEHOST when available, with a per-network Use FILEHOST setting.
  Per-network service and retention overrides were removed.
- **Notifications**: Server messages no longer count as activity by default, and
  team highlights are enabled by default.
- **Chat Input**: The color picker is shown by default. Emoji shortcode
  conversion while typing is now off by default and its control moved to the
  Chat Input section.
- **Nicklist**: Away users are grouped and nicklist avatars are enabled by
  default.
- **Desktop**: Channel topics are shown in the header by default.
- **Avatars**: Local identicons remain the default fallback, with local initials
  available as another fallback style. Local initials and identicons use the
  nickname colour when Show Avatar Background is disabled.
- **Link Preview Cards**: Native link preview cards now follow the bridge card
  layout with a left accent border, content-first hierarchy, and thumbnails
  below the text. Thumbnails open in the media lightbox instead of navigating
  away from the chat. Descriptions wrap without a line clamp and remain subject
  to the 600-character content cap.
- **Bridge Cards**: `Description:` labels are stripped from bridge card bodies.
  `URL:` lines become the card link instead of visible text, and clicking the
  card outside its thumbnails or body links opens that URL. `Image:` lines are
  parsed as media: a single image with no thumbnail becomes the card thumbnail,
  while additional or multiple images render outside the card in a lightbox
  gallery.
- **Desktop Previews**: Desktop now defaults to hiding bridged preview cards.
  Set `buffers.hide_preview_cards` to `false` in `config.json5` to show them by
  default.
- **App Settings**: Renamed “Hide Preview Cards” to “Hide Bridged Previews” on
  desktop and web.
- **Profile Transfer**: Profile import is limited to Personal setup mode. Export
  remains available in every setup for migration to a personal installation.

### Removed

- **Avatars**: Removed the DiceBear Rings fallback style and shortened the
  DiceBear Gaze label to “DiceBear Gaze” so long option labels no longer widen
  settings dropdowns.
- **Network Settings**: Removed the Network Preferences block. Its persistence,
  typing, rerouting, bot filtering, redaction, FILEHOST, notification, and Web
  Push controls now live in the active network's App Settings tab. Limnoria
  settings are provided by the `suggest-limnoria` plugin block.
- **App Settings**: Removed the redundant Export State troubleshooting action.
  `kiwi.log.getLogBuffer()` remains available for raw log diagnostics.
- **Legacy Bouncer Config**: Removed the unused top-level `bnc` object,
  `startupOptions.bouncer`, the `kiwiBnc` and `znc` startup aliases, and the
  `znc` preset-network type alias. Personal startup now restores a saved bouncer
  control connection automatically.
- **App Settings**: Removed the Show User Hostnames control. The
  `buffers.show_hostnames` setting remains available through config.
- **Themes**: Removed the special Custom Theme URL field. Theme URLs are always
  loaded as `<url>/theme.css`, and a theme named `Custom` is treated like any
  other theme.
- **Limnoria**: Removed the Limnoria Prefix setting. Channel-delivered commands
  now use `<LimnoriaName>: <command>`, and commands typed in a PM with Limnoria
  are sent without a prefix.
- **Autocomplete**: Removed the Limnoria-specific remote autocomplete path.
  `/lim`, `/msg <bot>`, and channel commands now use only local suggestions;
  remote requests use `/auto` or always-auto mode.

### Fixed

- **Raw Log**: Internal buffers such as `*raw`, the server buffer, and special
  buffers now trim immediately instead of waiting for the history grace period.
  Their rendered rows are capped to the configured scrollback, and the message
  list refreshes after trimming, so opening `*raw` no longer stalls the UI.
- **Chat History**: Parse IRCv3 server-time tags when building chathistory
  cursors and history windows, include queued messages when checking whether a
  batch is displayable, and paginate from the oldest event in a batch. Loading
  previous history no longer re-fetches the same window or hides the control on
  busy channels. Preserve chathistory metadata through nested labeled-response
  batches, treat `draft/chathistory-end` per request direction, suppress false
  latest-to-live gaps, and request automatic history for channels created after
  the network is ready. Internal buffers no longer maintain live history
  segments, unloaded server search results load their context on first click and
  jump on the next, and gap controls expand the intended older or newer side.
- **File Uploads**: Uploaded links are now tracked as pending messages and
  confirmed by the server echo, so the sender no longer sees a duplicate copy.
- **Desktop Settings**: The default IRC handler action is only offered on
  HTTP(S) origins, and registration failures are ignored instead of surfacing an
  unexpected error in the desktop shell.
- **WebDAV Uploads**: The WebDAV password is now retained in the desktop secret
  store and restored on startup instead of being dropped from the saved secrets.
- **Desktop Connection**: Disabled renderer background throttling so IRC
  keepalives and reconnect timers keep running while the window is minimized or
  behind another application. Stalled connection attempts now time out instead
  of leaving the UI on **Connecting…** indefinitely.
- **Remote Autocomplete**: The first bot response now starts a clean suggestion
  list, so stale local commands no longer hide remote completions.
- **Channel Header**: Topic preview handles now open previews in the pinned
  media area.
- **Avatars**: Center the local identicon grid within circular avatars.
- **Real Names**: Realnames shown in the modern message list now render IRC
  formatting, links, and emoji, matching the user box.
- **Link Preview Cards**: Description text now wraps up to four lines instead of
  truncating to one line. Long unbroken tokens wrap safely, and the existing
  600-character limit remains as the content cap.
- **Reddit Previews**: Extensionless `share.redd.it/preview/post` and
  `/preview/comment` links now render as direct image previews.
- **Amazon Previews**: Removed the ASIN image fallback. The legacy
  `/images/P/<ASIN>` endpoint can return a 1×1 tracking pixel, and the real
  product image ID cannot be derived from the ASIN without fetching the page or
  using a gated API. Amazon cards are now text-only.
- **Desktop Media**: Fixed native HTTP address lookups on Node runtimes that
  request all DNS addresses, restoring direct image/audio/video previews.
- **Desktop Embeds**: Added a valid HTTPS Referer for YouTube, Twitch, and Vimeo
  embed requests, and a desktop-specific Twitch `parent` value, so those players
  work under the `app://` origin. Twitch player `frame-ancestors` responses now
  allow the `app:` origin without disabling the rest of Twitch's CSP, restoring
  desktop channels, clips, and VODs.

### Fixed

- **Network Settings**: Show direct WebSocket paths in the main server field and
  select WebSocket transport with the protocol picker instead of a redundant
  advanced checkbox.
- **Desktop Chat Logs**: Match word prefixes in search so `otter` finds
  `otters`.
- **Desktop Menus**: Fixed Reload and Force Reload being blocked by the exit
  warning, added a native close confirmation, removed the nonfunctional Window
  menu on Linux and Windows, and open the configuration folder instead of
  relying on a JSON5 file association.
- **IRC Protocol**: Casefold user and channel state with the negotiated
  `CASEMAPPING`, apply negated `RPL_ISUPPORT` tokens, and fall back to the
  modern `(ov)@+` `PREFIX` only when the server does not advertise one.
- **Chat & Input**: Preserve empty trailing IRC parameters, enforce advertised
  byte limits for `/join`, `/topic`, `/kick`, `/away`, and `/nick`, and send
  long multiline messages in grapheme-safe chunks so emoji and ZWJ sequences are
  never split.
- **History**: `CHATHISTORY` timeouts now start when a request is sent, retry
  with backoff, and keep manual history loading available instead of disabling
  it.
- **Read Markers**: Read state now follows the exact sent `MARKREAD` timestamp,
  correlates labeled responses with pending markers, reuses the message's local
  time to avoid clock-offset drift, uses timestamp references when no `msgid` is
  available, treats `MARKREAD *` as no stored marker, and ignores stale server
  markers.
- **Connection Lifecycle**: Reconnects now reset connection-scoped state, cancel
  stale timers and batch queues, ignore late socket and SASL callbacks, scope
  gateway channels to their own socket, dispose probe channels, and defer
  bouncer saves until a controller is available.
- **Startup Connect**: Temporary and Remember Me off flows no longer reset the
  live network after connecting, duplicate connect calls are ignored during
  negotiation, and probe channels cannot collide with network channel IDs.

### Fixed

- **Desktop Embeds**: Embed load errors now share one IPC listener, avoiding
  listener-limit warnings when many embeds are open. Removed duplicate
  `allowfullscreen` attributes in favor of `allow="… fullscreen …"`.
- **Performance**: Hidden raw buffers now keep a bounded lightweight backlog
  instead of creating full messages and trim timers for every raw line. Batch
  tick timers are shared per tick, empty trim timers are no longer cleared, IRC
  ping-timeout resets are coalesced during event bursts, in-order messages no
  longer trigger a full scrollback sort, and late messages are inserted in order
  instead of re-sorting the scrollback. Radio waveform colours are cached
  between theme changes, and message-list scroll checks are coalesced per
  animation frame.
- **Shutdown**: Replaced the deprecated `unload` handler with `pagehide`, so
  connection shutdown no longer triggers the Chromium unload policy violation.
- **Mobile Layout**: Limited the mobile state-browser drawer width, stacked the
  search dialog controls for narrow screens, and updated the bundled NephDeck
  and NephWave chrome offsets to follow the new drawer width. NephDeck app
  settings now sit inside its mobile chrome instead of under it.
- **Connections**: Added an HTTPS mixed-content warning when a direct ws://
  endpoint is configured, recommending wss:// or an IRC gateway instead.
- **Plugins**: Exposed the Link Preview module to plugins, fixing the Radio
  plugin's missing-module warning during startup.

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
