# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Modern Theme Suite**: Integrated over 30 professional themes (Catppuccin,
  Nord, Rosé Pine, Tokyo Night, etc.) with unified UI normalization and
  optimized contrast.
- **IRCv3 Protocol Hardening**: Comprehensive implementation of `echo-message`,
  `labeled-response`, and `standard-replies` ensuring robust synchronization and
  error handling.
- **Message Redaction**: Support for `draft/message-redaction` with custom
  confirmation prompts and spoiler-style click-to-reveal behavior.
- **Advanced Messaging**: Full support for native Unicode emojis with a
  searchable picker, threaded replies (`+reply`), per-message reactions
  (`+draft/react`), and standardized read-markers (`draft/read-marker`).
- **Intelligent Message Rerouting**: Implemented support for the
  `+channel-context` tag with lenient and strict security policies.
- **Metadata-Synchronized History**: Gated history requests by metadata
  readiness (End of NAMES, MARKREAD boundary) to ensure accurate filtering and
  rerouting.
- **Global Desktop Notification Toggle**: Added a user-configurable setting to
  enable or disable desktop alerts independently of audio notifications.
- **Authoritative History**: Implemented `draft/chathistory` and
  `draft/event-playback` for precise gap-filling including replayed joins,
  parts, and modes.
- **Identity & Session Privacy**: Added explicit SASL account support,
  authoritative `/setname` updates, and a "Remember me" toggle with automatic
  state purging.
- **Synthesized Audio Earcons**: Replaced static assets with a low-latency Web
  Audio API synthesis engine featuring unique tonal sequences for notifications
  and errors.
- **Centralized Error Feedback**: Integrated automatic audio alerts and visual
  vibrating indicators with "!" markers for all protocol and UI failures.
- **Enhanced Visual Activity**: Introduced scale-pulse animations for mentions
  to improve discoverability in background buffers.
- **Buffer Content Export**: Added functionality to download clean,
  human-readable plain text logs for any active channel or private query.
- **Diagnostic Troubleshooting**: Integrated a diagnostic state dump engine with
  sensitive data masking to assist with technical support.
- **UI/UX Refinements**: Added a "Message Actions" hover menu, reactive "Network
  Information" tab, and project-wide accessibility tooltips.

### Changed

- **Architecture**: Separated internal message IDs from authoritative `msgid`
  tags to ensure protocol compliance for all advanced features. Added
  `protocol_target` tracking for spec-compliant interactions.
- **Branding Architecture**: Introduced a dedicated `--brand-online` variable to
  ensure status indicators remain distinct from primary theme accents.
- **UI/UX Intelligence**: App Settings now dynamically hide options based on
  network capabilities (Typing, Redactions, Bot filters).
- **Modernized Environment**: Updated requirements to Node 22+ and transitioned
  to modern browser targets, removing legacy IE11/EdgeHTML polyfills.
- **Performance**: Optimized message state management and replaced legacy
  image-based emoticons with native Unicode rendering. Capped single-chunk
  history requests for better memory hygiene.
- **Reconnection Logic**: Hardened connection handlers with capped delays and
  authoritative "join healing" to improve stability.
- **Diagnostics**: Increased `*raw` buffer scrollback to 5000 lines.

### Removed

- Removed support for legacy IE11/EdgeHTML browsers and associated polyfills.
- Removed legacy proprietary BNC `bufferSeen` mechanism in favor of the
  standardized `draft/read-marker` protocol.
- Deprecated `znc.in/self-message` support in favor of the ratified
  `echo-message` standard.
- Removed static `.mp3` and `.ogg` audio assets in favor of programmatic
  client-side synthesis.

### Fixed

- **Security**: Addressed multiple high-severity dependency vulnerabilities
  including an update to `postcss` to ^8.5.28.
- **Reactivity**: Fixed inconsistent away status indicators and user discovery
  gaps during high-traffic logins.
- **Synchronization**: Fixed "vanishing" historical messages by sanitizing
  boundary references and synchronizing metadata handshakes.
