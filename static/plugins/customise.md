# Customise Starter

## Overview

`customise.html.example` is a starter file for site-specific CSS and small
JavaScript customisations. It is not loaded by default.

Use it when you need a small deployment-specific tweak and do not need a
separate plugin package. For a full plugin, start with
[Plugin Development](../../PLUGINS.md) instead.

## Use

1. Copy `customise.html.example` to `customise.html`.
2. Add custom styles or plugin code.
3. Add the plugin entry to the `plugins` array:

```json
"plugins": [
    { "name": "customise", "url": "static/plugins/customise.html" }
]
```

The example file is not loaded until you create `customise.html` and add the
entry.

## What to Put in It

- Theme overrides and small layout fixes in a `<style>` block.
- Small `kiwi.plugin()` callbacks for site-specific behavior.
- Calls to `kiwi.require()` for in-house helpers and components.

Keep classes and template IDs prefixed so they do not collide with bundled
plugins or themes.

```html
<style>
 .my-site-notice {
        font-weight: 700;
    }
</style>
<script>
 kiwi.plugin('customise', (kiwi, log) => {
    log.info('Customise plugin loaded');
});
</script>
```

## Notes

- `static/` is copied to `dist/static/` on a production build.
- Configuration and plugin files are public; do not put secrets in them.
- The starter is intentionally small. The bundled plugin documentation linked
  from [Plugin Development](../../PLUGINS.md) has complete examples.
