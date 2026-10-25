# NephWave Desktop

Windows 98, Mac OS Platinum, and BeOS-inspired desktop chrome for the NephWave
theme.

## Enable

```json
"plugins": [
    { "name": "nephwave-desktop", "url": "static/plugins/nephwave-desktop.html" }
]
```

The default plugin list includes it. It is inert unless the `NephWave` theme is
active. The theme remains usable without the plugin.

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

## Settings

Preferences use normal Kiwi user settings and have no config defaults:

- `plugin-nephwave.preset`
- `plugin-nephwave.crt`
- `plugin-nephwave.sounds`

Missing settings fall back to Vapour-Net, CRT on, and UI sounds off. Values are
saved only when the user changes them.

## Notes

The plugin appends its shell to `<body>` and uses body state classes, so Vue
re-renders cannot remove the chrome. It builds no global theme styles; the
NephWave theme stylesheet provides the shell styling.
