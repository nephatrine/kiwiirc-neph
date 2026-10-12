# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Modern Theme Suite**: Integrated over 30 professional themes (Catppuccin,
  Nord, Rosé Pine, Tokyo Night, etc.) with unified normalization, strictly
  standardized color hierarchies, and mathematically balanced message separator
  colors for all dark themes.
- **Advanced Text Formatting**: Introduced an extensive formatting suite
  supporting Markdown-inspired syntax, native IRC colors (0-99/HEX), 'Fancy'
  theme-aware styles, and a responsive formatting toolbar with an integrated HEX
  color picker.
- **IRCv3 Protocol Hardening**: Comprehensive implementation of `echo-message`,
  `labeled-response`, `extended-isupport`, `multi-prefix`, `userhost-in-names`,
  `draft/metadata-2` (with resource limit enforcement), and `standard-replies`
  ensuring robust synchronization and error handling. Optimized metadata traffic
  via proactive fetch throttling and automated service-specific suppressions.
- **Message Redaction**: Support for `draft/message-redaction` with custom
  confirmation prompts and click-to-reveal behavior.
- **Authoritative History**: Implemented `draft/chathistory` and
  `draft/event-playback` for precise gap-filling including replayed joins,
  parts, and modes.
- **Advanced Messaging**: Full support for native Unicode emojis with a
  searchable picker, threaded replies (+reply), per-message reactions, and
  standardized read-markers.
- **Identity & Session Privacy**: Added explicit SASL account support,
  authoritative `/setname` updates, and a "Remember me" toggle with automatic
  state purging.
- **Synthesized Audio Earcons**: Replaced static assets with a low-latency Web
  Audio API synthesis engine featuring unique tonal sequences for notifications,
  errors, general chat activity, and successful network registration.
- **Intelligent Message Rerouting**: Implemented support for the
  `+channel-context` tag with flexible security policies.
- **Global Desktop Notification Toggle**: Added a user-configurable setting to
  enable or disable desktop alerts independently of audio notifications.
- **Enhanced Visual Activity**: Introduced scale-pulse animations for mentions
  to improve discoverability in background buffers.
- **Buffer Content Export**: Added functionality to download clean,
  human-readable plain text logs for any active buffer.
- **Diagnostic Troubleshooting**: Integrated a diagnostic state dump engine with
  sensitive data masking.
- **Authoritative Branding**: Implemented support for `NETWORK`, `draft/ICON`
  (with automatic Ergo fallback), and channel-specific avatars in headers and
  information panels.
- **Enriched Social Context**: Integrated support for `draft/metadata-2` to
  display user pronouns, display names, descriptions, and homepages in profile
  cards. Also introduced an application-wide fallback avatar template system,
  real-time status synchronization, a contrast-aware social color engine,
  dynamic user ignoring (hiding historical traffic), self-highlight suppression,
  and contextual metadata persistence warnings.
- **Robust Media Embedding**: Integrated a comprehensive media detection and
  rendering engine supporting direct images, audio, and video files (including
  complex URLs from Discord and Shopify).
- **Official Platform Integration**: Added native, script-free iframe support
  for **YouTube** (Landscape & Shorts), **Twitch** (Channels & Clips),
  **Streamable**, **RedGifs**, **Giphy**, and **Imgur**.
- **Intelligent Aspect Ratio Sizing**: Implemented responsive containers for
  16:9 and 9:16 content with double-constraint scaling to prevent layout shifts
  and eliminate vertical scrolling in the pinned viewer.
- **Global Image Lightbox**: Added a centered, darkened full-screen overlay for
  viewing images at full resolution with global Escape-key support.
- **Eager Link Processing**: Refactored the state engine to parse links
  instantly upon message ingestion, ensuring 100% consistent auto-expansion and
  respecting per-channel whitelists.
- **Pinned Workspace Optimization**: Refactored the top-fixed media viewer to
  preserve sidebar alignment and provide centered, cinematic previews.
- **Channel Prioritization**: Introduced high-visibility "Favorite" pinning to
  the top of the sidebar and "Silenced" de-prioritization (dimming and hidden
  unread counts) for improved buffer management.

### Changed

- **Architecture**: Separated internal message IDs from authoritative protocol
  tags and added `protocol_target` tracking for spec-compliant interactions.
- **UI/UX Intelligence**: Optimized settings and headers to dynamically react to
  network capabilities and viewport sizes.
- **Modernized Environment**: Updated requirements to Node 22+ and transitioned
  to modern browser targets, removing legacy IE11/EdgeHTML polyfills.
- **Performance**: Optimized message state management and replaced legacy
  image-based emoticons with native Unicode rendering.
- **Reconnection Logic**: Hardened connection handlers with capped delays and
  authoritative "join healing".

### Removed

- Removed support for legacy IE11/EdgeHTML browsers and associated polyfills.
- Removed legacy proprietary BNC `bufferSeen` mechanism in favor of
  `draft/read-marker`.
- Deprecated `znc.in/self-message` support in favor of `echo-message`.
- Removed static `.mp3` and `.ogg` audio assets.

### Fixed

- **Security**: Addressed high-severity dependency vulnerabilities including
  PostCSS updates.
- **Synchronization**: Fixed "vanishing" historical messages and improved user
  discovery during high-traffic logins.
- **Chrome UI Stability**: Applied `user-select: none` to all persistent UI
  buttons to prevent accidental text cursor insertion.
- **Spoiler Fidelity**: Hardened spoiler rendering to ensure content remains
  hidden regardless of theme adjustments.
