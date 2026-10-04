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
- Added hover-activated reply buttons to individual messages for desktop users
  across all layouts.
- Added "Reply" functionality to the `MessageInfo` overlay for touch devices.
- Added reply context previews with "click-to-scroll" functionality to all
  message layouts (Modern, Compact, and Inline).
- Added reactive `enabled_caps` and `isupport` tracking to the network state for
  real-time protocol capability and support checks.
- Fixed `+typing` support check to strictly use the `+typing` tag name for
  `CLIENTTAGDENY` compliance.

### Changed

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

### Fixed

- Stabilized project environment: verified successful build, lint, and unit
  tests (78/78 passed) on Node v26.4.0.
- Migrated project from `yarn` to `npm`: updated documentation, GitHub Actions,
  and environment configuration.
- Fixed `stylelint` configuration and dependency compatibility issues.
- Resolved various linting errors across the codebase.

### Security

- Updated `postcss` to ^8.5.28 to address multiple high-severity vulnerabilities
  (including Path Traversal and XSS).
- Applied security patches via `npm audit fix` for `node-forge`, `uuid`, and
  `webpack-dev-middleware`.
