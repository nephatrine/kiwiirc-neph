# Radio

Bundled station player with sidebar controls and a station browser.

## Enable

The default plugin list includes it:

```json
"plugins": [
    { "name": "radio", "url": "static/plugins/radio.html" }
]
```

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

## Station File

A station object is `name`, `image`, `source`, `description`, and optional
`channels` and `nowPlaying`. `source` must be `http` or `https`. On an HTTPS
page, `http` streams are dropped. `image` may also be a root-relative path such
as `/static/stations/logo.png`. `channels` is a string of channel names.
Clicking one joins it.

The stations file is parsed as JSON5, so plain JSON works unchanged.

Station playback is adapted from
[kiwiirc-plugin-radio](https://github.com/ItsOnlyBinary/kiwiirc-plugin-radio)
(Apache-2.0).

## Service

The plugin registers a public `radio` service:

```js
kiwi.getService('radio').enabled()
kiwi.getService('radio').getRadio()
kiwi.getService('radio').openBrowser()
```

Themes can still restyle the player through the existing `.kiwi-radio-*` class
names.
