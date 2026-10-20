# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Bouncer**: Added support for the IRCv3 `bouncer-networks` extension
  (`draft/bouncer-networks`, else `soju.im/bouncer-networks`) for modern
  bouncers such as Soju, replacing the previous KiwiBNC-specific support. The
  control connection appears as an always-visible "BNC" network, so
  `/msg BouncerServ` and `/quote BOUNCER ...` work directly, and its errors are
  shown in that buffer. Bouncer-managed networks use explicit Save and
  Connect/Reconnect buttons that send only changed attributes. The startup
  screen uses BNC, Account, and Register tabs chosen by the capability probe,
  with per-tab remembered credentials and field-name hover hints. SASL
  credentials can be turned into a reviewable `sasl set-plain` command for
  `BouncerServ`.
- **Bouncer**: `draft/persistence` and webpush are requested and configured on
  the bouncer control connection, and `soju.im/FILEHOST` uploads use the bouncer
  account. Features the bouncer did not advertise continue to use the upstream
  account.
- **Metadata**: When a server advertises `max-keys=0`, Kiwi IRC no longer sends
  `GET`, `SUB`, or `SET` for its own metadata keys. Soju's `soju.im/pinned`,
  `soju.im/muted`, and `soju.im/blocked` keys are still subscribed and mapped to
  the Favorite Channel, Never notify plus Mute Sounds, and Ignore User settings.
- **Accounts and login**: The welcome screen's Anonymous, Account, and Register
  tabs now have independent Advanced fields: nick, username (IRC ident), real
  name (GECOS), server password, and channel list. Lengths follow the server's
  `NICKLEN`, `USERLEN`, and `NAMELEN`, server passwords reject whitespace, and
  the Register tab shows a password-strength meter and account-registration
  length hints. Account names are stripped at the first `@` or `/` to suggest
  the nick. The user box registration form now places email after password,
  shows the same strength meter, uses `new-password` and `email` autocomplete
  hints, and enforces the server's password length limits.

### Changed

- **Login**: Field labels now describe the underlying value ("IRC Nick", "IRC
  User", "Real Name", "SASL Account", "SASL Password", "Channel Key"), and a
  saved anonymous network starts on the Anonymous tab while first-time and
  account networks start on Account.
- **Network settings**: Server Details now groups credentials into IRC Auth and
  SASL Auth, allows live edits where the server supports them, locks fields that
  require a reconnect, and limits restricted mode to the server endpoint.
  Bouncer-managed networks use IRC/IRCS, default a missing port to 6697 or 6667,
  and keep the IRC user and real name separate from SASL credentials.
- **Network settings**: The Advanced section now orders Auto Commands (On
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

### Fixed

- Servers that echo messages without a `msgid` no longer show duplicate sends or
  report them as unconfirmed. History echoes never confirm a send, and rewritten
  text is matched when exactly one message is pending.
- **Network settings**: Disconnecting a live network now updates the network and
  channel state immediately, so channels show as disconnected and the Connect
  button returns. Stale socket closes during a reconnect attempt are ignored.
- The Information tab shows the server software from the `004` reply when the
  `002` reply names no version.
- Uncaught errors and promise rejections are logged and shown in the active
  buffer, and the startup error screen shows the error message instead of being
  blank.

## [2.0.0] - 2026-10-17

### Added

- **Themes and formatting**: Added a theme system with 39 built-in themes and a
  custom theme URL. Markdown-style formatting, IRC colours (0-99 and hex),
  spoilers, and a formatting toolbar with colour and emoji pickers. Emoji
  shortcodes convert while typing and on incoming messages.
- **Conversations**: Added threaded replies (`+reply`, falling back to
  `+draft/reply`), per-message reactions (`+draft/react`), typing indicators
  (`+typing`), long messages sent as one `draft/multiline` batch, and redaction
  (`draft/message-redaction`) with a confirmation prompt and click-to-reveal.
  Messages rerouted with `+channel-context` appear in the correct buffer.
- **History and read state**: Added `draft/chathistory` and
  `draft/event-playback` for gap-filling, including replayed joins, parts, and
  modes. `draft/read-marker` keeps read state in sync across sessions, and
  `echo-message` with `labeled-response` confirms outgoing messages.
- **Accounts and login**: Added SASL login, preferring `SCRAM-SHA-256` over
  `PLAIN`, with a "Remember me" toggle that can purge saved state and a separate
  "Remember password" toggle beneath it. The login page offers Anonymous,
  Account, and Register tabs driven by a pre-login server probe.
  `draft/account-registration` adds a Register Account action for connected
  guests and a Register tab when the probe sees `before-connect`, with an inline
  `VERIFY` step. `draft/persistence` adds a Preferred Persistence setting (Keep
  As-Is by default).
- **Profiles and branding**: Added `draft/metadata-2` and `draft/metadata-3` for
  display names, pronouns, descriptions, homepages, status, and
  contrast-adjusted colours, with a fallback avatar. `NETWORK` and `draft/ICON`
  brand the network, with an Ergo icon fallback and channel avatars.
- **Media and uploads**: Added image, audio, and video embeds, with iframe
  previews for YouTube, Twitch, SoundCloud, Spotify, Streamable, RedGifs, and
  Giphy. Imgur single images are shown as images. Uploads work from the input
  bar, file picker, drag-drop, and paste, through Litterbox or the server
  `FILEHOST` (`draft/FILEHOST`, then `soju.im/FILEHOST`), with per-user service
  and retention overrides.
- **Buffers and notifications**: Added favourite pinning and mute, plain-text
  buffer export, and desktop notifications independent of synthesized sounds.
- **Radio**: Added a built-in station player in the sidebar with a station list,
  starred stations, volume control, and a theme-coloured waveform.
- **Bridging and relays**: Bot messages prefixed with `<Name>` are attributed to
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
- **Same-origin links**: Same-origin document links, including `.svg`, now
  download instead of opening. Same-origin iframes are not rendered.
