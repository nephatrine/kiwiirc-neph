# Kiwi IRC Configuration

The browser fetches the config on startup. Do not put passwords, SASL secrets,
or user hashes in it.

## How it is loaded

In order:

1. `?config=name` loads `static/config_name.json`.
1. `window.kiwiConfig()`, if it is a function, returns the config object.
1. `<meta name="kiwiconfig" content="...">` is a config URL.
1. `<script name="kiwiconfig" type="application/json">` is inline JSON.
1. Otherwise `static/config.json`.

The file is JSON5, so comments and trailing commas are allowed. In development
only, `static/config.local.json` is copied over `dist/static/config.json` and is
not included in a production build. It is still served to the browser.

`src/res/configTemplates.js` supplies the defaults. `config.json` is merged on
top. Objects merge. Arrays replace the template array. An omitted key keeps the
default.

The settings screen writes overrides into browser storage. Those win over this
file for that browser. They are not written back here.

`hideSettings: null` hides that key from the advanced settings list. Any other
value shows it.

## What to set

`kiwiServer` is the websocket gateway, unless `startupOptions.direct` is true.
Replace the example URL. Set it to an empty string when the deployment has no
gateway: connection pickers then offer only direct `ws`/`wss`, and existing
`irc`/`ircs` selections are switched to their direct websocket equivalent.

`startupOptions.server`, `port`, `tls`, `channel`, and `nick` fill the startup
form. `tls` here is the gateway or direct websocket, not a check of the upstream
IRC server. `nick` may contain `?`, which is replaced with a random digit.

`restricted: true` locks the client to one network. The template default is
`true`. The starter file sets `false`.

`startupScreen` is `welcome`, `customServer`, `bouncer` (the bouncer login
screen), `personal`, or a custom component name. `kiwiBnc` and `znc` are
accepted aliases for `bouncer`. The template default is `customServer`.

`theme` is a theme name from the built-in list, or a theme object URL under
`themes`. Omitting `themes` keeps the themes shipped in the template. If you set
`themes`, that array replaces the built-in list.

`presetNetworks` is a list of servers for the startup picker. Each entry is an
`irc://` or `ircs://` URI string, or a connection object (`server`, `port`,
`tls`, `direct`, `path`). Example: `"ircs://irc.example.net:6697"`. Without a
gateway, gateway presets are switched to their direct websocket equivalent.

`plugins` is `{ "name": "...", "url": "static/plugins/...." }`. An empty array
loads none. HTML plugins are injected with `innerHTML`. `<i />` is not
self-closing there.

## File uploads

```json
"fileupload": {
    "service": "none",
    "litterbox": { "retention": "72h" }
}
```

`service` is `none` (default), `litterbox`, or `filehost`. Users can override
the service and retention in settings. `none` does not lock out a user override.

`litterbox.retention` is `1h`, `12h`, `24h`, or `72h` (default `72h`).

`filehost` is not a URL in this file. The upload URL comes from the server
`draft/FILEHOST` token, or `soju.im/FILEHOST` if draft is absent. It is
available only after SASL login. Plain `http` is refused when `connection.tls`
is set.

## Radio

The player stays hidden until `radio.url` is a stations file the browser can
fetch. A relative URL is resolved against the page, so `static/stations.json`
works in a subdirectory install. See
[static/stations.example.json](static/stations.example.json).

| Key              | Default |                                                                                 |
| ---------------- | ------- | ------------------------------------------------------------------------------- |
| `url`            | `""`    | Stations JSON. Empty disables the player.                                       |
| `volume`         | `0.4`   | `0` to `1`.                                                                     |
| `starred`        | `[]`    | Station names. Users usually set this in the player.                            |
| `active`         | `""`    | Last station name.                                                              |
| `showWave`       | `true`  | Waveform. Playback does not require it.                                         |
| `autoPlay`       | `false` | If true, waits for a click before playing.                                      |
| `forceVolume`    | `false` | Start at the admin volume and do not save a user volume until the slider moves. |
| `reloadOnOpen`   | `false` | Fetch the station list again when the list opens.                               |
| `forceShowClose` | `false` | Reserved. The station list always has a close control.                          |

Station playback is adapted from
[kiwiirc-plugin-radio](https://github.com/ItsOnlyBinary/kiwiirc-plugin-radio)
(Apache-2.0).

A station object is `name`, `image`, `source`, `description`, and optional
`channels` and `nowPlaying`. `source` must be `http` or `https`. On an HTTPS
page, `http` streams are dropped. `image` may also be a root-relative path such
as `/static/stations/logo.png`. `channels` is a string of channel names.
Clicking one joins it.

While a station is playing, Kiwi polls `https://<stream-host>/status-json.xsl`
every 30 seconds and shows that mount's title under the station name. The same
text becomes the lock-screen title, with the station name as the artist. Polling
stops when playback stops. `nowPlaying` is an optional `http` or `https` URL
that overrides that guess, or `false` to disable track polling for that station.
If the status endpoint answers with an HTTP error such as 403 or 404, polling
stops for the rest of that playback, so stations that block `status-json.xsl`
are queried only once. A network error is retried, but polling stops after three
consecutive failures, so an endpoint that blocks the request, such as a
CORS-denied 403, is not polled forever.

If a stream falls silent for more than 15 seconds while the player still reports
it as playing, Kiwi reloads the stream automatically. After three silent stalls
in a row the station is marked as failed so it can be retried.

## Embedly

Cards are used only for links that are not already an image, audio, or video
embed. Set the key in `static/config.json`:

```json
"embedly": {
    "Key": "your-key-here"
}
```

`embedly.key` also works. The value is sent to the browser as `data-card-key`,
so it cannot be a secret. An empty key leaves Embedly off.

`embedly.script` replaces `//cdn.embedly.com/widgets/platform.js`.
`embedly.cardWidth` applies to pinned cards. Their default width is `400px`.
Other cards are `600px`.

## Connection

| Key                       | Default            |                                            |
| ------------------------- | ------------------ | ------------------------------------------ |
| `kiwiServer`              | `/webirc/kiwiirc/` | Gateway URL.                               |
| `restricted`              | `true`             | One network only.                          |
| `bnc.active`              | `false`            | Route networks through a bouncer.          |
| `bnc.server`              | `""`               |                                            |
| `bnc.port`                | `6667`             |                                            |
| `bnc.tls`                 | `false`            |                                            |
| `bnc.path`                | `""`               |                                            |
| `bnc.username`            | `""`               |                                            |
| `bnc.password`            | `""`               | Public if set here. Prefer the login form. |
| `autoReconnect`           | `false`            |                                            |
| `autoReconnectMaxWait`    | `30000`            | Milliseconds.                              |
| `autoReconnectMaxRetries` | `10`               |                                            |
| `disconnectOnSaslFail`    | `true`             |                                            |
| `defaultSaslMechanism`    | `AUTO`             | `AUTO` prefers SCRAM-SHA-256 over PLAIN.   |
| `quitMessage`             | `Page closed`      |                                            |
| `warnOnExit`              | `true`             |                                            |

## Startup

| Key                               | Default      |                                                 |
| --------------------------------- | ------------ | ----------------------------------------------- |
| `startupOptions.server`           | `""`         |                                                 |
| `startupOptions.port`             | `6667`       |                                                 |
| `startupOptions.tls`              | `false`      |                                                 |
| `startupOptions.direct`           | `false`      | Websocket to the IRC server, not the gateway.   |
| `startupOptions.channel`          | `""`         |                                                 |
| `startupOptions.nick`             | `kiwi_?`     |                                                 |
| `startupOptions.state_key`        | `kiwi-state` | Browser storage key. Empty disables state save. |
| `startupOptions.remember_buffers` | `true`       |                                                 |
| `startupOptions.nick_format`      | `""`         |                                                 |

## Buffers

These are the defaults for new buffers. A buffer setting in the UI overrides
them.

| Key                                          | Default                                                       |                                                  |
| -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| `buffers.messageLayout`                      | `modern`                                                      | `modern`, `compact`, or `inline`.                |
| `buffers.alert_on`                           | `highlight`                                                   | `message`, `highlight`, or `never`.              |
| `buffers.scrollback_size`                    | `250`                                                         | Raw server buffer defaults to 500.               |
| `buffers.show_timestamps`                    | `true`                                                        |                                                  |
| `buffers.timestamp_format`                   | `%H:%M:%S`                                                    |                                                  |
| `buffers.timestamp_full_format`              | `""`                                                          | Empty uses the browser locale.                   |
| `buffers.show_hostnames`                     | `false`                                                       |                                                  |
| `buffers.show_joinparts`                     | `true`                                                        |                                                  |
| `buffers.show_topics`                        | `true`                                                        |                                                  |
| `buffers.show_topic_in_header`               | `false`                                                       |                                                  |
| `buffers.show_nick_changes`                  | `true`                                                        |                                                  |
| `buffers.show_mode_changes`                  | `true`                                                        |                                                  |
| `buffers.show_presence_changes`              | `true`                                                        |                                                  |
| `buffers.traffic_as_activity`                | `false`                                                       |                                                  |
| `buffers.server_as_activity`                 | `true`                                                        |                                                  |
| `buffers.coloured_nicklist`                  | `true`                                                        |                                                  |
| `buffers.colour_nicknames_in_messages`       | `true`                                                        |                                                  |
| `buffers.block_pms`                          | `false`                                                       |                                                  |
| `buffers.extra_formatting`                   | `true`                                                        |                                                  |
| `buffers.mute_sound`                         | `false`                                                       | Sounds are separate from desktop notifications.  |
| `buffers.hide_message_counts`                | `false`                                                       |                                                  |
| `buffers.show_realnames`                     | `false`                                                       |                                                  |
| `buffers.default_ban_mask`                   | `*!%i@%h`                                                     |                                                  |
| `buffers.default_kick_reason`                | `Your behaviour is not conducive to the desired environment.` |                                                  |
| `buffers.shared_input`                       | `false`                                                       |                                                  |
| `buffers.show_message_info`                  | `true`                                                        |                                                  |
| `buffers.who_loop`                           | `true`                                                        |                                                  |
| `buffers.share_typing`                       | `true`                                                        |                                                  |
| `buffers.flash_title`                        | `message`                                                     | `message`, `highlight`, or `off`.                |
| `buffers.nicklist_avatars`                   | `false`                                                       |                                                  |
| `buffers.warn_expected_command`              | `true`                                                        |                                                  |
| `buffers.show_link_previews`                 | `true`                                                        |                                                  |
| `buffers.inline_link_auto_previews`          | `true`                                                        |                                                  |
| `buffers.inline_link_auto_previews_query`    | `true`                                                        |                                                  |
| `buffers.inline_link_auto_preview_whitelist` | `.*`                                                          |                                                  |
| `buffers.show_buffer_groups`                 | `true`                                                        |                                                  |
| `buffers.prompt_leave`                       | `channels`                                                    | `all`, `channels`, `queries`, or `none`.         |
| `buffers.auto_request_history`               | `all`                                                         | `all`, `channels`, `queries`, or `none`.         |
| `buffers.emoji_convert_as_typed`             | `true`                                                        |                                                  |
| `buffers.emoji_convert_incoming`             | `true`                                                        |                                                  |
| `buffers.ignore_bots`                        | `false`                                                       |                                                  |
| `buffers.show_redactions`                    | `placeholder`                                                 |                                                  |
| `buffers.show_notifications`                 | `true`                                                        | Desktop notifications while the page is running. |
| `buffers.lenient_rerouting`                  | `true`                                                        |                                                  |
| `buffers.favorite`                           | `false`                                                       | Per-buffer default, not a global switch.         |

## Interface

| Key                             | Default                             |                            |
| ------------------------------- | ----------------------------------- | -------------------------- |
| `windowTitle`                   | `Kiwi IRC - The web IRC client`     |                            |
| `useMonospace`                  | `false`                             |                            |
| `language`                      | `""`                                | Empty follows the browser. |
| `theme`                         | `Kiwi Dark`                         |                            |
| `google_fonts`                  | Source Sans Pro and Source Code Pro |                            |
| `showEmojiPicker`               | `true`                              |                            |
| `forceShowEmojiPicker`          | `false`                             |                            |
| `showColorPicker`               | `false`                             |                            |
| `showSendButton`                | `false`                             |                            |
| `showAutocomplete`              | `true`                              |                            |
| `autocompleteTokens`            | `["/", "#", "@"]`                   |                            |
| `showAwayStatusIndicators`      | `true`                              |                            |
| `sidebarDefault`                | `nicklist`                          |                            |
| `showRaw`                       | `false`                             |                            |
| `showChanlistModes`             | `false`                             |                            |
| `nicklistGroupAway`             | `false`                             |                            |
| `noticeActiveBuffer`            | `true`                              |                            |
| `skipHiddenMessages`            | `false`                             |                            |
| `useBufferHistory`              | `true`                              |                            |
| `changeNickOnCollision`         | `true`                              |                            |
| `allowRegisterProtocolHandler`  | `false`                             |                            |
| `highlights`                    | `""`                                | Extra highlight words.     |
| `teamHighlights`                | `false`                             |                            |
| `avatars.fallback_avatar_url`   | `""`                                | `{nickname}` is replaced.  |
| `avatars.away_status_position`  | `1`                                 |                            |
| `avatars.initials_length`       | `1`                                 |                            |
| `avatars.show_image_background` | `true`                              |                            |
| `avatars.show_without_user`     | `false`                             |                            |

Message prefixes live under `textFormats`. Command aliases live under `aliases`.
Both are long and rarely need editing. The full defaults are in
`src/res/configTemplates.js`.
