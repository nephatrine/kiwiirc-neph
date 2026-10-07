# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Modern Theme Suite**: Integrated over 30 professional themes (Catppuccin,
  Nord, Rosé Pine, Tokyo Night, etc.) with unified UI normalization and
  optimized contrast for all 16 IRC colors.
- **IRCv3 Protocol Hardening**: Comprehensive implementation of `echo-message`,
  `labeled-response`, and `standard-replies` ensuring robust message
  synchronization, precise error handling, and multi-client consistency.
- **Message Redaction**: Support for `draft/message-redaction` allowing
  permanent removal of messages with informative placeholders and a
  "spoiler-style" click-to-reveal toggle.
- **Advanced Messaging**: Full support for native Unicode emojis with a
  searchable picker, threaded replies (`+reply`), per-message reactions
  (`+draft/react`), and authoritative multiline sending.
- **Authoritative History**: Implemented `draft/chathistory` and
  `draft/event-playback` for gap-filling synchronization, including replayed
  joins, parts, and mode changes.
- **Identity & Session Privacy**: Added explicit SASL account support,
  authoritative `/setname` updates, and a "Remember me" toggle with automatic
  state purging on identity changes.
- **UI/UX Refinements**: Added a "Message Actions" hover menu, reactive "Network
  Information" tab, and project-wide accessibility tooltips.

### Changed

- **Architecture**: Separated internal message IDs from authoritative `msgid`
  tags to ensure protocol compliance for all advanced features.
- **Performance**: Optimized message state management to reduce CPU overhead
  during high-volume traffic.
- **Modernized Environment**: Updated requirements to Node 22+ and transitioned
  to modern browser targets (Chrome, Firefox, Safari 15+).
- **Emoji System**: Replaced legacy image-based emoticons with native Unicode
  characters.
- **Reconnection Logic**: Hardened connection handlers with capped delays and
  authoritative "join healing" to improve stability.

### Removed

- Removed support for legacy IE11/EdgeHTML browsers and their associated
  polyfills.
- Deprecated `znc.in/self-message` support in favor of the ratified
  `echo-message` standard.

### Fixed

- Resolved scroller instability and "jumping" issues across all message layouts.
- Fixed numerous layout and whitespace inconsistencies in the Compact and Inline
  views.
- Stabilized state transitions to prevent data leakage between different IRC
  accounts.

### Security

- Updated `postcss` to ^8.5.28 to address multiple high-severity
  vulnerabilities.
- Applied security patches via `npm audit fix` for various dependencies.
