# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Bouncer**: Added support for the IRCv3 `bouncer-networks` extension
  (`draft/bouncer-networks`, else `soju.im/bouncer-networks`) for modern
  bouncers such as Soju, replacing the previous KiwiBNC-specific bouncer
  support.
- **Bouncer**: The bouncer control connection now appears as an always-visible
  "BNC" network, so `/msg BouncerServ` and `/quote BOUNCER ...` can be used
  directly, bouncer errors are shown in its buffer, it no longer negotiates
  metadata, and it can never be saved to the bouncer as a network.
- **Bouncer**: SASL credentials entered for a network behind a Soju bouncer can
  be turned into a `sasl set-plain` command for `BouncerServ` from the network
  settings page, ready to review and send. The SASL fields stay visible on
  bouncer networks, and other bouncers show a notice that they must be
  configured by hand.
- **Bouncer**: Network settings for a bouncer-managed network are applied with
  explicit Save and Connect/Reconnect buttons. The form is diffed against the
  bouncer's last known state and only the changed attributes are sent, so a
  half-edited form is never written to the bouncer.
- **Metadata**: When a server advertises `max-keys=0`, Kiwi IRC no longer sends
  `GET`, `SUB`, or `SET` for its own metadata keys. Soju's `soju.im/pinned`,
  `soju.im/muted`, and `soju.im/blocked` keys are still subscribed: they map to
  the Favorite Channel, Never notify plus Mute Sounds, and Ignore User settings,
  and changing those settings sends the metadata back to keep Soju in sync.

### Changed

- Reduced the client bundle by roughly 70 KB by replacing several third-party
  libraries (`lodash`, `htmlparser2`, `xhr`, `ip-regex`, `murmurhash3js`, and
  `compare-versions`) with native browser APIs and small in-house helpers.
- Reduced the client bundle by a further ~16 KB by upgrading
  `i18next-http-backend` to v4, which no longer bundles its own fetch polyfill.
- Bouncer-hosted features are attributed to the bouncer: `draft/persistence` and
  webpush are requested on the control connection and configured there with the
  bouncer account, and `soju.im/FILEHOST` uploads use the bouncer credentials.
  Anything the bouncer did not advertise keeps using the upstream account.
- The preferred persistence setting is only sent when it is changed; a
  `PERSISTENCE STATUS` reply now updates the stored preference instead of the
  client correcting the server.
- Metadata subscriptions are one per-connection key list (`METADATA * SUB`),
  sent once at connect, instead of a separate `METADATA <channel|nick> SUB` for
  every joined channel and user. Joining a channel already delivers its metadata
  and its members' metadata for the subscribed keys, so joined channels are no
  longer polled for metadata every 30 minutes; only a stale query buffer is
  refreshed.

### Fixed

- A network bound through a bouncer no longer disconnects with "This server
  requires an account to connect": `draft/ACCOUNTREQUIRED` from the bouncer's
  own pre-BIND ISUPPORT is ignored on bouncer connections, where the bouncer
  login has already authenticated the session. If the upstream network needs an
  account of its own, the bouncer's reported connection error is shown instead.
- The bouncer `pass` attribute is now the upstream server password rather than
  the SASL password: `connection.password` is sent, and the SASL secret stays
  client-side unless it is given to Soju through `BouncerServ`.
- Messages to `BouncerServ` on the bouncer control connection no longer sit
  pending until the confirm timeout: the control connection requests only the
  capabilities it can use, so the bouncer's unlabelled echo is matched by its
  `msgid` instead of a `labeled-response` label that never comes back.
- A server that echoes messages without a `msgid` no longer shows each sent
  message twice and then reports it as unconfirmed: the echo is matched to the
  local pending copy by its raw text, whether or not the echo carries a message
  ID. Text rewritten by the server is matched when exactly one of our messages
  is pending, echoes replayed from chat history never confirm anything, and the
  confirm timeout still applies. Messages confirmed without a `msgid` have no
  `irc_id`, so they cannot be replied to, reacted to, or redacted.
- Logging out of a bouncer and back in no longer leaves a second, disconnected
  `BNC` network beside the connected one: the saved control connection is reused
  and leftovers from earlier logins are dropped on registration.
- The bouncer control connection's settings tab now shows its connection details
  disabled (like restricted mode) instead of hiding them, with a "managed by the
  bouncer" notice.
- The Information tab shows the server software reported in the `004` reply when
  the `002` reply names no version, so a bouncer connection shows its identity
  (for example `soju`) instead of `Unknown`.
- The settings page for a bouncer-managed network no longer locks itself and
  shows a do-nothing Disconnect button when the network's upstream link fails:
  the bouncer's own connection state and error are shown, the connection details
  stay editable, and Connect/Reconnect re-applies the changes and reconnects.
  Disconnecting could not affect a network the bouncer keeps alive.
- Errors that were previously silent are now reported: a bouncer network change
  that the bouncer rejects is shown in that network's server buffer and is not
  retried until something changes, uncaught errors and promise rejections are
  logged and shown in the active buffer, and the startup error screen shows the
  error message instead of being blank.

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
