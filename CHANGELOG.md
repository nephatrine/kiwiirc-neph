# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Themes**: Added NephWave, a standalone theme with the optional NephWave
  Desktop shell plugin.

- **Twitch**: Added Twitch IRC support, requesting `twitch.tv/commands`,
  `twitch.tv/tags`, and `twitch.tv/membership` when advertised. Twitch tags
  drive message IDs, display names, colors, timestamps, replies, reroute
  markers, emotes/GIFs, and room/user state, and unknown chatters are created on
  their first message. Twitch commands are handled instead of shown as unknown
  lines: `CLEARCHAT`/`CLEARMSG` redact messages, `ROOMSTATE` posts mode changes,
  `USERNOTICE` renders rich event cards, `RECONNECT` allows one reconnect, and
  notices are classified where appropriate. Twitch connections also suppress
  client PING, `LIST`, `WHO`, and `WHOIS`, show the Twitch icon and channel
  topic, display owner/mod/VIP/subscriber prefixes, and send `/me` and replies
  in Twitch's format.

- **Bouncer**: Added IRCv3 `bouncer-networks` support (`draft/bouncer-networks`,
  else `soju.im/bouncer-networks`) for modern bouncers such as Soju. The control
  connection appears as an always-visible "BNC" network, managed networks use
  explicit Save and Connect/Reconnect actions, and the startup screen offers
  BNC, Account, and Register tabs based on the capability probe. Persistence,
  webpush, and FILEHOST uploads use the bouncer account when advertised.

- **Bouncer**: Added `bouncer-networks-notify` support. The control connection
  negotiates one matching `draft/` or `soju.im/` notify capability, consumes the
  initial network list and incremental add/change/remove notifications, and
  skips `LISTNETWORKS` when notifications are available.

- **Metadata**: Servers advertising `max-keys=0` no longer receive Kiwi's own
  metadata requests, while Soju's pinned, muted, and blocked keys remain mapped
  to their settings.

- **Plugins**: Added an app-level `addUi('app', ...)` mount point, an
  `input.activity` event, and a generic media playback registry.

- **Accounts & Login**: The Welcome screen's Anonymous, Account, and Register
  tabs now have independent Advanced fields, with server-advertised length
  limits, SASL/server-password validation, a password-strength meter, and nick
  suggestions. The user box registration form uses the same password rules and
  autocomplete hints.

- **Link Previews**: Extensionless X/Twitter media preview URLs
  (`*.x.com/images/media-preview/<id>`) are now recognised as images, adding the
  preview handle and enabling auto-embed where the whitelist allows it.

- **Icons**: Networks named `Libera.Chat` now use the bundled Libera logo when
  the server does not advertise `DRAFT/ICON`.

### Changed

- **Icons**: Replaced Font Awesome 4.7 with a self-hosted Boxicons 2.1.4
  webfont. Icons now use `bx` and `bxs` classes, and the build emits only the
  woff2 font.
- **Per-Network Settings**: Desktop Notifications, Persistence Preference, Share
  Typing, Lenient Rerouting, Ignore Bots, Show Redactions, and file-upload
  service/retention now belong to each network.
- **Web Push**: Push notifications are now a per-network opt-in instead of a
  global user setting. Turning desktop notifications off suspends only that
  network's registration without clearing its opt-in.
- **FILEHOST**: Account `/network` and `@client` suffixes are stripped from the
  SASL account before HTTP Basic authentication.
- **Themes**: NephDeck is now one theme with Amber, Green, and Cyan presets.
  Preset, CRT, and sound preferences persist under `plugin-nephdeck.*` instead
  of switching between three separate themes.
- **Plugins**: Renamed the bundled channels sidebar file to
  `static/plugins/channels-sidebar.html`; update custom `plugins` URLs that used
  the old `plugin-channels-sidebar.html` name.
- **Login**: Field labels now describe the underlying value ("IRC Nick", "IRC
  User", "Real Name", "SASL Account", "SASL Password", "Channel Key"), and a
  saved anonymous network starts on the Anonymous tab while first-time and
  account networks start on Account.
- **Custom Server**: The preset picker is labelled Network, and normal IRC
  connections now use the Welcome-style Anonymous and Account tabs with the same
  Advanced fields and validation. Preset endpoints are probed once per endpoint
  to choose which tabs to show; custom endpoints skip the probe and keep the
  manual Bouncer tab. Bouncer presets use the Bouncer page's BNC and Account
  tabs, validation, and probe-driven availability, but never offer Register.
- **Connection Picker**: When no `kiwiServer` gateway is configured, `IRC` and
  `IRCS` are no longer offered. Custom endpoints, presets, and pasted gateway
  URIs use direct `WS`/`WSS` instead. Bouncer-managed network settings keep
  their IRC/IRCS TLS labels.
- **Network Settings**: Server Details now groups credentials into IRC Auth and
  SASL Auth, allows live edits where the server supports them, locks fields that
  require a reconnect, and limits restricted mode to the server endpoint.
  Bouncer-managed networks use IRC/IRCS, default a missing port to 6697 or 6667,
  and keep the IRC user and real name separate from SASL credentials.
- **Network Settings**: The Advanced section now orders Auto Commands (On
  Connect), Raw Buffer (Requires Reload), Direct Websocket, Protocol Encoding,
  and SASL Mechanism. Raw scrollback and the Direct Websocket URL appear only
  when their option is enabled.
- Reduced the client bundle by roughly 86 KB by replacing several third-party
  libraries (`lodash`, `htmlparser2`, `xhr`, `ip-regex`, `murmurhash3js`, and
  `compare-versions`) with native APIs and small in-house helpers, and upgrading
  `i18next-http-backend` to v4.
- **Metadata**: Subscriptions now use one per-connection key list sent at
  connect, instead of a separate `METADATA <channel|nick> SUB` for every joined
  channel and user. Joined channels are no longer polled every 30 minutes; only
  a stale query buffer is refreshed.
- **Themes**: Action buttons use consistent online/primary/warning colors and
  hover states, disabled form controls are visibly dimmed, and NephDeck no
  longer applies a background to the input wrapper or shows its power button on
  startup screens.
- **Radio**: Moved the station player into the bundled
  `static/plugins/radio.html` plugin, loaded by default. Its settings now use
  `plugin-radio.*` instead of `radio.*`; rename existing config keys manually.
  The default station file is `static/plugins/radio/stations.json`; a missing
  file quietly disables the player. Plugins can expose and consume named
  services with `kiwi.registerService()` and `kiwi.getService()`; NephWave uses
  the new `radio` service.
- **Emoji**: Emoji categories, shortnames, aliases, and variation selectors now
  follow JoyPixels emoji-toolkit metadata. The picker can limit emoji to a
  maximum Unicode version with `emojiPickerMaxVersion`; the setting appears only
  while the picker is enabled. Known emoji in messages, display names,
  descriptions, and other metadata are wrapped in `kiwi-emoji` spans with an
  emoji font stack and a shortcode tooltip.
- **Build**: Production builds now minify theme CSS, plugin HTML/CSS/JS, and
  locale JSON in `dist/static/`. Config files, station lists, and other static
  data remain readable.

### Removed

- **Embedly**: Removed optional Embedly card support and the `embedly`
  configuration. Existing `embedly` blocks are ignored and can be removed.
  Native media previews are unchanged.

### Fixed

- **SASL**: A `900` account reply arriving after `001` is now captured, so
  direct Soju connections populate the SASL account and offer Web Push.

- **Current Account**: Services UI and command suggestions now use a tracked
  current account. It defaults to the stripped SASL account and updates from
  explicit self WHO/WHOX/WHOIS/ACCOUNT/account-tag/extended-join reports.

- **Ignore Bots**: The Ignore Bot Messages setting is now shown on networks that
  advertise `BOT` and hidden on networks that do not.

- **Connection**: Auto-reconnect no longer leaves a direct WebSocket network
  stuck in Connecting after the final attempt fails, and a connecting attempt
  can be cancelled from the network list, buffer, and network settings.

- **History**: Pending chathistory requests are cleared on disconnect and
  reconnect, so "Loading previous messages..." no longer sticks and later
  requests are not queued behind a dead batch.

- **Link Previews**: Links with no native media type no longer show preview
  handles, inline cards, or Message Info preview buttons. Native media embeds
  are unchanged.

- **Reconnect Notice**: A first-time channel join after an early reconnect uses
  the normal join message instead of "has reconnected."

- **Sidebar**: Link preview handles in sidebar topic, description, and realname
  text now open the URL in the pinned media viewer instead of doing nothing.

- **Login**: Reusing a saved network now adopts the current startup transport
  settings, so switching a deployment from a gateway to a direct websocket no
  longer keeps trying the old gateway and requesting `/info`.

- Servers that echo messages without a `msgid` no longer show duplicate sends or
  report them as unconfirmed. History echoes never confirm a send, and rewritten
  text is matched when exactly one message is pending.

- **Network Settings**: Disconnecting a live network now updates the network and
  channel state immediately, so channels show as disconnected and the Connect
  button returns. Stale socket closes during a reconnect attempt are ignored.

- The Information tab shows the server software from the `004` reply when the
  `002` reply names no version.

- Uncaught errors and promise rejections are logged and shown in the active
  buffer, and the startup error screen shows the error message instead of being
  blank.

- **Web Push**: Per-network service workers now wait for activation before
  subscribing, retry once a service worker becomes active, and remove the legacy
  shared registration. Notifications are coalesced by message ID, clicks route
  to the matching buffer, and registration/failure state is shared across tabs.
  A per-network Reset Browser Push action clears broken subscriptions.

- **Network Preferences**: Option labels in Network Settings now stack instead
  of sharing the app-settings label layout, so each preference reads on its own
  line.

- **WHO**: WHO requests now use a per-network throttled queue that sends one at
  a time, deduplicates targets, and backs off after a `263` rate limit. The
  periodic loop no longer stalls without a WHO reply, and MOTD handling no
  longer repeats history/WHO bursts on `/motd`.

- **NephWave**: Unread, mention, and error notification counts now use distinct
  colors, including the drawer badge, instead of sharing one style.

- **Startup**: A configured `greetingText` now stays in place when the probe
  reports a `NETWORK` name, while probe `DRAFT/ICON` URLs still render and
  replace `{size}` with `64`.

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
