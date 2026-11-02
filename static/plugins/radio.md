# Radio

## Overview

Bundled station player with sidebar controls and a station browser. It plays
HTTP/HTTPS streams, shows now-playing metadata when available, and reports
playback through the client media API.

The default configuration enables this plugin.

## Enable

The default `plugins` list includes this entry:

```json
"plugins": [
    { "name": "radio", "url": "static/plugins/radio.html" }
]
```

Remove it from the `plugins` array to disable the plugin.

The default station file is `static/plugins/radio/stations.json`. If it does not
exist, the player stays disabled without showing a load error. A relative URL is
resolved against the page, so the default works in a subdirectory install. Copy
[static/plugins/radio/stations.example.json](radio/stations.example.json) there,
or set `plugin-radio.url` to another stations file.

## Settings

Preferences use normal Kiwi user settings. The plugin registers these defaults
itself, so there is no config-template block.

| Key                           | Default                              | Notes                                                                           |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `plugin-radio.url`            | `static/plugins/radio/stations.json` | Stations JSON5. Empty disables the player.                                      |
| `plugin-radio.volume`         | `0.4`                                | `0` to `1`.                                                                     |
| `plugin-radio.starred`        | `[]`                                 | Station names. Users usually set this in the player.                            |
| `plugin-radio.active`         | `""`                                 | Last station name.                                                              |
| `plugin-radio.showWave`       | `true`                               | Waveform. Playback does not require it.                                         |
| `plugin-radio.autoPlay`       | `false`                              | If true, waits for a click before playing.                                      |
| `plugin-radio.forceVolume`    | `false`                              | Start at the admin volume and do not save a user volume until the slider moves. |
| `plugin-radio.reloadOnOpen`   | `false`                              | Fetch the station list again when the list opens.                               |
| `plugin-radio.forceShowClose` | `false`                              | Reserved. The station list always has a close control.                          |

Administrators can set defaults under `plugin-radio` in configuration. Users
override them through normal settings.

## Station File

The station file is parsed as JSON5, so plain JSON works unchanged.

| Field         | Required | Meaning                                                                                                                         |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | No       | Display and accessibility name. Falls back to `source`.                                                                         |
| `image`       | No       | Station artwork. Must be `http`/`https` or a root-relative path such as `/static/stations/logo.png`.                            |
| `source`      | Yes      | Stream URL. Must be `http` or `https`. On an HTTPS page, `http` streams are dropped.                                            |
| `description` | No       | Description text.                                                                                                               |
| `channels`    | No       | String of channel names. Clicking one joins it.                                                                                 |
| `nowPlaying`  | No       | `false` disables metadata polling. A URL supplies a custom metadata endpoint. Omitted uses the stream host's `status-json.xsl`. |

Stations without a valid `source` are dropped. Invalid images are dropped while
the station remains available.

When `nowPlaying` is omitted, the plugin polls Icecast-style `status-json.xsl`
metadata and matches the stream filename. It also checks the sibling `.mp3`
entry when the stream is Ogg. A custom `nowPlaying` URL may return either
Icecast status JSON or a simple `{ "title": "..." }` object.

## Using the Player

- Sidebar controls provide play/pause, previous/next, mute, volume, and the
  station browser.
- The station browser lists stations, shows artwork and descriptions, and can
  join station channels.
- Stations can be starred. Starred stations sort first.
- `autoPlay` waits for the first document click before starting the last
  station.
- The waveform is visual only; playback works without it.
- Playback failures are marked per station and stop playback for that station.

## Service API

The plugin registers a public `radio` service:

```js
const service = kiwi.getService('radio');
if (service && service.enabled()) {
    service.openBrowser();
}
```

Service methods:

| Method          | Returns    | Meaning                                                                    |
| --------------- | ---------- | -------------------------------------------------------------------------- |
| `enabled()`     | Boolean    | True when a station URL is configured and the station file is not missing. |
| `getRadio()`    | Controller | Returns the shared radio controller.                                       |
| `openBrowser()` | Boolean    | Opens the station browser. Returns false when the player is disabled.      |

The controller returned by `getRadio()` exposes:

| Member                    | Meaning                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ui`                      | Reactive player state, including stations, loading, error, playing, muted, current station name, browser-open state, failed stations, waveform state, track title, and missing-file state. |
| `setting(name, fallback)` | Reads a `plugin-radio.*` setting with a fallback.                                                                                                                                          |
| `enabled()`               | Player availability.                                                                                                                                                                       |
| `volume()`                | Effective volume, including `forceVolume`.                                                                                                                                                 |
| `current()`               | Current station object or `null`.                                                                                                                                                          |
| `loadStations()`          | Reloads the station file.                                                                                                                                                                  |
| `play(station)`           | Plays a station object with a valid `source`.                                                                                                                                              |
| `playCurrent()`           | Plays the current or last station.                                                                                                                                                         |
| `pause()`                 | Stops playback.                                                                                                                                                                            |
| `toggle()`                | Toggles play/pause.                                                                                                                                                                        |
| `skip(step)`              | Moves by `1` or `-1` through the station list.                                                                                                                                             |
| `setVolume(value)`        | Sets volume from `0` to `1` and unlocks the user volume.                                                                                                                                   |
| `toggleMute()`            | Toggles mute.                                                                                                                                                                              |
| `isStarred(name)`         | Checks a station name against the starred list.                                                                                                                                            |
| `toggleStar(name)`        | Adds or removes a station name from the starred list.                                                                                                                                      |
| `stopWave()`              | Stops the waveform animation.                                                                                                                                                              |

## Styling

Themes can restyle the player through the existing `.kiwi-radio-*` class names.

## Attribution

Station playback is adapted from
[kiwiirc-plugin-radio](https://github.com/ItsOnlyBinary/kiwiirc-plugin-radio)
(Apache-2.0).
