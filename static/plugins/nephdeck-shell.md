# NephDeck Shell

## Overview

Cyberdeck chrome for the NephDeck theme: hardware-style top chrome, corner
rivets, navigation controls, a clock, a signal indicator, and CRT, phosphor, and
sound effects.

The plugin is inert unless the active theme name starts with `nephdeck`. The
NephDeck theme remains usable without it.

The default configuration enables this plugin.

## Enable

The default `plugins` list includes this entry:

```json
"plugins": [
    { "name": "nephdeck-shell", "url": "static/plugins/nephdeck-shell.html" }
]
```

Remove it from the `plugins` array to disable the plugin.

## Features

- Top hardware chrome, bottom navigation controls, and corner rivets.
- CRT scanlines, vignette, phosphor tint, power, and audio controls.
- Synthesized clicks, beeps, power-up, and power-down sounds.
- Clock and network signal indicator.
- Glitch effects on highlights, link changes, and preset switches.
- Amber, Green, and Cyan presets.
- Styling for the optional Cyberdeck message layout. The layout is available
  under Message Layout in App Settings for every theme.

## Controls

- Preset buttons switch the phosphor palette.
- The CRT button toggles scanlines and vignette.
- The audio button toggles UI sounds.
- The power button toggles the powered-on presentation.

Preset, CRT, and sound changes apply immediately without reloading the theme.

## Settings

Preferences use normal Kiwi user settings and have no config defaults:

- `plugin-nephdeck.preset` — Phosphor palette: `amber` (default), `green`, or
  `cyan`.
- `plugin-nephdeck.crt` — Enables CRT scanlines and vignette. Default: `true`.
- `plugin-nephdeck.sounds` — Enables synthesized UI sounds. Default: `false`.

Values are saved only when the user changes them. Power state is session-only
and is not persisted.
