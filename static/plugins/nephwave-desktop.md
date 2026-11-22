# NephWave Desktop

## Overview

Desktop chrome for the NephWave theme: a titlebar, menu strip, taskbar, Start
menu, and system tray inspired by Windows 98, Mac OS Platinum, and BeOS.

The plugin is inert unless the active theme name starts with `nephwave`. The
NephWave theme remains usable without it.

The default configuration enables this plugin.

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
- Vapour-Net, Classic 98, Platinum 68K, and BeAesthetic presets.
- CRT scanline and vignette overlay.
- Synthesized clicks, beeps, and power-down sounds.
- Live clock, connection status, and now-playing readout.
- Titlebar minimize and taskbar restore for the messenger window.
- Start menu shortcuts for Control Panel, radio, About, and Shut Down.
- Taskbar shortcuts for the messenger window and radio browser.
- Compact chrome on narrow screens.
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

- `plugin-nephwave.preset` — Preset: `vapor` (default), `teal`, `platinum`, or
  `be`.
- `plugin-nephwave.crt` — Enables CRT scanlines and vignette. Default: `true`.
- `plugin-nephwave.sounds` — Enables synthesized UI sounds. Default: `false`.

Invalid values fall back to Vapour-Net, CRT on, and sounds off. Values are saved
only when the user changes them.

## Radio Integration

When the bundled Radio plugin is loaded, the Start menu and taskbar gain radio
shortcuts, and the tray uses the current radio track for its now-playing text.
The radio controls stay hidden when the radio service is unavailable.
