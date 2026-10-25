# Kiwi IRC Configuration

The browser fetches the config on startup. Do not put passwords, SASL secrets,
or user hashes in it.

## Where To Configure

The application loads `static/config.json` by default. You can override it by
specifying `?config=<name>` in the url which will instead load
`static/config_<name>.json`.

The file must be JSON5. Comments and trailing commas are allowed. In development
only, `static/config.local.json` is copied over `dist/static/config.json` and is
not included in a production build. It is still served to the browser.

The file `src/res/configTemplates.js` supplies the defaults. `config.json` is
applied on top. Objects merge, but arrays replace. An omitted key keeps the
default.

The settings screen writes overrides into browser storage. Those win over this
file for that browser. They are not written back here.

## What to Set

`kiwiServer` is the websocket gateway, unless `startupOptions.direct` is true.
Keep it an empty string when the deployment has no gateway: connection pickers
then offer only direct `ws`/`wss`, and existing `irc`/`ircs` selections are
switched to their direct websocket equivalent.

`startupOptions.server`, `port`, `tls`, `channel`, and `nick` fill the startup
form. `tls` here is the gateway or direct websocket, not a check of the upstream
IRC server. `nick` may contain `?`, which is replaced with a random digit.

`restricted: true` locks the client to one network. The template default is
`true`. The starter file sets `false`.

`startupScreen` selects the screen shown before the client starts. See
[Startup Modes](#startup-modes) for the available modes, when to use each, and
their effects.

`theme` is a theme name from the built-in list, or a theme object URL under
`themes`. Omitting `themes` keeps the themes shipped in the template. If you set
`themes`, that array replaces the built-in list.

`presetNetworks` is a list of servers for the startup picker. Each entry is an
`irc://` or `ircs://` URI string, or a connection object (`server`, `port`,
`tls`, `direct`, `path`). Example: `"ircs://irc.example.net:6697"`. Without a
gateway, gateway presets are switched to their direct websocket equivalent.

Enable a plugin by adding an entry to the top-level `plugins` array:

```json
"plugins": [
    { "name": "my-plugin", "url": "static/plugins/my-plugin.html" }
]
```

Remove an entry to disable that plugin. Set `plugins` to an empty array to load
none. HTML plugins are injected with `innerHTML`; `<i />` is not self-closing
there. Plugin-specific configuration is documented with each plugin.

See [PLUGINS.md](PLUGINS.md) for plugin authoring, UI hooks, events,
translations, and the media playback API.

## File Uploads

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

`startupScreen` chooses the screen shown before the IRC client starts.

### Startup Modes

| Value                 | Pick When                                                | What It Does                                                                                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `welcome`             | A public client tied to one network or gateway.          | Single-network login. Shows Anonymous, Account, and Register tabs when supported. Uses `startupOptions.server`, `port`, `tls`, `channel`, and `nick`; `probeServerCaps` adapts tabs, registration, and length limits; `altComponent` replaces the form. |
| `customServer`        | Users choose between networks or enter their own server. | Multi-network connection screen with a preset/custom server selector, IRC and Bouncer tabs, and identity tabs. Uses `presetNetworks`, `enableCustom`, and `enableTabs`. Supports URL-fragment auto-connect. This is the config template default.        |
| `bouncer`             | A Soju or other modern `bouncer-networks` deployment.    | Dedicated bouncer login. Connects to the bouncer control connection and loads its networks. Requires `draft/bouncer-networks` or `soju.im/bouncer-networks`; BNC, Account, and Register tabs follow the capability probe.                               |
| `personal`            | A persistent personal client with saved networks.        | Returning-user home with saved networks, Add Network, temporary connection, and Add to Existing Tab. Forces `restricted: false` so network settings remain available.                                                                                   |
| Custom component name | The built-in screens do not fit.                         | Runs a startup component registered with `kiwi.addStartup(name, component)`. An unknown name throws a startup error.                                                                                                                                    |

- `static/config.json` starts with `welcome`; the config template default is
  `customServer`.
- `startupOptions.server`, `port`, `tls`, `channel`, and `nick` seed the
  built-in forms. `personal` uses saved state and URL fragments instead.
- `startupOptions.bouncer: true` is the legacy bouncer mode used by `welcome`,
  `customServer`, and `personal`. New bouncer deployments should use
  `startupScreen: "bouncer"`.
- `restricted: true` locks the client to one network. `personal` forces it to
  `false`.
- `presetNetworks` supplies the `customServer` selector.

### Startup Options

| Key                               | Default      | Description                                                          |
| --------------------------------- | ------------ | -------------------------------------------------------------------- |
| `startupOptions.server`           | `""`         | IRC server or gateway host. Empty uses the gateway default.          |
| `startupOptions.port`             | `6667`       | Connection port. Defaults depend on TLS and direct mode.             |
| `startupOptions.tls`              | `false`      | TLS for the gateway or direct websocket.                             |
| `startupOptions.direct`           | `false`      | Connect directly to the IRC server websocket instead of the gateway. |
| `startupOptions.channel`          | `""`         | Initial channel.                                                     |
| `startupOptions.nick`             | `kiwi_?`     | Initial nick. `?` is replaced with a random digit.                   |
| `startupOptions.state_key`        | `kiwi-state` | Browser storage key. Empty disables state saving.                    |
| `startupOptions.remember_buffers` | `true`       | Include buffers in saved state.                                      |
| `startupOptions.nick_format`      | `""`         | Pattern used to validate nick input.                                 |

### Mode-Specific Options

| Option                           | Default | Effect                                                                                                                 |
| -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `startupOptions.probeServerCaps` | `false` | Probe server capabilities before rendering single-network forms and presets. Costs one extra connection per page load. |
| `startupOptions.enableCustom`    | `true`  | Show the custom-server entry on `customServer`.                                                                        |
| `startupOptions.enableTabs`      | `true`  | Show the IRC and Bouncer tabs on `customServer`.                                                                       |
| `startupOptions.altComponent`    | unset   | Replace the `welcome` form with a custom component.                                                                    |
| `startupOptions.bouncer`         | `false` | Legacy bouncer switch for `welcome`, `customServer`, and `personal`. Prefer `startupScreen: "bouncer"`.                |

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
