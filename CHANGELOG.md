# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Massive Theme Suite**: Integrated over 30 professional themes including
  **Catppuccin** (all variants), **Nord**, **Everforest**, **Rosé Pine**,
  **Gruvbox**, **Kanagawa**, **Solarized**, **Ayu**, **One**, **GitHub**,
  **Tokyo Night**, **Monokai**, and **SynthWave '84**.
- **Session Privacy & Isolation**: Added "Remember me on this computer"
  functionality and implemented an identity guard that automatically purges
  local state on nickname or account changes to prevent cross-account data
  leakage.
- **Authoritative Logout**: Implemented a global `logout()` method that issues a
  `QUIT` command to the server and performs a full workspace reset.
- **Deduplication Engine**: Added strict message deduplication using
  server-assigned `irc_id` (`msgid`) to prevent duplicate entries during history
  replays and gap-filling.
- Implemented support for IRCv3 `echo-message` and `labeled-response` extensions
  for robust message synchronization and multi-client consistency.
- Added a **Network Information** tab displaying IRCd details, negotiated
  capabilities, and ISUPPORT tokens.
- Added support for explicit SASL account names during connection and startup.
- Added support for the IRCv3 `draft/event-playback` extension for more complete
  history synchronization.
- Added support for the `draft/chathistory-end` tag to authoritatively detect
  history exhaustion.
- Added support for the `draft/chathistory-context` tag to identify historical
  messages in the state.
- Added `/setname` command to authoritatively update the user's real name
  (gecos) via the IRCv3 extension.
- Implemented queue-based message correlation to ensure reactions and replies
  resolve correctly during high-volume history playback.
- Added descriptive tooltips and accessibility labels across the primary
  application UI.
- Implemented full support for IRCv3 `cap-notify` extension, including handling
  of `CAP NEW` and `CAP DEL` messages.
- Implemented full support for the IRCv3 `+reply` and `+draft/reply` client-only
  tag extensions.
- Implemented full support for the IRCv3 `+draft/react` and `+draft/unreact`
  client-only tag extensions, including reactive per-message tracking and a
  curated selection of reactions in the message info overlay.
- Added unified "Message Actions" horizontal hover menu for all layouts (Modern,
  Compact, Inline).
- Added stable architectural separation between internal numeric IDs and
  reactive IRCv3 `irc_id` (`msgid`) tags.
- Added authoritative message ID promotion logic to correlate server echoes with
  locally sent messages.
- Added native Unicode emoji support with a high-performance, searchable picker.
- Added support for instant `:shortcode:` to Unicode conversion as you type.
- Added horizontal quick-reaction toolbar with integrated "More Reactions" modal
  using the new Emoji Picker.
- Added "Reply" functionality to the `MessageInfo` overlay for touch devices.
- Added reply context previews with "click-to-scroll" functionality to all
  message layouts (Modern, Compact, and Inline).
- Added support for SASL SCRAM-SHA-256 authentication mechanism using the modern
  Web Crypto API.
- Added full support for the IRCv3 `account-tag` extension for robust,
  per-message user identification.
- Added full support for the IRCv3 `batch` extension, including specialized
  handling for `netsplit`, `netjoin`, and `draft/multiline` batch types.
  Implemented a robust Batch Middleware to support nested batches and recursive
  resolution (e.g., multiline messages within chathistory).
- Implemented authoritative sending of multiline messages using the
  `draft/multiline` extension, featuring automatic chunking,
  `draft/multiline-concat` support, and strict adherence to server-advertised
  `max-bytes` and `max-lines` limits.
- Added support for the IRCv3 Bot Mode specification, including persistent
  visual indicators (`🤖`) for bot users and bot-authored messages, and a new
  "Hide all bot messages" safety setting.
- Added standards-compliant `ACCOUNTEXTBAN` negotiation with prioritized
  detection of authoritative ISUPPORT tokens.
- Added reactive `enabled_caps` and `isupport` tracking to the network state for
  real-time protocol capability and support checks.
- Fixed `+typing` support check to strictly use the `+typing` tag name for
  `CLIENTTAGDENY` compliance.

### Changed

- **Intelligent History Sync**: Refactored history loading to use
  `CHATHISTORY LATEST` for background synchronization and optimized the
  reference engine to ignore non-conversation metadata.
- **UI Normalization**: Standardized header backgrounds and normalized color
  palettes across all themes to ensure maximum legibility for all 16 IRC message
  colors.
- **Reconnection Resilience**: Hardened connection handlers to ignore stale
  closure events and implemented "join healing" when receiving member lists or
  messages.
- Refactored message promotion logic to utilize IRCv3 labels for precise, O(1)
  correlation of server echoes.
- Centralized capability negotiation logic to ensure consistent feature
  availability during both initial and dynamic phases.
- Updated typing notifications to ignore echoes of the client's own typing
  status.
- Relocated user "Real Name" to the profile header in the User Box for better
  visibility.
- Reorganized emoji settings into specific toggles for incoming rendering and
  outgoing conversion.
- Updated default reconnection logic to cap delays at 30 seconds with 10
  retries.
- Strictly verified capability negotiation: implemented selective `CAP REQ`
  based on `CAP NEW` advertised capabilities.
- Modernized browser support: officially dropped support for IE11 and legacy
  (EdgeHTML) Edge. Target baseline is now aligned with modern web standards
  (Chrome, Firefox, Safari 15+, Chromium Edge).
- Optimized Babel configuration: transitioned to `useBuiltIns: 'usage'` and
  shared `@babel/runtime` for more efficient, targeted polyfilling and smaller
  bundle sizes.
- Refactored input logic: simplified `IrcInput.vue` by removing legacy clipboard
  and HTML parsing workarounds originally required for IE.
- Standardized CSS architecture: removed legacy vendor prefixes (`-ms-`,
  `::-ms-`) and IE-specific layout hacks across all themes and components.
- Modernized emoji system: replaced legacy image-based emoticons with native
  Unicode characters for better performance and OS-consistent rendering.
- Renamed "Reply in private" to "Private Message" to prevent terminology
  confusion with IRCv3 threads.
- Increased hover gutter padding for all layouts to ensure action badges never
  obscure message text.
- Refactored the codebase to use reactive `NetworkState` properties for all
  capability and `ISUPPORT` checks, enabling the UI to respond instantly to
  dynamic updates.
- Updated **Compact** and **Inline** message layouts to dynamically adjust their
  right margins when timestamps are disabled, optimizing screen space.
- Bumped minimum Node version requirement to 22.0.0.
- Upgraded Stylelint ecosystem to v17 and migrated stylistic rules to
  `@stylistic/stylelint-plugin`.
- Updated core dev dependencies (`i18next`, `less`, `jsdoc`,
  `vue-eslint-parser`, `copy-webpack-plugin`) to their latest stable versions
  within peer dependency constraints.
- Aligned Jest ecosystem to v27 to ensure clean, conflict-free `npm install`
  without flags.

### Removed

- Deprecated and removed support for `znc.in/self-message` in favor of the
  ratified `echo-message` standard.
- Removed all legacy fallbacks to internal numeric IDs in protocol-facing tags
  and message lookups.
- Removed legacy polyfills: `Element.closest`, `whatwg-fetch`, and
  `intersection-observer` are no longer included in the core bundle.
- Removed legacy dependencies: uninstalled `isomorphic-textencoder` in favor of
  native global `TextEncoder`/`TextDecoder` APIs.

### Fixed

- Fixed unwanted whitespace in the Compact and Inline message layouts between
  nickname prefixes and nicknames.
- Resolved scroller instability: implemented a real-time scroll listener to
  ensure the auto-scroll state stays synchronized with the user's position,
  preventing aggressive "jumps" to the bottom during layout shifts or window
  resizing.
- Stabilized touch UI safety: disabled threaded reply/reaction buttons in the
  `MessageInfo` overlay for local-only or legacy messages.
- Stabilized project environment: verified successful build, lint, and unit
  tests (83/83 passed) on Node v26.4.0.
- Migrated project from `yarn` to `npm`: updated documentation, GitHub Actions,
  and environment configuration.
- Resolved various linting errors across the codebase.

### Security

- Updated `postcss` to ^8.5.28 to address multiple high-severity vulnerabilities
  (including Path Traversal and XSS).
- Applied security patches via `npm audit fix` for `node-forge`, `uuid`, and
  `webpack-dev-middleware`.
