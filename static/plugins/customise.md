# Customise Starter

`customise.html.example` is a starter file for site-specific CSS and small
JavaScript customisations.

## Use

1. Copy `customise.html.example` to `customise.html`.
1. Add custom styles or plugin code.
1. Load it through `plugins`:

```json
"plugins": [
    { "name": "customise", "url": "static/plugins/customise.html" }
]
```

The example is not loaded by default. For plugin API details, see
[PLUGINS.md](../../PLUGINS.md). More examples are available in the Kiwi IRC
plugin examples wiki.
