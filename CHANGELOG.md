# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Implemented full support for IRCv3 `cap-notify` extension, including handling
  of `CAP NEW` and `CAP DEL` messages.
- Implemented full support for the IRCv3 `+reply` and `+draft/reply` client-only
  tag extensions.
- Implemented full support for the IRCv3 `+draft/react` and `+draft/unreact`
  client-only tag extensions, including reactive per-message tracking and a
  curated selection of reactions in the message info overlay.
- Added unified "Message Actions" horizontal hover menu for all layouts
  (Modern, Compact, Inline).
- Added stable architectural separation between internal numeric IDs and
  reactive IRCv3 `irc_id` (`msgid`) tags.
- Added authoritative message ID promotion logic to correlate server echoes
  with locally sent messages.
- Added native Unicode emoji support with a high-performance, searchable
  picker.
- Added support for instant `:shortcode:` to Unicode conversion as you type.
- Added horizontal quick-reaction toolbar with integrated "More Reactions"
  modal using the new Emoji Picker.
- Added "Reply" functionality to the `MessageInfo` overlay for touch devices.
- Added reply context previews with "click-to-scroll" functionality to all
  message layouts (Modern, Compact, and Inline).
- Added support for SASL SCRAM-SHA-256 authentication mechanism using the modern Web Crypto API.
- Added full support for the IRCv3 `account-tag` extension for robust, per-message user identification.
- Added full support for the IRCv3 `batch` extension, including specialized handling for `netsplit`, `netjoin`, and `draft/multiline` batch types. Implemented a robust Batch Middleware to support nested batches and recursive resolution (e.g., multiline messages within chathistory).
- Implemented authoritative sending of multiline messages using the `draft/multiline` extension, featuring automatic chunking, `draft/multiline-concat` support, and strict adherence to server-advertised `max-bytes` and `max-lines` limits.
- Added standards-compliant `ACCOUNTEXTBAN` negotiation with prioritized detection of authoritative ISUPPORT tokens.
- Added reactive `enabled_caps` and `isupport` tracking to the network state for
  real-time protocol capability and support checks.
- Fixed `+typing` support check to strictly use the `+typing` tag name for
  `CLIENTTAGDENY` compliance.

### Changed

- Strictly verified capability negotiation: implemented selective `CAP REQ`
  based on `CAP NEW` advertised capabilities.
- Modernized browser support: officially dropped support for IE11 and legacy
  (EdgeHTML) Edge. Target baseline is now aligned with modern web standards
  (Chrome, Firefox, Safari 15+, Chromium Edge).
- Optimized Babel configuration: transitioned to `useBuiltIns: 'usage'` and
  shared `@babel/runtime` for more efficient, targeted polyfilling and smaller
  bundle sizes.
- Refactored input logic: simplified `IrcInput.vue` by removing legacy
  clipboard and HTML parsing workarounds originally required for IE.
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

- Removed legacy polyfills: `Element.closest`, `whatwg-fetch`, and
  `intersection-observer` are no longer included in the core bundle.
- Removed legacy dependencies: uninstalled `isomorphic-textencoder` in favor of
  native global `TextEncoder`/`TextDecoder` APIs.

### Fixed

- Resolved scroller instability: refined `onListResize` logic to prevent
  aggressive "jumps" to the bottom during layout shifts or window resizing.
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
