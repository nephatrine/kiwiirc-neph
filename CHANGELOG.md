# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Themes**: Added 40 themes with a shared color system, including balanced
  separators on dark themes, and a custom theme URL.
- **Formatting**: Added Markdown-inspired formatting, IRC colors (0-99 and hex),
  theme-aware styles, a formatting toolbar with a hex picker, and an emoji
  picker. Shortcodes can be converted while typing and on incoming messages.
- **Conversations**: Added threaded replies (`+reply`, falling back to
  `+draft/reply`), per-message reactions (`+draft/react`), and typing indicators
  (`+typing`). Long messages can use `draft/multiline`. Redaction uses
  `draft/message-redaction`, with a confirmation prompt and click-to-reveal.
- **History and read state**: Added `draft/chathistory` and
  `draft/event-playback` for gap-filling, including replayed joins, parts, and
  modes. `draft/read-marker` keeps read state in sync across sessions.
  `echo-message` and `labeled-response` confirm outgoing messages. Also requests
  `extended-isupport`, `multi-prefix`, and `userhost-in-names`. `FAIL`, `WARN`,
  and `NOTE` are routed to the relevant buffer. The `standard-replies`
  capability is requested, and replies for unimplemented commands are shown
  generically.
- **Identity**: Added SASL login, preferring `SCRAM-SHA-256` over `PLAIN`, live
  `/setname` updates, and a "Remember me" toggle that can purge saved state.
  `draft/metadata-2` shows display names, pronouns, descriptions, homepages,
  status, and contrast-adjusted color. Away text takes precedence over social
  status. When a server advertises `draft/metadata-3` it is preferred, with
  channel joins subscribing rather than fetching outright. Includes a fallback
  avatar template and a warning when metadata will not persist. Ignored users
  stay hidden in history, and self-highlights are suppressed.
- **Media**: Added image, audio, and video embeds, including Discord and Shopify
  URLs. Iframe previews cover YouTube, Twitch, Streamable, RedGifs, and Giphy.
  Imgur single images are shown as images, not iframes. Links are parsed when
  the message arrives. The pinned viewer keeps sidebar alignment, and images
  open in a lightbox.
- **Buffers**: Added favorite pinning and mute, which dims a buffer and hides
  its unread count. Mentions use a short scale pulse. Buffers can be exported as
  plain text. Desktop notifications can be toggled separately from synthesized
  sounds.
- **File uploads**: Added optional uploads from the input bar, file picker,
  drag-drop, and paste. `fileupload.service` is `none` (default), `litterbox`,
  or `filehost`. Litterbox retention is `1h`, `12h`, `24h`, or `72h` (default
  `72h`). Users can override the service and retention even when the admin sets
  `none`. Successful uploads post the URL to the current channel or query;
  failures stay local. `filehost` is not a URL in config. It prefers
  `draft/FILEHOST`, then `soju.im/FILEHOST`, and only when a SASL account and
  password are available. Requests use HTTP Basic, refuse `http` when the client
  connection is marked TLS, and treat `201` plus `Location` as success.
- **Routing**: Added `+channel-context` rerouting with lenient and strict
  policies.
- **Branding**: Added `NETWORK` and `draft/ICON` support, with an Ergo icon
  fallback, plus channel avatars in headers and info panels.
- **Radio**: Added a built-in station player in the sidebar, inspired by the
  external kiwi radio plugin, with a station list, starred stations,
  click-to-play, volume control, a theme-colored waveform, and lock-screen
  integration. While a station plays, the current track is polled from the
  host's Icecast status feed and shown under the station name. Stations can
  override this with a `nowPlaying` URL or disable it with `nowPlaying: false`.
  Silent streams are reloaded automatically and marked as failed after repeated
  stalls. Player and channel-option buttons use larger touch targets on mobile.
- **Bridging and relays**: Bot messages prefixed with `<Name>` are attributed to
  the bridged user. The prefix is stripped, the bridged name gets its own nick
  color, and replies and message grouping follow the bridged identity. IRC
  formatting inside the brackets is stripped, the bot's channel mode prefix is
  hidden on bridged names, and a `+avatar` client-only tag supplies the avatar.
  `draft/relaymsg` is requested: relayed users get a limited profile panel with
  block/ignore actions and a link to the relaying bot instead of query and whois
  actions, and no server metadata is requested for them. Bots advertising
  `RELAYMETA` are queried over CTCP, with rate limiting and session caching, for
  relayed users' display names and avatars.
- **Diagnostics**: Added an anonymized state and log dump for troubleshooting.

### Changed

- **Message IDs**: Separated local message IDs from protocol IDs and added
  `protocol_target` tracking for reactions, replies, and redactions.
- **Interface**: Settings and headers follow network capabilities and viewport
  size.
- **Runtime**: Requires Node 22+ and modern browsers. Removed legacy IE11 and
  EdgeHTML polyfills.
- **Performance**: Reduced reactivity in message state and replaced image
  emoticons with Unicode emoji.
- **Reconnection**: Capped reconnect delays and heals channel joins after
  reconnect.
- **Channel list requests**: Deferred `LIST` for 30 seconds after connect. After
  a completed list, automatic fetches wait 30 minutes. Manual refresh and bare
  `/list` wait 5 minutes. In-flight lists are not resent. Filtered `/list` is
  sent only after the connect window and when no list is in flight; otherwise it
  is dropped. The refresh button stays disabled during the connect window and
  the 5-minute cooldown.

### Removed

- Removed support for legacy IE11 and EdgeHTML browsers and their polyfills.
- Removed the legacy BNC `bufferSeen` mechanism in favor of `draft/read-marker`.
- Removed `znc.in/self-message` support in favor of `echo-message`.
- Removed static `.mp3` and `.ogg` audio assets.

### Fixed

- **Security**: Updated dependencies, including PostCSS, to address known
  vulnerabilities.
- **History sync**: Stopped historical messages from disappearing and improved
  user discovery during busy logins.
- **Text selection**: Set `user-select: none` on persistent buttons so clicks do
  not insert a text cursor.
- **Spoilers**: Kept spoiler text hidden when the theme changes.
- **Same-origin links**: Same-origin document links, including `.svg`, now
  download instead of opening. Same-origin iframes are not rendered. Image,
  audio, and video embeds and the lightbox are unchanged.
