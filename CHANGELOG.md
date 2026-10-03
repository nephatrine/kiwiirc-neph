# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Created `MIGRATION.md` outlining the technical strategy for Vue 3 migration.

### Changed
- Bumped minimum Node version requirement to 22.0.0.
- Upgraded Stylelint ecosystem to v17 and migrated stylistic rules to `@stylistic/stylelint-plugin`.
- Updated core dev dependencies (`i18next`, `less`, `jsdoc`, `vue-eslint-parser`, `copy-webpack-plugin`) to their latest stable versions within peer dependency constraints.
- Aligned Jest ecosystem to v27 to ensure clean, conflict-free `npm install` without flags.

### Fixed
- Stabilized project environment: verified successful build, lint, and unit tests (72/72 passed) on Node v26.4.0.
- Migrated project from `yarn` to `npm`: updated documentation, GitHub Actions, and environment configuration.
- Fixed `stylelint` configuration and dependency compatibility issues.
- Resolved various linting errors across the codebase.

### Security
- Updated `postcss` to ^8.5.28 to address multiple high-severity vulnerabilities (including Path Traversal and XSS).
- Applied security patches via `npm audit fix` for `node-forge`, `uuid`, and `webpack-dev-middleware`.
