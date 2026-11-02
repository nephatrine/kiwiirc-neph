# NephWave Desktop

## Overview

Windows 98, Mac OS Platinum, and BeOS-inspired desktop chrome for the NephWave
theme. The plugin is inert unless the active theme name starts with `nephwave`.

The default configuration enables this plugin. The NephWave theme remains usable
without it.

## Enable

The default `plugins` list includes this entry:

```json
"plugins": [
    { "name": "nephwave-desktop", "url": "static/plugins/nephwave-desktop.html" }
]
```

Remove it from the `plugins` array to disable the plugin.

## Features

- Desktop titlebar, menu strip, taskbar, Start menu, and system tray.
- Theme presets: Vapour-Net, Classic 98, Platinum 68K, and BeAesthetic.
- CRT scanline and vignette overlay.
- Synthesized UI clicks, beeps, and power-down sounds.
- Live clock, connection status, and now-playing readout from media display
  metadata.
- Titlebar minimize and taskbar restore for the messenger window.
- Start menu shortcuts for Control Panel, radio stations, About, and Shut Down.
- Taskbar shortcuts for the messenger window and radio station browser.
- Responsive compact chrome on narrow screens.
- Reduced-motion and high-contrast accommodations.

## Controls

- The menu bar cycles theme presets.
- The Start menu selects a preset, toggles CRT, toggles UI sounds, opens
  settings, opens the radio browser when available, shows About, or shuts down
  the chrome.
- The titlebar minimizes and restores the messenger window.
- The taskbar restores the messenger window or opens the radio browser.
- The system tray shows CRT and sound controls, now-playing text, connection
  status, and the clock.

## Settings

Preferences use normal Kiwi user settings and have no config defaults:

| Key                      | Default | Effect                                        |
| ------------------------ | ------- | --------------------------------------------- |
| `plugin-nephwave.preset` | `vapor` | Preset: `vapor`, `teal`, `platinum`, or `be`. |
| `plugin-nephwave.crt`    | `true`  | Enables CRT scanlines and vignette.           |
| `plugin-nephwave.sounds` | `false` | Enables synthesized UI sounds.                |

Missing or invalid values fall back to Vapour-Net, CRT on, and UI sounds off.
Values are saved only when the user changes them.

## Radio Integration

When the bundled radio plugin is loaded:

- The radio taskbar button and Start menu entry are shown.
- The radio browser opens through the radio service.
- Now-playing text comes from `kiwi.getMediaDisplay('radio')`.

When the radio service is unavailable, the radio controls stay hidden.

## Technical Details

- The plugin checks `kiwi.themes.currentTheme().name` and activates when the
  lowercase name starts with `nephwave`.
- It appends a `.nephwave-chrome` element to `<body>`.
- It uses body state classes:
  - `nephwave-active`
  - `nephwave-startup`
  - `nephwave-statebrowser`
  - `nephwave-minimized`
  - `nephwave-crt-on`, `nephwave-crt-off`
  - `nephwave-sounds-on`, `nephwave-sounds-off`
  - `nephwave-glitch`
  - `nephwave-preset-vapor`, `nephwave-preset-teal`, `nephwave-preset-platinum`,
    `nephwave-preset-be`
- It listens for `theme.change`, `theme.failed`, `message.new`, and
  `active.component`.
- It consumes the `radio` service and `kiwi.getMediaDisplay('radio')` when
  available.
- It exposes no public service.
- Its shell styling comes from the NephWave theme stylesheet, so the plugin
  defines no global theme styles of its own.
