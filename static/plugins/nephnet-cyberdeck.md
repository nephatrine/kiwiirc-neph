# NephNET Cyberdeck

Theme-specific cyberdeck chrome for the NephDeck theme.

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
- Triggers glitch effects on highlights, link changes, and preset switches.
- Supports the Amber, Green, and Cyan presets inside the unified NephDeck theme.

## Settings

Preferences use normal Kiwi user settings and have no config defaults:

- `plugin-nephdeck.preset` — `amber`, `green`, or `cyan`; defaults to `amber`
- `plugin-nephdeck.crt` — defaults to `true`
- `plugin-nephdeck.sounds` — defaults to `false`

Preset changes apply immediately without reloading the theme. Values are saved
only when the user changes them.

## Notes

The plugin is inert when a non-NephDeck theme is active. Its chrome styling
comes from the NephDeck theme stylesheet, so the plugin defines no global theme
styles of its own.
