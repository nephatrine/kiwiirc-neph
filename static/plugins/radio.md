# Radio

## Overview

A bundled station player with sidebar controls and a station browser. It plays
HTTP/HTTPS streams, shows now-playing metadata when available, and reports
playback through the client media state.

The default configuration enables this plugin.

## Enable

The default `plugins` list includes this entry:

```json
"plugins": [
    { "name": "radio", "url": "static/plugins/radio.html" }
]
```

Remove it from the `plugins` array to disable the plugin.

The default station file is `static/plugins/radio/stations.json`. If it is
missing, the player stays visible with an empty station browser. Copy
[static/plugins/radio/stations.example.json](radio/stations.example.json) there,
or set `plugin-radio.url` to another stations file. Relative URLs resolve
against the page.

## Settings

Preferences use normal Kiwi user settings. The plugin registers these defaults
itself, so there is no config-template block.

- `plugin-radio.url` — Stations JSON5 file. Default:
  `static/plugins/radio/stations.json`.
- `plugin-radio.enabled` — Enables the player interface and controls. Default:
  `true`.
- `plugin-radio.nowPlaying` — Fetches track metadata automatically. Default:
  `true`. Per-station settings still apply.
- `plugin-radio.showStationIcons` — Shows station artwork in the browser.
  Default: `true`.
- `plugin-radio.waveStyle` — `none`, `bars` (default), `mirror`, `wave`, `area`,
  `led`, `pulse`, or `peaks`.
- `plugin-radio.volume` — Playback volume from `0` to `1`. Default: `0.4`.
- `plugin-radio.autoPlay` — Play the last station after the first document
  click. Default: `false`.
- `plugin-radio.forceVolume` — Start at the admin volume and do not save a user
  volume until moved. Default: `false`.
- `plugin-radio.reloadOnOpen` — Reload the station file when the browser opens.
  Default: `false`.

`plugin-radio.showWave` is a legacy fallback used when `waveStyle` is unset.
`customStations`, `hiddenStations`, and `starred` are maintained through the
station browser.

Administrators can set defaults under `plugin-radio` in configuration. Users
override them in General settings, which includes Enable Radio, Fetch Station
Metadata, Show Station Icons, and Show Waveform.

## Station File

The file is parsed as JSON5, so plain JSON works.

- `name` (optional) — Display name. Falls back to the first stream URL.
- `image` (optional) — Artwork URL or root-relative path.
- `sources` (required unless `source` is used) — Ordered stream URLs. On an
  HTTPS page, `http` streams are dropped.
- `source` (required only when `sources` is absent) — Legacy single stream URL.
- `homepage` (optional) — Station homepage opened from the browser.
- `description` (optional) — Description text. Channel names remain clickable.
- `nowPlaying` (optional) — `false` disables automatic metadata; a URL supplies
  a custom endpoint; omitted uses the stream host.

One of `sources` or `source` is required. Stations without a valid stream URL
are dropped. Invalid images are dropped while the station remains available.
Sources are tried in order until one plays.

## Managing Stations

- **Add Station** in the browser creates a user station; edit or remove it
  there.
- Configured stations can be hidden without editing the file and restored from
  **Hidden Stations**.
- Stream URLs are entered one per line, in preference order.
- **Choose Image** on desktop copies a local image into the app's internal icon
  storage.
- Channel names in descriptions open the IRC channel.

## Using the Player

- Sidebar controls provide play/pause, previous/next, mute, volume, and the
  station browser.
- The browser shows artwork, descriptions, genre, bitrate, and listener details
  when available. Turn off Show Station Icons to hide artwork.
- Starred stations sort first.
- With `autoPlay`, the last station starts after the first document click.
- The waveform is visual only; playback works without it.
- Playback failures are marked per station and stop that station.

## Desktop Metadata

On desktop, opening the station browser slowly enriches missing station details
through the native HTTP bridge: stream headers, homepage metadata, and artwork.
Results are cached for about six hours, successful details fill empty fields,
and failures back off from minutes to hours. **Fetch Details** in the Add/Edit
form runs the lookup immediately. Automatic fetching is controlled by **Fetch
Station Metadata** and per-station `nowPlaying: false`.

The web client uses normal browser CORS behavior instead.

## Visualizer

The station browser has a **Visualizer** button that replaces the list with a
full-panel audio-reactive effect. It keeps the current station and track visible
and provides play/pause, previous/next, back to stations, and fullscreen
controls. Esc exits fullscreen without closing the visualizer. An idle station
shows an ambient animation.

Audio-reactive rendering needs Web Audio samples, so the stream must allow CORS.
Streams that block CORS still play normally and use the ambient visualizer.

## Attribution

Station playback is adapted from
[ItsOnlyBinary/kiwiirc-plugin-radio](https://github.com/ItsOnlyBinary/kiwiirc-plugin-radio)
(Apache-2.0).
