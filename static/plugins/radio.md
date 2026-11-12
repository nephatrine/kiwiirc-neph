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
exist, the player interface stays visible with an empty station browser. A
relative URL is resolved against the page, so the default works in a
subdirectory install. Copy
[static/plugins/radio/stations.example.json](radio/stations.example.json) there,
or set `plugin-radio.url` to another stations file.

## Settings

Preferences use normal Kiwi user settings. The plugin registers these defaults
itself, so there is no config-template block.

| Key                           | Default                              | Notes                                                                           |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `plugin-radio.url`            | `static/plugins/radio/stations.json` | Stations JSON5.                                                                 |
| `plugin-radio.enabled`        | `true`                               | Enables the player interface and controls.                                      |
| `plugin-radio.nowPlaying`     | `true`                               | Fetches station metadata and track information automatically. Per-station settings still apply. |
| `plugin-radio.showStationIcons` | `true`                             | Shows station artwork in the station browser.                                    |
| `plugin-radio.customStations` | `[]`                                 | User-added stations with name, stream URLs, homepage, icon, description, and now-playing URL. |
| `plugin-radio.hiddenStations` | `[]`                                 | Stream sources hidden from the configured station file.                          |
| `plugin-radio.waveStyle`      | `bars`                               | `none`, `bars`, `mirror`, `wave`, `area`, `led`, `pulse`, or `peaks`.           |
| `plugin-radio.showWave`       | `true`                               | Legacy fallback used when `waveStyle` is unset.                                 |
| `plugin-radio.volume`         | `0.4`                                | `0` to `1`.                                                                     |
| `plugin-radio.starred`        | `[]`                                 | Station names. Users star stations from the station browser.                    |
| `plugin-radio.active`         | `""`                                 | Last station name.                                                              |
| `plugin-radio.autoPlay`       | `false`                              | If true, waits for a click before playing.                                      |
| `plugin-radio.forceVolume`    | `false`                              | Start at the admin volume and do not save a user volume until the slider moves. |
| `plugin-radio.reloadOnOpen`   | `false`                              | Fetch the station list again when the list opens.                               |
| `plugin-radio.forceShowClose` | `false`                              | Reserved. The station list always has a close control.                          |

Administrators can set defaults under `plugin-radio` in configuration. Users
override them through normal settings. The General settings tab includes a
Radio block for Enable Radio, Fetch Station Metadata, Show Station Icons, and
Show Waveform.

## Station File

The station file is parsed as JSON5, so plain JSON works unchanged.

| Field         | Required | Meaning                                                                                                                         |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | No       | Display and accessibility name. Falls back to the first stream URL.                                                            |
| `image`       | No       | Station artwork. Must be `http`/`https` or a root-relative path such as `/static/stations/logo.png`.                            |
| `sources`     | Yes*     | Ordered list of stream URLs. Must be `http` or `https`. On an HTTPS page, `http` streams are dropped.                            |
| `source`      | Yes*     | Legacy single stream URL. Used when `sources` is absent.                                                                       |
| `homepage`    | No       | Station homepage opened from the browser.                                                                                      |
| `description` | No       | Description text.                                                                                                               |
| `nowPlaying`  | No       | `false` disables automatic metadata fetching. A URL supplies a custom metadata endpoint. Omitted uses the stream host's Icecast or Shoutcast status. |

\* One of `sources` or `source` is required. Stations without a valid stream URL
are dropped. Invalid images are dropped while the station remains available.
Streams are tried in order until one succeeds.

## Managing Stations

- Use **Add Station** in the station browser to add a user station.
- User stations can be edited or removed.
- Stations from the configured station file can be removed from the browser
  without editing the file. They remain recoverable from **Hidden Stations**.
- Custom stations and hidden file stations persist under the settings listed
  above.
- Stream URLs are entered one per line, in preference order. Playback falls
  back to the next URL if one fails.
- A station homepage can be provided and is opened from the station browser.
- Icon URLs accept `http`/`https` and root-relative paths. On desktop, **Choose
  Image** copies a local image into the existing `kiwi-icon://` storage and uses
  that internal URL.
- Channel names inside station descriptions remain clickable links; the old
  dedicated station `channels` field has been removed.

When `nowPlaying` is omitted, the plugin tries the stream host's Icecast
`status-json.xsl`, then Shoutcast v2 `/stats?sid=1&json=1`. It matches the
active stream source, including fallback sources, and also checks the sibling
`.mp3` entry when the stream is Ogg. A custom `nowPlaying` URL may return
Icecast status JSON, Shoutcast status JSON, or a simple `{ "title": "..." }`
object.

### Desktop Metadata

The desktop app sends these requests through its native HTTP bridge, so they
are not limited by browser CORS. The web client keeps the browser's normal
CORS behavior.

When the station browser opens, the desktop app enriches station entries in the
background:

- It probes each stream source with `HEAD` for `icy-name`, `icy-genre`,
  `icy-description`, `icy-url`, and bitrate headers.
- If a homepage is available, it reads OpenGraph metadata for the description
  and artwork.
- Results fill empty fields in the station browser but are kept in memory. For
  user stations, opening **Edit Station** prefills the enriched values, and
  saving persists only what the user accepts.
- Requests are staggered one station at a time with a randomized delay. The
  queue is cancelled when the browser closes.
- Successful details are cached for about six hours.
- Failures use exponential backoff from about five minutes up to six hours,
  with jitter. A failed station is retried later rather than ignored forever,
  but it is not polled continuously.
- **Fetch Details** in the Add/Edit form performs the lookup immediately and
  remains available when automatic metadata fetching is disabled.

Now-playing polling uses the active fallback stream source. A failure backs off
from about one minute up to thirty minutes and resumes automatically; it does
not permanently disable metadata for the station. Pausing playback stops
polling.

Automatic metadata fetching is controlled by **Fetch Station Metadata** in the
Radio settings block. The stored setting remains `plugin-radio.nowPlaying` for
compatibility. The per-station `nowPlaying: false` value disables automatic
fetching for that station.

## Using the Player

- Sidebar controls provide play/pause, previous/next, mute, volume, and the
  station browser.
- The station browser lists stations and shows artwork, descriptions, and
  available genre, bitrate, and listener details. Channel names inside
  descriptions are clickable and open the corresponding IRC channel. Disable
  Show Station Icons to hide artwork and the empty artwork column.
- The visualizer button switches the station browser to a full-panel
  MilkDrop-inspired effect with playback controls and a fullscreen toggle.
  It animates ambiently when no station is playing.
- Stations can be starred from the station browser. Starred stations sort first.
- `autoPlay` waits for the first document click before starting the last
  station.
- The waveform is visual only; playback works without it. Choose None, Bars,
  Mirror Bars, Wave, Area Wave, LED Spectrum, Pulse, or Peak Caps in the Radio
  settings block.
- Playback failures are marked per station and stop playback for that station.

## Visualizer

The station browser has a Visualizer button that replaces the station list with
a full-panel WebGL feedback effect. It uses audio-reactive warp, zoom, rotation,
a radial spectrum, colour cycling, and beat pulses, with a 2D canvas fallback
when WebGL is unavailable.

The overlay keeps the current station and track visible and provides
play/pause, previous/next, back to stations, and fullscreen controls. Esc exits
fullscreen without closing the visualizer. An idle station shows an ambient
animation instead of auto-playing.

Audio-reactive rendering needs Web Audio samples, which requires the stream to
allow CORS. Streams that block CORS still play normally and show the ambient
visualizer, with a notice instead of audio-reactive motion. Native desktop HTTP
does not change this because it does not proxy the `<audio>` element.

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
| `enabled()`     | Boolean    | True when Enable Radio is on, even if the station list is empty or missing. |
| `getRadio()`    | Controller | Returns the shared radio controller.                                       |
| `openBrowser()` | Boolean    | Opens the station browser. Returns false when the player is disabled.      |

The controller returned by `getRadio()` exposes:

| Member                    | Meaning                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ui`                      | Reactive player state, including stations, loading, error, playing, muted, current station name and display label, browser-open state, failed stations, waveform state, track title, current now-playing metadata, and missing-file state. |
| `setting(name, fallback)` | Reads a `plugin-radio.*` setting with a fallback.                                                                                                                                          |
| `enabled()`               | Player availability.                                                                                                                                                                       |
| `waveStyle()`             | Returns `none` or `bars`, honoring the legacy `showWave` setting.                                                                                                                          |
| `waveEnabled()`           | True when a waveform style is enabled.                                                                                                                                                     |
| `applySettings()`         | Reapplies enable, now-playing, and waveform changes to the running player.                                                                                                                |
| `closeBrowser()`          | Closes the active station browser.                                                                                                                                                         |
| `addStation(station)`     | Adds a user station and returns `{ ok, error }`.                                                                                                                                           |
| `updateStation(source, station)` | Updates a user station by its original stream source.                                                                                                                               |
| `removeStation(station)`  | Removes a user station or hides a file-provided station.                                                                                                                                   |
| `restoreStation(station)` | Restores a hidden file-provided station.                                                                                                                                                   |
| `restoreAllStations()`    | Restores every hidden file-provided station.                                                                                                                                               |
| `startDetailQueue()`      | Starts staggered desktop station-detail enrichment for the open browser.                                                                                                                   |
| `stopDetailQueue()`       | Stops pending station-detail enrichment.                                                                                                                                                    |
| `setVisualizer(open)`     | Enables or disables visualizer audio analysis and its restart behavior.                                                                                                                      |
| `fetchStationDetails(station)` | Fetches desktop station details immediately and caches them. Returns the details or `null`.                                                                                           |
| `volume()`                | Effective volume, including `forceVolume`.                                                                                                                                                 |
| `current()`               | Current station object or `null`.                                                                                                                                                          |
| `loadStations()`          | Reloads the station file.                                                                                                                                                                  |
| `play(station)`           | Plays a station object with one or more valid stream URLs, trying them in order.                                                                                                           |
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
