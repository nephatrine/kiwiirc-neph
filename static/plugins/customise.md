# Customise Starter

## Overview

`customise.html.example` is a starter file for site-specific CSS and small
JavaScript tweaks. It is not loaded by default. Use it for a local adjustment
when a full plugin is unnecessary.

## Use

1. Copy `customise.html.example` to `customise.html`.
2. Add your styles or small script.
3. Add the plugin entry to the `plugins` array:

```json
"plugins": [
    { "name": "customise", "url": "static/plugins/customise.html" }
]
```

Example:

```html
<style>
 .my-site-notice {
        font-weight: 700;
    }
</style>
```

Prefix custom classes and element IDs so they do not collide with bundled
plugins or themes.

## Notes

- `static/` is copied to `dist/static/` on a production build.
- Configuration and plugin files are public. Do not put secrets in them.
- For a full plugin, see [Plugin Development](../../PLUGINS.md).
