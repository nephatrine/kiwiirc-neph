# Kiwi IRC Configuration

Kiwi IRC is configured by a JSON5 file that the browser fetches at startup. The
file is public: never put passwords, SASL secrets, user hashes, or other private
data in it. The browser fetches it over the same origin as the client.

## Configuration Sources

The client checks these sources in order:

1. `?config=<name>` in the URL loads `static/config_<name>.json`.
2. `window.kiwiConfig()` returns a config object directly.
3. `<meta name="kiwiconfig" content="...">` supplies a config URL.
4. `<script name="kiwiconfig" type="application/json">` supplies inline JSON5.
5. Otherwise the client loads `static/config.json`.

The loaded file must be JSON5. Comments and trailing commas are allowed.

In development only, `static/config.local.json` is copied over
`dist/static/config.json` when it exists. It is excluded from production builds.
It is still fetched by the browser, so do not put secrets in it either.

## Configuration Precedence

Configuration objects merge in this order:

1. `configTemplates.default` from `src/res/configTemplates.js`.
2. `configTemplates[config.template]` when `template` is set.
3. The loaded config file or object.

Objects merge recursively. Arrays replace the previous array; they do not
append. An omitted key keeps its previous value.

Browser `user_settings` written by the settings screen are not merged into this
object. `state.setting(name)` checks them first and falls back to the merged
config, so a saved user setting overrides the same key.

`template` accepts:

- `default` — the full default configuration.
- `irc` — inline message layout, hostnames shown, no emoji picker, no coloured
  nicknames, no inline previews, and no typing sharing.
- `team` — team highlights enabled, join/part messages hidden, realnames shown,
  and the modern message layout.

The default config template enables the bundled channels sidebar, NephDeck,
NephWave, Bongo Companion, radio, and `suggest-limnoria` plugins.

## Value Replacements

String values may use these placeholders. They are replaced before the config is
merged:

| Placeholder      | Value                                               |
| ---------------- | --------------------------------------------------- |
| `{{protocol}}`   | Current page protocol, such as `https:` or `http:`. |
| `{{wsprotocol}}` | `wss:` on HTTPS pages, otherwise `ws:`.             |
| `{{tls}}`        | `true` on HTTPS pages, otherwise `false`.           |
| `{{hostname}}`   | Current page hostname.                              |
| `{{host}}`       | Current page host and port.                         |
| `{{port}}`       | Current page port, defaulting to 443 or 80.         |
| `{{hash}}`       | URL fragment without the leading `#`.               |
| `{{query}}`      | Query string without the leading `?`.               |
| `{{referrer}}`   | Document referrer.                                  |

An exact placeholder match keeps the replacement type, so `{{tls}}` remains a
boolean.

## Quick-Start Examples

### Single Network

```json5
{
    "startupScreen": "welcome",
    "restricted": true,
    "kiwiServer": "https://example.com/webirc/kiwiirc/",
    "startupOptions": {
        "server": "irc.example.net",
        "port": 6697,
        "tls": true,
        "channel": "#chat",
        "nick": "kiwi_?"
    }
}
```

### Multiple Networks Through a Gateway

```json5
{
    "startupScreen": "customServer",
    "restricted": false,
    "kiwiServer": "https://example.com/webirc/kiwiirc/",
    "presetNetworks": [
        "Example|ircs://irc.example.net:+6697#chat",
        "Libera|ircs://irc.libera.chat:+6697"
    ]
}
```

### Direct WebSocket, No Gateway

```json5
{
    "startupScreen": "customServer",
    "restricted": false,
    "kiwiServer": "",
    "startupOptions": {
        "direct": true
    }
}
```

With `kiwiServer` empty, the connection picker offers only direct `ws` and `wss`
connections. Existing `irc` or `ircs` selections are switched to their direct
WebSocket equivalents.

### Bouncer

```json5
{
    "startupScreen": "bouncer",
    "restricted": false,
    "startupOptions": {
        "server": "soju.example.net",
        "port": 6697,
        "tls": true
    }
}
```

The default Account tab uses `network.connection.account` as the SASL username
and `network.password` as the SASL secret. The BNC tab uses `network.username`
and `connection.password` instead.

### Personal Persistent Client

```json5
{
    "startupScreen": "personal",
    "restricted": false
}
```

`personal` forces `restricted` to `false` so saved networks and network settings
remain available.

## Startup Modes

`startupScreen` selects the screen shown before the IRC client starts.

| Value                 | Use When                                                 | Behavior                                                                                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `welcome`             | A public client tied to one network or gateway.          | Single-network login. Shows Anonymous, Account, and Register tabs when supported. Uses `startupOptions.server`, `port`, `tls`, `channel`, and `nick`; `probeServerCaps` adapts tabs, registration, and length limits; `altComponent` replaces the form.         |
| `customServer`        | Users choose between networks or enter their own server. | Multi-network screen with preset/custom server selection, IRC and Bouncer tabs, and identity tabs. Uses `presetNetworks`, `enableCustom`, and `enableTabs`. Supports URL-fragment auto-connect. This is the config template default.                            |
| `bouncer`             | A Soju or other modern `bouncer-networks` deployment.    | Dedicated bouncer login. Connects to the bouncer control connection and loads its networks. Uses `draft/bouncer-networks` or `soju.im/bouncer-networks`; a completed probe without either shows an error, and BNC, Account, and Register tabs follow the probe. |
| `personal`            | A persistent personal client with saved networks.        | Returning-user home with saved networks, Add Network, temporary connection, and Add to Existing Tab. Forces `restricted: false` so network settings remain available.                                                                                           |
| Custom component name | The built-in screens do not fit.                         | Runs a startup component registered with `kiwi.addStartup(name, component)`. An unknown name throws a startup error.                                                                                                                                            |

Notes:

- `static/config.json` starts with `welcome`; the config template default is
  `customServer`. If `startupScreen` is unset entirely, the code falls back to
  `personal`.
- `startupOptions.server`, `port`, `tls`, `channel`, and `nick` seed the
  built-in forms. `personal` uses saved state and URL fragments instead.
- `restricted: true` locks the client to one network. `personal` forces it to
  `false`.
- `presetNetworks` supplies the `customServer` selector.

## Startup Options

`startupOptions` seeds the built-in startup forms and controls their behavior.

| Key                | Default      | Description                                                             |
| ------------------ | ------------ | ----------------------------------------------------------------------- |
| `server`           | `""`         | IRC server or gateway host. Empty uses the gateway default.             |
| `port`             | `6667`       | Connection port. Defaults depend on TLS and direct mode.                |
| `tls`              | `false`      | TLS for the gateway or direct WebSocket. Not an upstream IRC TLS check. |
| `direct`           | `false`      | Connect directly to the IRC server WebSocket instead of the gateway.    |
| `channel`          | `""`         | Initial channel.                                                        |
| `nick`             | `kiwi_?`     | Initial nick. `?` is replaced with a random number.                     |
| `state_key`        | `kiwi-state` | Browser storage key. Empty disables saved state.                        |
| `remember_buffers` | `true`       | Include the buffer list in saved state.                                 |
| `nick_format`      | `""`         | Pattern used to validate nick input.                                    |
| `probeServerCaps`  | `false`      | Probe server capabilities before rendering forms and presets.           |
| `enableCustom`     | `true`       | Show the custom-server entry on `customServer`.                         |
| `enableTabs`       | `true`       | Show the IRC and Bouncer tabs on `customServer`.                        |
| `altComponent`     | unset        | Replace the `welcome` form with a registered custom component.          |
| `greetingText`     | unset        | Custom greeting text for startup screens.                               |
| `buttonText`       | unset        | Custom connect-button text.                                             |
| `footerText`       | unset        | Custom footer text.                                                     |
| `termsContent`     | unset        | Terms or notice content shown on startup screens.                       |
| `infoBackground`   | unset        | Background image URL for the startup info panel.                        |
| `infoContent`      | unset        | Custom HTML content for the startup info panel.                         |

### Advanced Startup Fields

These are accepted by the built-in startup screens in addition to the table
above. They are mainly for preconfigured deployments.

| Key                | Default                                        | Description                                                                 |
| ------------------ | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `account`          | `""`                                           | Prefill the account/SASL username.                                          |
| `password`         | `""`                                           | Prefill the SASL password. Public if set in config.                         |
| `username`         | `""`                                           | Prefill the ident/username.                                                 |
| `gecos`            | `""`                                           | Prefill the realname/GECOS.                                                 |
| `encoding`         | unset                                          | IRC encoding. `customServer` falls back to `utf-8` when creating a network. |
| `websocket`        | unset                                          | Direct WebSocket URI. Overrides `server`, `port`, `tls`, and `direct`.      |
| `direct_path`      | `""`                                           | WebSocket path used in direct mode.                                         |
| `showChannel`      | `true`                                         | Show the channel field.                                                     |
| `showNick`         | `true`                                         | Show the nick field (`welcome` only).                                       |
| `showPassword`     | `true`                                         | Show the password field (`welcome` only).                                   |
| `toggablePassword` | `true`                                         | Allow toggling password visibility (`welcome` only).                        |
| `allowNoChannel`   | `false` in `welcome`, `true` in `customServer` | Allow connecting without a channel.                                         |
| `autoConnect`      | `false`                                        | Submit automatically when the form is ready (`welcome` only).               |

`probeServerCaps` costs one extra connection per probed endpoint and page load.
A failed probe falls back to the configured defaults. A bouncer preset waits for
its probe before enabling the login button; other forms remain usable. Custom
endpoints skip the probe.

`startupOptions.direct` and `kiwiServer` are independent:

- A non-empty `kiwiServer` enables gateway connections.
- `direct: true` selects a direct WebSocket connection instead.
- With `kiwiServer` empty, only direct `ws`/`wss` connections are offered.

## Preset Networks

`presetNetworks` is an array of strings or objects.

String format:

```text
[name|][irc://|ircs://|ws://|wss://]server[:[+]port][/path][#channel][?param=value&...]
```

Examples:

```text
Example|ircs://irc.example.net:+6697#chat
Libera|ircs://irc.libera.chat:+6697
Local|ws://localhost:8067
Bouncer|ircs://soju.example.net:+6697?type=bnc
```

Object format:

```json5
{
    "name": "Example",
    "server": "irc.example.net",
    "port": 6697,
    "tls": true,
    "direct": false,
    "path": "",
    "type": "irc",
    "channels": "#chat"
}
```

`type` is `irc` or `bnc`. `channels` is used for the initial channel list.
Without a gateway, gateway presets are switched to their direct WebSocket
equivalent.

String presets may include `?type=bnc` and `?nick=<nick>`. The `nick` parameter
is used when a URL fragment supplies multiple connections.

## Connection and Network Defaults

| Key                            | Default            | Description                                                                                                                                  |
| ------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `kiwiServer`                   | `/webirc/kiwiirc/` | WebSocket gateway URL. Empty disables gateway connections.                                                                                   |
| `restricted`                   | `true`             | Locks the client to one network and makes connection details read-only.                                                                      |
| `autoReconnect`                | `false`            | Reconnect automatically after a disconnect.                                                                                                  |
| `autoReconnectMaxWait`         | `30000`            | Maximum reconnect delay in milliseconds.                                                                                                     |
| `autoReconnectMaxRetries`      | `10`               | Maximum reconnect attempts.                                                                                                                  |
| `disconnectOnSaslFail`         | `true`             | Disconnect when SASL authentication fails.                                                                                                   |
| `defaultSaslMechanism`         | `AUTO`             | `AUTO` prefers SCRAM-SHA-256 over PLAIN.                                                                                                     |
| `quitMessage`                  | `Page closed`      | Quit message sent when the client disconnects.                                                                                               |
| `warnOnExit`                   | `true`             | Warn before leaving the page while connected.                                                                                                |
| `persistencePreference`        | `keep`             | Per-network `draft/persistence` preference: `keep`, `default`, `on`, `off`.                                                                  |
| `hideSettings`                 | `null`             | Hide the settings button in the state browser.                                                                                               |
| `hide_advanced`                | unset              | Hide the Advanced tab in app settings.                                                                                                       |
| `allowRegisterProtocolHandler` | `false`/`true`     | Offer `irc://`/`ircs://` registration in Personal startup when a gateway is configured. Web defaults to `false`; desktop defaults to `true`. |
| `ircFramework`                 | unset              | Advanced options passed to the `irc-framework` client.                                                                                       |

### Per-Network Defaults

Several buffer defaults are copied into each new network and then owned by that
network:

- Desktop notifications (`buffers.show_notifications`)
- Persistence preference (`persistencePreference`)
- Typing sharing (`buffers.share_typing`)
- Lenient rerouting (`buffers.lenient_rerouting`)
- Ignore bots (`buffers.ignore_bots`)
- Redaction display (`buffers.show_redactions`)
- File upload service and retention

Changing these in Network Settings affects only that network. Changing the
config default affects networks created afterward.

Web Push is not configured in `config.json`. It is a per-network opt-in shown
only after login when the server negotiates `draft/webpush` or `soju.im/webpush`
and provides a VAPID key.

## Appearance and Interface

| Key                        | Default                          | Description                                                                  |
| -------------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| `windowTitle`              | `Kiwi IRC - The web IRC client`  | Browser tab title.                                                           |
| `useMonospace`             | `false`                          | Use the monospace font for messages.                                         |
| `language`                 | `""`                             | UI language. Empty follows the browser.                                      |
| `theme`                    | `Kiwi Dark`                      | Active theme name, including an installed desktop theme.                     |
| `themes`                   | Built-in list                    | Theme definitions. Setting this replaces the built-in list.                  |
| `google_fonts`             | Source Sans Pro, Source Code Pro | Fallback Google Fonts loaded for the active theme.                           |
| `showEmojiPicker`          | `true`                           | Show the emoji picker button.                                                |
| `forceShowEmojiPicker`     | `false`                          | Show the emoji picker even on touch devices.                                 |
| `emojiPickerMaxVersion`    | `0`                              | Maximum Unicode emoji version. `0` shows all versions.                       |
| `showColorPicker`          | `true`                           | Show the colour picker button.                                               |
| `showSendButton`           | `false`                          | Show a send button on touch devices.                                         |
| `showAutocomplete`         | `true`                           | Enable command and nick autocomplete.                                        |
| `autocompleteTokens`       | `["/", "#", "@"]`                | Tokens that trigger autocomplete.                                            |
| `showAwayStatusIndicators` | `true`                           | Show away and offline status dots.                                           |
| `sidebarDefault`           | `nicklist`                       | Sidebar shown at startup: `nicklist`, `settings`, `about`, `user`, or empty. |
| `showRaw`                  | `false`                          | Show raw server buffers globally.                                            |
| `showChanlistModes`        | `false`                          | Show channel modes in the channel list.                                      |
| `nicklistGroupAway`        | `true`                           | Group away users in the nicklist.                                            |
| `noticeActiveBuffer`       | `true`                           | Route server notices to the active buffer when possible.                     |
| `skipHiddenMessages`       | `false`                          | Skip hidden join/part/nick/mode events entirely.                             |
| `useBufferHistory`         | `true`                           | Remember recently viewed buffers and reopen the last one.                    |
| `changeNickOnCollision`    | `true`                           | Automatically try a new nick during registration if needed.                  |
| `highlights`               | `""`                             | Space-separated extra highlight words.                                       |
| `teamHighlights`           | `true`                           | Enable `@here`, `@channel`, and `@everyone` highlights.                      |

`themes` entries support `name`, `url`, `mode` (`light` or `dark`), and
`google_fonts`. A theme URL is a base path; Kiwi loads `<url>/theme.css`. If
`themes` is set, it replaces the built-in list rather than appending to it.

Desktop users can also install local ZIP theme packages from **Settings →
General → Appearance → Installed Themes**. Installed themes are stored in the
desktop user-data directory and are not part of profile exports.

Desktop users can install local ZIP emoji pack packages from **Settings →
General → Emoji Packs → Installed Emoji Packs**. Installed packs are stored in
the desktop user-data directory and are not part of profile exports. Each
archive must contain an `emoji.json` emoji pack document at its root or in one
top-level folder. Image URLs in the document may be absolute `http`/`https` URLs
or paths relative to the package, which are served through `kiwi-emoji://`.

`showEmojiPicker` and `forceShowEmojiPicker` are also gated by the active
network supporting UTF-8. `forceShowEmojiPicker` only overrides the touch-device
check.

`sidebarDefault` only opens the sidebar on desktop widths; mobile keeps the
sidebar closed until the user opens it.

`skipHiddenMessages` skips processing for hidden events, not only their display.
Self-involved events are still processed.

### Compatibility and Advanced Keys

- `customEmojis`: optional map of shortcode names to absolute `http`/`https`
  image URLs or root-relative paths beginning with `/`. Used for `:name:` custom
  emoji and custom-token reactions. Configured tokens take precedence over
  installed local packs, remote packs, and the Unicode shortcode table when
  `emojiPackPreference` is `local`. They are the final fallback when it is
  `remote`.
- `emojiPackPreference`: `local` (default) or `remote`. `local` prefers
  `customEmojis` and installed desktop packs over network/server/channel packs.
  `remote` reverses that order for unqualified `:name:` tokens. Local and remote
  packs both take precedence over the Unicode shortcode table.
- `remoteEmojiPacks`: load network/server emoji packs automatically. Defaults to
  `true`. Channel packs use a per-channel Prompt/Always/Never policy. Prompt
  asks before loading a channel's packs, Always loads all of them and fetches
  `draft/emoji` metadata for channels you have not joined, and Never keeps them
  literal.
- `hideSettings`: hides the settings button in the state browser.
- `hide_advanced`: hides the Advanced settings tab.
- `ircFramework`: advanced `irc-framework` client options. Use with care.

## Buffer Defaults

These values are defaults for new buffers. A per-buffer or per-network setting
overrides them.

### Layout and Display

| Key                            | Default       | Description                                                                                                                                             |
| ------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `messageLayout`                | `modern`      | `modern`, `corporate`, `compact`, `inline`, or `cyberdeck`. Corporate uses aligned chat bubbles; Cyberdeck uses avatar plates and cassette-style rails. |
| `show_timestamps`              | `true`        | Show message timestamps.                                                                                                                                |
| `timestamp_format`             | `%H:%M:%S`    | Timestamp format: `%H:%M:%S`, `%l:%M:%S %p`, or `decimal` for decimal time. Other formats hide the Time System selector.                                |
| `timestamp_full_format`        | `""`          | Full timestamp format. Empty uses the browser locale.                                                                                                   |
| `show_hostnames`               | `false`       | Show `nick!user@host` in system messages.                                                                                                               |
| `show_realnames`               | `false`       | Show realnames in the Modern, Corporate, and Cyberdeck message layouts.                                                                                 |
| `show_joinparts`               | `true`        | Show join and part messages.                                                                                                                            |
| `show_topics`                  | `true`        | Show topic changes.                                                                                                                                     |
| `show_topic_in_header`         | `false`       | Show topic in header. Desktop defaults to `true`.                                                                                                       |
| `show_nick_changes`            | `true`        | Show nick changes.                                                                                                                                      |
| `show_mode_changes`            | `true`        | Show mode changes.                                                                                                                                      |
| `show_presence_changes`        | `true`        | Show presence changes.                                                                                                                                  |
| `show_buffer_groups`           | `true`        | Group buffers by type in the sidebar.                                                                                                                   |
| `coloured_nicklist`            | `true`        | Colour nicknames in the nicklist.                                                                                                                       |
| `colour_nicknames_in_messages` | `true`        | Colour nicknames in messages.                                                                                                                           |
| `nicklist_avatars`             | `true`        | Show avatars in the nicklist.                                                                                                                           |
| `hide_message_counts`          | `false`       | Hide unread message counts.                                                                                                                             |
| `show_message_info`            | `true`        | Show the message info action.                                                                                                                           |
| `extra_formatting`             | `true`        | Enable Markdown-style and extra formatting.                                                                                                             |
| `emoji_convert_as_typed`       | `false`       | Convert emoji shortcodes while typing.                                                                                                                  |
| `emoji_convert_incoming`       | `true`        | Convert emoji shortcodes in incoming messages.                                                                                                          |
| `show_redactions`              | `placeholder` | `hidden`, `placeholder`, or `revealed`.                                                                                                                 |
| `favorite`                     | `false`       | Per-buffer favourite default.                                                                                                                           |

### History and Scrolling

| Key                     | Default    | Description                                                                                                                        |
| ----------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `scrollback_size`       | `250`      | Normal buffer scrollback. Raw server buffers and desktop default to 500.                                                           |
| `auto_request_history`  | `all`      | Request history for `all`, `channels`, `queries`, or `none`.                                                                       |
| `prompt_leave`          | `channels` | Prompt before leaving `all`, `channels`, `queries`, or `none`.                                                                     |
| `who_loop`              | `true`     | Refresh away status with WHO every three minutes when `away-notify` is unavailable. Channels with more than 100 users are skipped. |
| `shared_input`          | `false`    | Share input across buffers.                                                                                                        |
| `block_pms`             | `false`    | Block private messages from unknown users.                                                                                         |
| `warn_expected_command` | `true`     | Warn when a slash command is preceded by whitespace.                                                                               |

### Notifications and Sounds

| Key                   | Default     | Description                                           |
| --------------------- | ----------- | ----------------------------------------------------- |
| `alert_on`            | `highlight` | Alert on `message`, `highlight`, or `never`.          |
| `flash_title`         | `message`   | Flash the title on `message`, `highlight`, or `off`.  |
| `mute_sound`          | `false`     | Mute notification sounds for the buffer.              |
| `show_notifications`  | `true`      | Show desktop notifications while the page is running. |
| `traffic_as_activity` | `false`     | Treat join/part traffic as activity.                  |
| `server_as_activity`  | `true`      | Treat server messages as activity.                    |

### Link Previews and Media

| Key                                  | Default | Description                                                   |
| ------------------------------------ | ------- | ------------------------------------------------------------- |
| `show_link_previews`                 | `true`  | Show link preview handles.                                    |
| `inline_link_auto_previews`          | `true`  | Automatically embed previews in channels.                     |
| `inline_link_auto_previews_query`    | `true`  | Automatically embed previews in queries.                      |
| `inline_link_auto_preview_whitelist` | `.*`    | Regex whitelist for automatic inline previews.                |
| `hide_preview_cards`                 | `false` | Hide `[PREVIEW]` bridge cards without hiding `[EMBED]` cards. |

### Moderation and Commands

| Key                   | Default                                                       | Description                                       |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| `default_ban_mask`    | `*!%i@%h`                                                     | Default ban mask.                                 |
| `default_kick_reason` | `Your behaviour is not conducive to the desired environment.` | Default kick reason.                              |
| `ignore_bots`         | `false`                                                       | Ignore messages from known bots.                  |
| `lenient_rerouting`   | `true`                                                        | Trust `+channel-context` rerouting when possible. |
| `share_typing`        | `true`                                                        | Share typing state with other users.              |

## Avatars

| Key                             | Default             | Description                                                                                                                    |
| ------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `avatars.fallback_avatar_url`   | `""`                | Fallback avatar URL. `{nickname}` is replaced with the URL-encoded lowercase nick. An empty URL uses the selected local style. |
| `avatars.fallback_style`        | `"local-identicon"` | `local-initials`, `local-identicon`, DiceBear, or `custom`.                                                                    |
| `avatars.away_status_position`  | `1`                 | Away-dot corner: `1` top-right, `2` bottom-right, `3` bottom-left, `4` top-left.                                               |
| `avatars.initials_length`       | `1`                 | Initials shown in local fallback avatars: `1` or `2`.                                                                          |
| `avatars.show_image_background` | `true`              | Show the colour background behind avatars. When disabled, local initials and identicons use the nickname colour.               |
| `avatars.show_without_user`     | `false`             | Show avatars for messages without a known user.                                                                                |

## Text Formats

`textFormats` is an object keyed by system-message type. Each value is a format
string with `%key` placeholders replaced from event data. Unknown keys become
empty strings.

Common placeholders:

- `%nick`
- `%username`
- `%ident`
- `%host`
- `%text`
- `%channel`
- `%reason`
- `%prefix`
- `%message`
- `%server`
- `%info`
- `%realname`
- `%name`
- `%destination`

Defaults live in `src/res/configTemplates.js`. Changing these affects system
messages and traffic lines, not user chat text.

## Aliases

`aliases` is a newline-delimited string. Each line starts with `/` and defines a
command:

```text
/alias /target $1+
```

Alias variables:

- `$0` — the command being run.
- `$1` — first parameter.
- `$1+2` — two parameters starting at `$1`.
- `$2+4` — four parameters starting at `$2`.
- `$2+` — second parameter plus everything after.
- `$variable` — configured variable. Common variables are `$network`, `$server`,
  `$channel`, `$query`, `$destination`, and `$nick`.
- `$var?` — only run when the variable exists.
- `|` — separates multiple commands.

Lines that do not start with `/` are ignored, so `#` comments are allowed.
Aliases are editable in config and in the settings screen.

## Plugins

Enable plugins with the top-level `plugins` array:

```json5
"plugins": [
    { "name": "my-plugin", "url": "static/plugins/my-plugin.html" }
]
```

- The config template enables the bundled channels sidebar, NephDeck, NephWave,
  Bongo Companion, radio, and `suggest-limnoria` plugins.
- An empty array loads no plugins.
- HTML plugins are injected with `innerHTML`; use `<i></i>`, not `<i />`.
- URLs resolve relative to the plugin HTML file.
- Plugin-specific settings live under their own namespaces.

See [PLUGINS.md](PLUGINS.md) for authoring, UI hooks, events, translations, and
media playback.

## File Uploads

```json5
"fileupload": {
    "service": "none",
    "use_filehost": true,
    "litterbox": {
        "retention": "72h"
    },
    "catbox": {
        "userhash": ""
    },
    "sharebin": {
        "retention": "7d"
    },
    "webdav": {
        "upload_url": "",
        "access_url": "",
        "username": ""
    }
}
```

- `service` is the global preferred upload service: `none`, `litterbox`,
  `catbox`, `filebin`, `sharebin`, `uguu`, or `webdav`. `filehost` is not a
  global service choice.
- Catbox, Filebin, ShareBin.eu, Uguu, and WebDAV are desktop-only because their
  upload endpoints do not reliably support browser CORS.
- `use_filehost` is the default for new networks. Networks prefer FILEHOST when
  it is available unless this is set to `false`.
- `litterbox.retention` is `1h`, `12h`, `24h`, or `72h`.
- `catbox.userhash` is optional and links uploads to a Catbox account.
- `sharebin.retention` is `1d`, `7d`, `30d`, or `never` and defaults to `7d`.
- Uguu files expire after 3 hours. Filebin files are deleted after 6 days.
- `webdav.upload_url` is the PUT destination. `webdav.access_url` is the public
  base URL and defaults to the upload URL. `webdav.username` is optional. The
  WebDAV password is a user secret and must not be placed in public config.
- WebDAV uploads use a unique timestamp-and-random filename with the original
  extension preserved, so existing files are not overwritten.
- `filehost` is not a URL. The upload URL comes from `draft/FILEHOST`, falling
  back to `soju.im/FILEHOST`.
- `FILEHOST` requires a completed SASL login and the stored SASL password.
- Plain `http` is refused when the gateway/WebSocket connection uses TLS.
- The SASL account has any `/network` or `@client` suffix stripped before HTTP
  Basic authentication.
- Resumable uploads are not implemented.

## Limnoria

The `/lim` command, command suggestions, syntax hints, and per-network settings
come from the bundled `suggest-limnoria` plugin. Without that plugin, `/lim` is
not a Kiwi input command and no Limnoria command data is loaded.

The default `plugins` list includes the plugin. Defining your own `plugins`
array replaces the defaults, so include this entry to keep Limnoria support:

```json
{
  "name": "suggest-limnoria",
  "url": "static/plugins/suggest-limnoria.html"
}
```

```json5
"limnoria": {
    "suggestions": true,
    "name": "SupyBot",
    "plugins": "Admin, Channel, Config, Misc, Owner, User"
}
```

- `suggestions` enables the `/lim` input command and its local suggestions. The
  plugin default is `false`. When disabled, `/lim` reports that it is turned
  off.
- `name` is the bot nick used for private `/msg` delivery and channel `<name>:`
  commands. The default is `SupyBot`.
- `plugins` is a comma- or space-separated list used for local suggestions and
  help. It defaults to the six core plugins above. An empty value disables local
  suggestions, but typed `/lim` commands still use the full command table.
- Per-network settings override these defaults.
- Manually typed `/lim` commands still work when their plugin is not listed.
- Channel-context commands use `<name>: <command>` and need a channel with the
  bot present. Private-preferred commands use `/msg`. In a PM with Limnoria
  itself, commands are sent without any prefix.
- All command names, syntax, and delivery rules live in
  `static/plugins/suggest-limnoria/commands.json`.

## Remote Autocomplete

`/auto` explicitly opts a message into remote autocomplete requests:

```text
/auto SupyBot: foo<TAB>
/auto !discord <TAB>
```

Pressing Tab sends `+draft/autocomplete-request` to the current channel or query
with the text after `/auto ` and without the `/auto ` prefix. Any bot may answer
with `+draft/autocomplete-response`; responses are shown with the responding
bot's nick. When the message is sent, the `/auto ` prefix is stripped and the
remainder is sent as a normal message.

Run `/auto` by itself to toggle always-auto mode for the current network. The
input bar is highlighted and shows a Tab hint while it is on. In this mode, Tab
sends ordinary channel or query text as the request without requiring `/auto `.
Run `/auto` again to return to manual mode. Always-auto is session-only and is
not saved or restored across reloads.

This requires `message-tags` and an allowed `+draft/autocomplete-request` client
tag. It is independent of the Limnoria settings. `/lim`, `/msg <bot>`, and slash
commands never send remote autocomplete requests, even in always-auto mode.

## Bouncer Networks

Use `startupScreen: "bouncer"` for modern bouncers.

- Supports `draft/bouncer-networks` or `soju.im/bouncer-networks`, preferring
  the draft name.
- Negotiates exactly one base capability and one matching notify capability.
- The unbound control connection appears as an always-visible `BNC` network.
- Bound networks behave like ordinary IRC connections.
- BNC, Account, and Register tabs follow the capability probe.
- In Account mode, Bouncer User maps to `connection.account`; Bouncer Password
  maps to `network.password`; Server Password maps to `connection.password`.
- In BNC mode, Bouncer User maps to `network.username`; Bouncer Password maps to
  `connection.password`; no SASL is used. The nick is the user with the first
  `@` or `/` suffix stripped.
- Bouncer-managed networks use explicit Save and Connect/Reconnect actions.
- On Soju, the settings page can prefill
  `sasl set-plain -network <name> <account> <password>` into the `BouncerServ`
  query. It is never sent automatically.

## Security and Privacy

- The config file is public. Never store passwords, SASL secrets, or user hashes
  in it.
- `network.password` and `connection.password` are visible to the browser if set
  in config. Prefer the login form.
- User settings are stored in browser storage. Remember Me can purge saved
  state.
- `startupOptions.state_key` changes the storage namespace. An empty value
  disables saved state.
- Web Push registrations are stored in the browser and scoped per network.
- File uploads use the SASL secret only after login.
- There is no server-side application state.

## Common Mistakes

- Leaving `kiwiServer` at the example URL.
- Assuming `restricted` defaults to `false`; the config template defaults to
  `true`, while the starter file sets `false`.
- Setting `themes` or `plugins` and expecting arrays to append; arrays replace.
- Expecting `config.local.json` in production; it is development-only.
- Forgetting that `probeServerCaps` adds one connection per probed endpoint, and
  that custom endpoints are not probed.
- Setting `limnoria.suggestions` to `false` and expecting `/lim` to work.
- Removing `suggest-limnoria` from a custom `plugins` list and expecting `/lim`
  or Limnoria settings to remain.
- Setting `limnoria.plugins` to empty and expecting local suggestions.
- Setting `fileupload.service` to `filehost`; FILEHOST is a per-network
  preference and is used automatically when available.
- Setting `state_key` empty and expecting saved state.
- Using global `showRaw` instead of the per-network raw-buffer setting.
- Putting secrets in `static/config.json` or `static/config.local.json`.
