# NephNET Cyberdeck

## Overview

Theme-specific cyberdeck chrome for the NephDeck theme. The plugin is inert
unless the active theme name starts with `nephdeck`.

The default configuration enables this plugin.

## Enable

The default `plugins` list includes this entry:

```json
"plugins": [
    { "name": "nephnet-cyberdeck", "url": "static/plugins/nephnet-cyberdeck.html" }
]
```

Remove it from the `plugins` array to disable the plugin. The NephDeck theme
remains usable without it.

## Features

- Adds top hardware chrome, bottom navigation controls, and corner rivets.
- Adds CRT scanlines, vignette, phosphor, power, and audio controls.
- Synthesizes mechanical clicks, beeps, power-up, and power-down sounds with Web
  Audio.
- Adds a clock and network signal indicator.
- Triggers glitch effects on highlights, link changes, and preset switches.
- Supports the Amber, Green, and Cyan presets inside the unified NephDeck theme.
- Styles the optional Cyberdeck message layout with cassette-deck rails, avatar
  bezels, and phosphor accents. The layout is available under Message Layout in
  App Settings for every theme.

## Controls

- Preset buttons switch the phosphor palette.
- The CRT button toggles scanlines and vignette.
- The audio button toggles UI sounds.
- The power button toggles the powered-on presentation.

Preset, CRT, and sound changes apply immediately without reloading the theme.

## Settings

Preferences use normal Kiwi user settings and have no config defaults:

| Key                      | Default | Effect                                         |
| ------------------------ | ------- | ---------------------------------------------- |
| `plugin-nephdeck.preset` | `amber` | Phosphor palette: `amber`, `green`, or `cyan`. |
| `plugin-nephdeck.crt`    | `true`  | Enables CRT scanlines and vignette.            |
| `plugin-nephdeck.sounds` | `false` | Enables synthesized UI sounds.                 |

Values are saved only when the user changes them. Power state is session-only
and is not persisted.

## Technical Details

- The plugin checks `kiwi.themes.currentTheme().name` and activates when the
  lowercase name starts with `nephdeck`.
- It appends a `.nephnet-chrome` element to `<body>`.
- It uses body state classes:
  - `nephnet-deck-active`
  - `nephnet-deck-statebrowser`
  - `nephnet-deck-startup`
  - `nephnet-deck-crt-on`, `nephnet-deck-crt-off`
  - `nephnet-deck-powered-off`
  - `nephnet-deck-power-on`, `nephnet-deck-power-off`
  - `nephnet-deck-glitch`
  - `nephdeck-preset-amber`, `nephdeck-preset-green`, `nephdeck-preset-cyan`
- It listens for theme changes and client events used by the signal and glitch
  effects.
- It exposes no public service.
- Its chrome styling comes from the NephDeck theme stylesheet, so the plugin
  defines no global theme styles of its own.
