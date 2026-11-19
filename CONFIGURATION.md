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

- **`default`** — The full default configuration.
- **`irc`** — Inline message layout, hostnames shown, message info hidden,
  nicklist sidebar, no emoji picker, no coloured nicknames, no inline previews,
  and no typing sharing.
- **`team`** — Modern message layout, realnames shown, join/part traffic hidden,
  and nickname and mode changes shown.

The default config template enables the bundled channels sidebar,
`nephnet-cyberdeck`, `nephwave-desktop`, Bongo Companion, radio, and
`suggest-limnoria` plugins.

## Value Replacements

String values may use these placeholders. They are replaced before the config is
merged:

- `{{protocol}}` — Current page protocol, such as `https:` or `http:`.
- `{{wsprotocol}}` — `wss:` on HTTPS pages, otherwise `ws:`.
- `{{tls}}` — `true` on HTTPS pages, otherwise `false`.
- `{{hostname}}` — Current page hostname.
- `{{host}}` — Current page host and port.
- `{{port}}` — Current page port, defaulting to 443 or 80.
- `{{hash}}` — URL fragment without the leading `#`.
- `{{query}}` — Query string without the leading `?`.
- `{{referrer}}` — Document referrer.

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

- **`welcome`** — Single-network login for a public client tied to one network
  or gateway. Shows Anonymous, Account, and Register tabs when supported. Uses
  `startupOptions.server`, `port`, `tls`, `channel`, and `nick`;
  `probeServerCaps` adapts tabs, registration, and length limits; `altComponent`
  replaces the form.
- **`customServer`** — Multi-network screen with preset/custom server selection,
  IRC and Bouncer tabs, and identity tabs. Uses `presetNetworks`,
  `enableCustom`, and `enableTabs`. Supports URL-fragment auto-connect. This is
  the config template default.
- **`bouncer`** — Dedicated bouncer login for Soju or another modern
  `bouncer-networks` deployment. Connects to the bouncer control connection and
  loads its networks. Uses `draft/bouncer-networks` or
  `soju.im/bouncer-networks`; a completed probe without either shows an error,
  and BNC, Account, and Register tabs follow the probe.
- **`personal`** — Returning-user home with saved networks, Add Network,
  temporary connections, and Add to Existing Tab. Forces `restricted: false` so
  network settings remain available.
- **Custom component name** — Runs a startup component registered with
  `kiwi.addStartup(name, component)`. An unknown name throws a startup error.

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

**Connection**

- `server` — IRC server or gateway host. Default: empty. Empty uses the gateway
  default.
- `port` — Connection port. Default: `6667`. The effective default depends on
  TLS and direct mode.
- `tls` — TLS for the gateway or direct WebSocket. Default: `false`. This is not
  an upstream IRC TLS check.
- `direct` — Connect directly to the IRC server WebSocket instead of the
  gateway. Default: `false`.
- `channel` — Initial channel. Default: empty.
- `nick` — Initial nick. Default: `kiwi_?`. `?` is replaced with a random
  number.
- `websocket` — Direct WebSocket URI. Overrides `server`, `port`, `tls`, and
  `direct`.
- `direct_path` — WebSocket path used in direct mode. Default: empty.
- `encoding` — IRC encoding. `customServer` falls back to `utf-8` when creating
  a network.

**Saved State**

- `state_key` — Browser storage key. Default: `kiwi-state`. Empty disables saved
  state.
- `remember_buffers` — Include the buffer list in saved state. Default: `true`.

**Startup UI**

- `nick_format` — Pattern used to validate nick input. Default: empty.
- `probeServerCaps` — Probe server capabilities before rendering forms and
  presets. Default: `false`.
- `enableCustom` — Show the custom-server entry on `customServer`. Default:
  `true`.
- `enableTabs` — Show the IRC and Bouncer tabs on `customServer`. Default:
  `true`.
- `altComponent` — Replace the `welcome` form with a registered custom
  component.
- `greetingText` — Custom greeting text for startup screens.
- `buttonText` — Custom connect-button text.
- `footerText` — Custom footer text.
- `termsContent` — Terms or notice content shown on startup screens.
- `infoBackground` — Background image URL for the startup info panel.
- `infoContent` — Custom HTML content for the startup info panel.

### Advanced Startup Fields

These are mainly for preconfigured deployments and are accepted by the built-in
startup screens:

- `account` — Prefill the account/SASL username. Default: empty.
- `password` — Prefill the SASL password. Default: empty. This is public if set
  in config.
- `username` — Prefill the ident/username. Default: empty.
- `gecos` — Prefill the realname/GECOS. Default: empty.
- `showChannel` — Show the channel field. Default: `true`.
- `showNick` — Show the nick field (`welcome` only). Default: `true`.
- `showPassword` — Show the password field (`welcome` only). Default: `true`.
- `toggablePassword` — Allow toggling password visibility (`welcome` only).
  Default: `true`.
- `allowNoChannel` — Allow connecting without a channel. Default: `false` in
  `welcome`, `true` in `customServer`.
- `autoConnect` — Submit automatically when the form is ready (`welcome` only).
  Default: `false`.

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

## Connection & Network Defaults

- `kiwiServer` — WebSocket gateway URL. Default: `/webirc/kiwiirc/`. Empty
  disables gateway connections.
- `restricted` — Locks the client to one network and makes connection details
  read-only. Default: `true`.
- `autoReconnect` — Reconnect automatically after a disconnect. Default:
  `false`.
- `autoReconnectMaxWait` — Maximum reconnect delay in milliseconds. Default:
  `30000`.
- `autoReconnectMaxRetries` — Maximum reconnect attempts. Default: `10`.
- `disconnectOnSaslFail` — Disconnect when SASL authentication fails. Default:
  `true`.
- `defaultSaslMechanism` — SASL mechanism. Default: `AUTO`, which prefers
  SCRAM-SHA-256 over PLAIN.
- `quitMessage` — Quit message sent when the client disconnects. Default:
  `Page closed`.
- `warnOnExit` — Warn before leaving the page while connected. Default: `true`.
- `persistencePreference` — Per-network `draft/persistence` preference: `keep`,
  `default`, `on`, or `off`. Default: `keep`.
- `allowRegisterProtocolHandler` — Offer `irc://`/`ircs://` registration in
  Personal startup when a gateway is configured. Default: `false` on web, `true`
  on desktop.

### Per-Network Defaults

Several buffer defaults are copied into each new network and then owned by that
network:

- Persistence preference (`persistencePreference`)
- Typing sharing (`buffers.share_typing`)
- Lenient rerouting (`buffers.lenient_rerouting`)
- Redaction display (`buffers.show_redactions`)
- Bot messages (`showBotMessages`)
- User traffic (`show_joinparts`)
- Topic changes (`show_topics`)
- Nickname changes (`show_nick_changes`)
- Mode changes (`show_mode_changes`)
- Presence changes (`show_presence_changes`)
- Request history (`auto_request_history`)
- Direct message policy (`blockDirectMessages`)
- Message notifications (`alert_on`)
- Reaction notifications (`reactionNotifications`)
- Highlight replies (`highlightReplies`)
- Highlight group mentions (`highlightGroupMentions`)
- FILEHOST preference (`useFilehost`)

Changing these in Network Settings affects only that network. Changing the
config default affects networks created afterward.

`blockDirectMessages` is `default`, `block`, `allow`, or `friends`. `default`
uses the global `buffers.block_pms` value. `friends` currently blocks all new
direct messages until a friends list exists. `alert_on` is the network default
for buffers without a per-buffer override. Per-buffer notification settings
offer Default, All Messages, Only Highlights, and Never. Default removes the
buffer override and falls back to the network value, then the global
`buffers.alert_on`. `reactionNotifications` is `all`, `direct`, or `none`.
`highlightReplies` and `highlightGroupMentions` default to `true`.

Web Push is not configured in `config.json`. It is a per-network opt-in shown
only after login when the server negotiates `draft/webpush` or `soju.im/webpush`
and provides a VAPID key.

## Appearance & Interface

**Theme & Locale**

- `windowTitle` — Browser tab title. Default: `Kiwi IRC - The web IRC client`.
- `useMonospace` — Use the monospace font for messages. Default: `false`.
- `language` — UI language. Default: empty, which follows the browser.
- `theme` — Active theme name, including an installed desktop theme. Default:
  `Kiwi Dark`.
- `themes` — Theme definitions. Setting this replaces the built-in list.
- `google_fonts` — Fallback Google Fonts loaded for the active theme. Default:
  `Source Sans Pro`, `Source Code Pro`.

`themes` entries support `name`, `url`, `mode` (`light` or `dark`), and
`google_fonts`. A theme URL is a base path; Kiwi loads `<url>/theme.css`. If
`themes` is set, it replaces the built-in list rather than appending to it.

**Pickers & Input**

- `showEmojiPicker` — Show the emoji picker button. Default: `true`.
- `forceShowEmojiPicker` — Show the emoji picker even on touch devices. Default:
  `false`.
- `emojiPickerMaxVersion` — Maximum Unicode emoji version. `0` shows all
  versions. Default: `0`.
- `showColorPicker` — Show the colour picker button. Default: `true`.
- `showStylePicker` — Show the formatting/style picker button. Default: `true`.
- `showExportButton` — Show the Export Buffer button in buffer headers. Default:
  `false`.
- `showSendButton` — Show a send button on touch devices. Default: `false`.
- `showAutocomplete` — Enable command and nick autocomplete. Default: `true`.
- `autocompleteTokens` — Tokens that trigger autocomplete. Default:
  `["/", "#", "@"]`.

`showEmojiPicker` and `forceShowEmojiPicker` are also gated by the active
network supporting UTF-8. `forceShowEmojiPicker` only overrides the touch-device
check.

**Sidebar & Users**

- `showAwayStatusIndicators` — Show away and offline status dots. Default:
  `true`.
- `sidebarDefault` — Sidebar shown at startup: `nicklist`, `settings`, `about`,
  `user`, or empty. Default: `nicklist`.
- `showRaw` — Show raw server buffers globally. Default: `false`.
- `showChanlistModes` — Show channel modes in the channel list. Default:
  `false`.
- `nicklistGroupAway` — Sort away users after online users in the nicklist.
  Default: `true`.
- `nicklistGrouped` — Show privilege-based group headings in the nicklist.
  Default: `false`.
- `showColors` — Colour nicknames in the nicklist and messages. Default: `true`.
- `showPrefix` — Show IRC mode prefixes on nicklist and message author names.
  Default: `true`.
- `hideIgnored` — Hide ignored users from the nicklist. Default: `true`.

`sidebarDefault` only opens the sidebar on desktop widths; mobile keeps the
sidebar closed until the user opens it.

**Messages & Activity**

- `noticeActiveBuffer` — Route server notices to the active buffer when
  possible. Default: `true`.
- `skipHiddenMessages` — Skip hidden join/part/nick/mode events entirely.
  Default: `false`.
- `useBufferHistory` — Remember recently viewed buffers and reopen the last one.
  Default: `true`.
- `changeNickOnCollision` — Automatically try a new nick during registration if
  needed. Default: `true`.
- `highlights` — Space-separated extra highlight words. Default: empty.
- `showBotMessages` — Show bot messages by default. Default: `true`.

`skipHiddenMessages` skips processing for hidden events, not only their display.
Self-involved events are still processed.

Desktop users can install local ZIP theme, emoji pack, and plugin packages from
Settings. Installed content is stored in the desktop user-data directory and is
included in desktop profile archives. See [desktop/README.md](desktop/README.md)
for package formats.

### Compatibility & Advanced Keys

- `customEmojis` — Optional map of shortcode names to absolute `http`/`https`
  image URLs or root-relative paths beginning with `/`. Used for `:name:` custom
  emoji and custom-token reactions. Configured tokens take precedence over
  installed local packs, remote packs, and the Unicode shortcode table when
  `emojiPackPreference` is `local`. They are the final fallback when it is
  `remote`.
- `emojiPackPreference` — `local` (default) or `remote`. `local` prefers
  `customEmojis` and installed desktop packs over network/server/channel packs.
  `remote` reverses that order for unqualified `:name:` tokens. Local and remote
  packs both take precedence over the Unicode shortcode table.
- `remoteEmojiPacks` — Controls the default remote emoji-pack policy. Defaults
  to `true`. Network and channel packs use Default/Always/Never policies.
  Default follows this setting; Always loads even when this is disabled; Never
  keeps packs literal. Channel Default prompts only while this is enabled, and
  Always also fetches `draft/emoji` metadata for channels you have not joined.
- `hideSettings` — Hide the settings button in the state browser.
- `hide_advanced` — Hide the Advanced settings tab.
- `ircFramework` — Advanced `irc-framework` client options. Use with care.

## Buffer Defaults

These values are defaults for new buffers. A per-buffer or per-network setting
overrides them.

### Layout & Display

- `messageLayout` — `modern`, `corporate`, `compact`, `inline`, or `cyberdeck`.
  Default: `modern`. Corporate uses aligned chat bubbles; Cyberdeck uses avatar
  plates and cassette-style rails.
- `show_timestamps` — Show message timestamps. Default: `true`.
- `timestamp_format` — `%H:%M:%S`, `%l:%M:%S %p`, or `decimal` for decimal time.
  Other formats hide the Time System selector. Default: `%H:%M:%S`.
- `timestamp_full_format` — Full timestamp format. Default: empty, which uses
  the browser locale.
- `show_hostnames` — Show full `nick (user@host)` in JOIN/PART/QUIT messages and
  `ident@host` under the nick in Modern, Corporate, and Cyberdeck when Show Real
  Names is off. Default: `false`.
- `show_realnames` — Show realnames in the Modern, Corporate, and Cyberdeck
  message layouts. Default: `false`.
- `show_joinparts` — Show user JOIN/PART traffic. Default: `false`.
- `show_topics` — Show topic changes. Default: `true`.
- `show_topic_in_header` — Show topic in the header. Default: `false`; desktop
  defaults to `true`.
- `show_nick_changes` — Show nickname changes. Default: `false`.
- `show_mode_changes` — Show mode changes. Default: `true`.
- `show_presence_changes` — Show presence changes. Default: `false`.
- `show_buffer_groups` — Group buffers by type in the sidebar. Default: `true`.
- `nicklist_avatars` — Show avatars in the nicklist. Default: `true`.
- `show_message_info` — Show the message info action. Default: `true`.
- `extra_formatting` — Global Simple Markdown formatting. No per-buffer
  override. Default: `true`.
- `emoji_convert_as_typed` — Convert emoji shortcodes while typing. Default:
  `false`.
- `emoji_convert_incoming` — Convert emoji shortcodes in incoming messages.
  Default: `true`.
- `show_redactions` — `hidden`, `placeholder`, or `revealed`. Default:
  `placeholder`.
- `favorite` — Per-buffer favourite default. Default: `false`.

`show_hostnames` affects JOIN, PART, and QUIT messages, and adds a secondary
`ident@host` line in Modern, Corporate, and Cyberdeck layouts when Show Real
Names is disabled. The built-in `irc` template enables it by default.

Network settings can override the message filters with Default / No / Yes.
`Default` follows the global `buffers.*` value.

### History & Scrolling

- `scrollback_size` — Normal buffer scrollback. Default: `250`. Raw server
  buffers and desktop default to `500`.
- `prompt_leave` — Prompt before leaving `all`, `channels`, `queries`, or
  `none`. Default: `channels`.
- `who_loop` — Refresh away status with WHO every three minutes when
  `away-notify` is unavailable. Channels with more than 100 users are skipped.
  Default: `true`.
- `shared_input` — Share input across buffers. Default: `false`.
- `block_pms` — Default for blocking new direct messages. Per-network
  `blockDirectMessages` overrides it. Default: `false`.
- `warn_expected_command` — Warn when a slash command is preceded by whitespace.
  Default: `true`.

### Link Previews & Media

- `show_link_previews` — Show link preview handles. Default: `true`.
- `inline_link_auto_previews` — Automatically embed previews in channels.
  Default: `true`.
- `inline_link_auto_previews_query` — Automatically embed previews in queries.
  Default: `true`.
- `inline_link_auto_preview_whitelist` — Regex whitelist for automatic inline
  previews. Default: `.*`.
- `hide_preview_cards` — Hide `[PREVIEW]` bridge cards without hiding `[EMBED]`
  cards. Default: `false`; desktop defaults to `true`.

### Moderation & Commands

- `default_ban_mask` — Default ban mask. Default: `*!%i@%h`.
- `default_kick_reason` — Default kick reason. Default:
  `Your behaviour is not conducive to the desired environment.`
- `lenient_rerouting` — Trust `+channel-context` rerouting when possible.
  Default: `true`.
- `share_typing` — Network-level typing sharing. No per-buffer override.
  Default: `true`.

## Avatars

- `avatars.fallback_avatar_url` — Fallback avatar URL. `{nickname}` is replaced
  with the URL-encoded lowercase nick. An empty URL uses the selected local
  style. Default: empty.
- `avatars.fallback_style` — `local-initials`, `local-identicon`, DiceBear, or
  `custom`. Default: `local-identicon`.
- `avatars.away_status_position` — Away-dot corner: `1` top-right, `2`
  bottom-right, `3` bottom-left, `4` top-left. Default: `2`.
- `avatars.initials_length` — Initials shown in local fallback avatars: `1` or
  `2`. Default: `1`.
- `avatars.show_image_background` — Show the colour background behind avatars.
  When disabled, local initials and identicons use the nickname colour. Default:
  `true`.
- `avatars.show_without_user` — Show avatars for senders with a nick but no
  known user in Modern, Corporate, and Cyberdeck layouts. Uses the configured
  fallback URL; server notices without a nick get no avatar. Default: `true`.

## Notifications

- `buffers.alert_on` — Fallback for buffers without a network or per-buffer
  value. `never` suppresses message sounds and maps to Soju muted metadata.
  Default: `highlight`.
- `buffers.flash_title` — Taskbar flashing on `message`, `highlight`, or `off`.
  Default: `message`.
- `buffers.show_notifications` — Global desktop notifications. Default: `true`.
- `buffers.traffic_as_activity` — Treat JOIN/PART traffic as activity globally.
  Default: `false`.
- `buffers.server_as_activity` — Treat server messages as activity globally.
  Default: `false`.
- `notificationSounds` — Play message and reaction notification sounds. Default:
  `true`.
- `unreadBadges` — Show unread counts and badges. Default: `true`.

Per-buffer unread badge display uses `unread_badge` (`default`, `hide`, or
`show`). `default` follows the global `unreadBadges` setting.

## Text Formats

`textFormats` is an object keyed by system-message type. Each value is a format
string with `%key` placeholders replaced from event data. Unknown keys become
empty strings.

Common placeholders:

- `%nick`, `%username`, `%ident`, `%host`, `%text`, `%channel`
- `%reason`, `%prefix`, `%message`, `%server`, `%info`
- `%realname`, `%name`, `%destination`

Defaults live in `src/res/configTemplates.js`. Changing these affects system
messages and traffic lines, not user chat text.

## Aliases

`aliases` is a newline-delimited string. Each line starts with `/` and defines a
command:

```text
/alias /target $1+
```

Alias variables:

- `$0` — The command being run.
- `$1` — First parameter.
- `$1+2` — Two parameters starting at `$1`.
- `$2+4` — Four parameters starting at `$2`.
- `$2+` — Second parameter plus everything after.
- `$variable` — Configured variable. Common variables are `$network`, `$server`,
  `$channel`, `$query`, `$destination`, and `$nick`.
- `$var?` — Only run when the variable exists.
- `|` — Separates multiple commands.

Lines that do not start with `/` are ignored, so `#` comments are allowed.
Aliases are editable in config and in the settings screen.

## Plugins

Enable plugins with the top-level `plugins` array:

```json5
"plugins": [
    { "name": "my-plugin", "url": "static/plugins/my-plugin.html" }
]
```

- An empty array loads no plugins.
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

- `service` — Global preferred upload service: `none`, `litterbox`, `catbox`,
  `filebin`, `sharebin`, `uguu`, or `webdav`. `filehost` is not a global service
  choice. Default: `none`.
- `use_filehost` — Default for new networks. Networks prefer FILEHOST when it is
  available unless this is `false`. Default: `true`.
- `litterbox.retention` — `1h`, `12h`, `24h`, or `72h`. Default: `72h`.
- `catbox.userhash` — Optional Catbox user hash that links uploads to an
  account. Default: empty.
- `sharebin.retention` — `1d`, `7d`, `30d`, or `never`. Default: `7d`.
- Uguu files expire after 3 hours. Filebin files are deleted after 6 days.
- `webdav.upload_url` — PUT destination. Default: empty.
- `webdav.access_url` — Public base URL. Defaults to the upload URL.
- `webdav.username` — Optional username. The WebDAV password is a user secret
  and must not be placed in public config.
- Catbox, Filebin, ShareBin.eu, Uguu, and WebDAV are desktop-only because their
  upload endpoints do not reliably support browser CORS.
- WebDAV uploads use a unique timestamp-and-random filename with the original
  extension preserved, so existing files are not overwritten.
- `filehost` is not a URL. The upload URL comes from `draft/FILEHOST`, falling
  back to `soju.im/FILEHOST`.
- FILEHOST requires a completed SASL login and the stored SASL password.
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

- `suggestions` — Enables `/lim` and its local suggestions. Default: `false`.
  When disabled, `/lim` reports that it is turned off.
- `name` — Bot nick used for private `/msg` delivery and channel `<name>:`
  commands. Default: `SupyBot`.
- `plugins` — Comma- or space-separated list used for local suggestions and
  help. Defaults to the six core plugins above. Empty disables local
  suggestions, but typed `/lim` commands still use the full command table.
- Per-network settings override these defaults.
- Manually typed `/lim` commands still work when their plugin is not listed.
- Channel-context commands use `<name>: <command>` and need a channel with the
  bot present. Private-preferred commands use `/msg`. In a PM with Limnoria,
  commands are sent without any prefix.
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

## Security & Privacy

- The config file is public. Never store passwords, SASL secrets, or user hashes
  in it.
- `network.password` and `connection.password` are visible to the browser if set
  in config. Prefer the login form.
- Browser builds store user settings in browser storage; desktop builds use
  local profiles. Remember Me can purge saved state.
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
