# NephNET Cyberdeck

Theme-specific cyberdeck chrome for the NephDeck themes.

## Enable

```json
"plugins": [
    { "name": "nephnet-cyberdeck", "url": "static/plugins/nephnet-cyberdeck.html" }
]
```

## Features

- Adds top hardware chrome, bottom navigation controls, and corner rivets.
- Adds CRT scanlines, vignette, phosphor, power, and audio controls.
- Synthesizes mechanical clicks, beeps, power-up, and power-down sounds with Web
  Audio.
- Adds a clock and network signal indicator.
- Triggers glitch effects on highlights, link changes, and palette switches.
- Supports the NephDeck Amber, Green, and Cyan palettes.

## Notes

The plugin is inert when a non-NephDeck theme is active. Its chrome styling
comes from the NephDeck theme stylesheets, so the plugin defines no global theme
styles of its own.
