# IRC Specifications & Features

This document lists the IRC protocol specifications and extensions used by Kiwi
IRC. Capability support depends on the IRC server version.

## Core Protocol

- [RFC 1459: IRC Protocol](https://www.rfc-editor.org/info/rfc1459/) (outdated)
- [RFC 2810: IRC Architecture](https://www.rfc-editor.org/info/rfc2810/)
- [RFC 2811: IRC Channel Management](https://www.rfc-editor.org/info/rfc2811/)
- [RFC 2812: IRC Client Protocol](https://www.rfc-editor.org/info/rfc2812/)
- [RFC 2813: IRC Server Protocol](https://www.rfc-editor.org/info/rfc2813/)
- [RFC 7194: Default Port for IRC over TLS](https://www.rfc-editor.org/info/rfc7194/)
- [Modern IRC Client Protocol](https://modern.ircdocs.horse/)

## Official IRCv3 Extensions

- [Capability Negotiation](https://ircv3.net/specs/extensions/capability-negotiation)
- [Message Tags](https://ircv3.net/specs/extensions/message-tags)
- Account Authentication & Registration
  - (draft)
    [Account Registration](https://ircv3.net/specs/extensions/account-registration)
  - [IRC v3.1 SASL](https://ircv3.net/specs/extensions/sasl-3.1)
  - [IRC v3.2 SASL](https://ircv3.net/specs/extensions/sasl-3.2)
  - [SASL PLAIN](https://www.rfc-editor.org/rfc/rfc4616)
  - [SASL SCRAM-SHA-256](https://www.rfc-editor.org/rfc/rfc7677)
- Account Tracking
  - [Account Extended Ban](https://ircv3.net/specs/extensions/account-extban)
  - [Account Notify](https://ircv3.net/specs/extensions/account-notify)
  - [Account Tag](https://ircv3.net/specs/extensions/account-tag)
  - [Extended Join](https://ircv3.net/specs/extensions/extended-join)
- [Away Notifications](https://ircv3.net/specs/extensions/away-notify)
- [Batches](https://ircv3.net/specs/extensions/batch)
  - (draft)
    [Client-Initiated Batches](https://ircv3.net/specs/extensions/client-batch)
  - [Netsplit & Netjoin Batch Types](https://ircv3.net/specs/batches/netsplit)
  - [Chathistory Batch Type](https://ircv3.net/specs/batches/chathistory)
- [Bot Mode](https://ircv3.net/specs/extensions/bot-mode)
- (draft) [Channel Renaming](https://ircv3.net/specs/extensions/channel-rename)
- Persistence
  - (draft) [Chat History](https://ircv3.net/specs/extensions/chathistory)
  - (draft)
    [Message Redaction](https://ircv3.net/specs/extensions/message-redaction)
  - (draft) [Read Marker](https://ircv3.net/specs/extensions/read-marker)
- Changing User Properties
  - [CHGHOST](https://ircv3.net/specs/extensions/chghost)
  - [SETNAME](https://ircv3.net/specs/extensions/setname)
- Client-Only Tags
  - [Channel Context](https://ircv3.net/specs/client-tags/channel-context)
  - [Message Replies](https://ircv3.net/specs/client-tags/reply)
  - (draft) [Message Reactions](https://ircv3.net/specs/client-tags/react)
  - [Typing Status](https://ircv3.net/specs/client-tags/typing)
- [Echo Message](https://ircv3.net/specs/extensions/echo-message)
- [Invite Notify](https://ircv3.net/specs/extensions/invite-notify)
- ISUPPORT
  - (draft)
    [Extended ISUPPORT](https://ircv3.net/specs/extensions/extended-isupport)
  - (draft) [Network Icon](https://ircv3.net/specs/extensions/network-icon)
- [Labeled Responses](https://ircv3.net/specs/extensions/labeled-response)
- Listing Users
  - [Multi-Prefix](https://ircv3.net/specs/extensions/multi-prefix)
  - [Userhost-in-NAMES](https://ircv3.net/specs/extensions/userhost-in-names)
  - [WHOX](https://ircv3.net/specs/extensions/whox)
  - (draft) [Oper Tag](https://ircv3.net/specs/extensions/oper-tag)
- [Message IDs](https://ircv3.net/specs/extensions/message-ids)
- (draft) [Metadata v2](https://ircv3.net/specs/extensions/metadata)
- (draft) [Multiline Messages](https://ircv3.net/specs/extensions/multiline)
- [Server Time](https://ircv3.net/specs/extensions/server-time)
- [Standard Replies](https://ircv3.net/specs/extensions/standard-replies)
- [UTF8ONLY](https://ircv3.net/specs/extensions/utf8-only)
- [WebSocket](https://ircv3.net/specs/extensions/websocket)

## Vendor Extensions

These extensions are only supported by specific vendors and not generally
available. In some cases the extensions have been proposed to become official
drafts and may gain wider support and interoperability in the future.

- Nephatrine
  - [RELAYMETA](#relaymeta)
  - Multiline Embed Card Batches
  - Bridged Username Detection
  - `+avatar`
  - `+display-name`
- Ergo
  - [RELAYMSG](https://github.com/ircv3/ircv3-specifications/blob/70c0957bf53f5476d3b671f36ea9a4a0c086a5e7/extensions/relaymsg.md)
    (PROPOSAL)
- Soju
  - [Bouncer Networks](https://codeberg.org/emersion/soju/src/branch/master/doc/ext/bouncer-networks.md)
    [(PROPOSAL)](https://github.com/ircv3/ircv3-specifications/blob/5fc35432ecab07f9ae6fef15c563e34d0446bf7f/extensions/bouncer-networks.md)
  - [FILEHOST](https://codeberg.org/emersion/soju/src/branch/master/doc/ext/filehost.md)
    [(PROPOSAL)](https://github.com/ircv3/ircv3-specifications/blob/9c583eaf143d38467df469da93d4297958bef804/extensions/filehost.md)
  - [Metadata](https://codeberg.org/emersion/soju/src/branch/master/doc/ext/metadata.md)
  - [Search](https://codeberg.org/emersion/soju/src/branch/master/doc/ext/search.md)
    [(PROPOSAL)](https://github.com/delthas/ircv3-specifications/blob/f1c46246e1e53e4f793beb00e5c57a217b04da4a/extensions/search.md)
  - [Web Push](https://codeberg.org/emersion/soju/src/branch/master/doc/ext/webpush.md)
    [(PROPOSAL)](https://github.com/ircv3/ircv3-specifications/blob/4c2410c4a2df611997fefc8d2d8adb432845fdce/extensions/webpush.md)
- [Twitch](https://dev.twitch.tv/docs/chat/irc/)
  - `twitch.tv/commands`
  - `twitch.tv/membership`
  - `twitch.tv/tags`

## Proposed Extensions

These extensions are not widely supported and may be subject to changes or never
end up as official drafts specs.

- [Autocomplete Client Tags](https://github.com/ircv3/ircv3-specifications/blob/cab233501c451a42262db1519ea294ab72079122/client-tags/autocomplete.md)
- [Custom Emoji](https://github.com/ircv3/ircv3-specifications/blob/12a841ca77aee21ec699740aa40367488cbed32d/extensions/custom-emoji.md)
- [Metadata v3](https://github.com/ircv3/ircv3-specifications/blob/31f377bbd0acc2afd8f89aa99cbd05e570707657/extensions/metadata.md)
- [Persistence](https://github.com/ircv3/ircv3-specifications/blob/b016f41d920494394d0a210317948489818295eb/extensions/persistence.md)

### RELAYMETA

`RELAYMETA` is a Kiwi IRC CTCP extension for describing relayed users. Relayed
users created by `draft/relaymsg` are not real IRC users, so the `METADATA`
command cannot describe them. A relay bot may instead answer `RELAYMETA` CTCP
requests for those synthetic nicks.

The reference bridge implementation is
[discord-irc](https://code.nephatrine.net/nephatrine/discord-irc). This document
defines the current dialect; there is no version field.

### Discovery

Clients check support with:

```text
PRIVMSG <bot> :\x01CLIENTINFO\x01
```

A response listing `RELAYMETA` means the bot speaks this dialect:

```text
NOTICE <client> :\x01CLIENTINFO ACTION CLIENTINFO RELAYMETA VERSION\x01
```

A bot that does not list `RELAYMETA` is marked unsupported and is not queried
again for that session.

### Request

```text
PRIVMSG <bot> :\x01RELAYMETA GET <target> [key ...]\x01
```

- `<target>` is the relayed nick and is matched case-insensitively.
- Each key is a metadata name such as `avatar` or `display-name`.
- When keys are omitted, the bot should answer with every public key it holds
  for that nick.
- Kiwi IRC requests `avatar`, `display-name`, `bot`, and `color`.
- There is no subscription or polling. A client asks once per nick and keeps the
  answer for the session.

Example request:

```text
PRIVMSG DiscordBot :\x01RELAYMETA GET x2Tuff4Ux/bridged avatar display-name bot color\x01
```

### Response

The bot answers with one or more lines:

```text
NOTICE <client> :\x01RELAYMETA DATA <target> <key>=<value> ...\x01
```

- Pairs are separated by spaces.
- A value runs to the next space, so spaces must be escaped.
- Key names are case-insensitive and are normalized to lowercase.
- A key with no value is returned as `key=`.
- If a key appears more than once, the last value wins.
- Unknown keys are ignored.
- Multiple `DATA` lines are allowed.

Kiwi IRC applies these keys:

- `avatar` — Sanitized URL used for the relayed user's avatar.
- `display-name` — Display name for the relayed user.
- `bot` — Bot label for the relayed user.
- `color` — Sanitized colour value for the relayed user.

**Example Response:**

```text
NOTICE kiwi :\x01RELAYMETA DATA username/bridged display-name=Some\sOne avatar=https://cdn.example/a.png bot=BillyBot\s8.0 color=#ff00aa\x01
```

### Escaping

Values use IRCv3 message-tag value escaping:

- `\\` — Backslash.
- `\s` — Space.
- `\:` — Semicolon.
- `\r` — Carriage return.
- `\n` — Line feed.

Kiwi IRC decodes an unknown `\x` sequence as `x`. A sender must escape spaces;
an unescaped space splits the pair. Kiwi IRC drops the preceding pair rather
than treating the bare token as part of the value.

### Errors

Unknown targets fail with:

```text
NOTICE <client> :\x01RELAYMETA ERR <target> <code> [message]\x01
```

`UNKNOWN_TARGET` is the minimum required code. Other codes are
implementation-defined. An `ERR` marks the target done and is not retried.

**Example Error:**

```text
NOTICE kiwi :\x01RELAYMETA ERR username/bridged UNKNOWN_TARGET no such user\x01
```

### Client Behavior

When a message carries `draft/relaymsg`, Kiwi IRC records the relayer nick and
the rewritten target nick, then:

1. Probes the relayer with `CLIENTINFO` once per bot.
2. Sends one `RELAYMETA GET` for the target when the bot advertises support.
3. Applies the returned metadata to the relayed user.
4. Marks the target done on `DATA` or `ERR`.

Requests are serialized per network:

- One outstanding request at a time.
- 5-second pump interval.
- 30-second response timeout.
- Two attempts per probe or target.
- Queue cap of 200 entries.
- Offline bots are parked until they join.
- Duplicate relay messages produce one probe and one request.
- `ERR` and successful `DATA` prevent further requests for that target.

`RELAYMETA` responses are consumed as protocol data and are not shown as CTCP
traffic. Echoes of Kiwi IRC's own machine-generated `CLIENTINFO` and `RELAYMETA`
requests are suppressed.

### Security

`RELAYMETA` values are untrusted. Avatar URLs and bot/colour values are
sanitized, and display names are rendered as text rather than HTML. Bots should
return only public metadata for the requested relayed nick.

### Non-Goals

`RELAYMETA` does not provide authentication, write access, server-side metadata
storage, subscriptions, or polling. It is a one-shot read-only description of a
relayed user for the lifetime of the client session.

## Specification Deviations

### Custom Emoji

We render custom emoji in circumstances the proposed spec does not allow. This
does match Discord's emoji handling much better, but it does leave you without
any way to "escape" a shortcode sequence. So we have made another deviation in
that we do not render shortcodes inside a code/monospace block, which also
matches Discord's behavior.

We also are more permissive in allowing cross-channel packs to be used by
`packid` even if their pack ID does not contain the channel name. My original
reading of the spec was that the channel name in a pack ID triggers the
cross-channel METADATA GET and so was helpful for allowing users in that other
channel to see the emote properly, but was not a hard requirement for rendering
cross-channel emotes. The spec author cleared this up, but we retain our
original relaxed implementation.

### Message Redaction

Kiwi IRC ignores `REDACT` commands that target `TAGMSG` events, including
reactions. The `draft/message-redaction` specification allows `PRIVMSG`,
`NOTICE`, or `TAGMSG` as the target and includes a `TAGMSG` redaction example.
Kiwi IRC deliberately does not apply those redactions because reactions already
have `+draft/unreact`, and redacting both can desync reaction state from the
message log.

### WebSocket Transport

Kiwi IRC accepts more than one IRC line in a single incoming text frame. The
WebSocket transport specification requires each message to contain a single IRC
line. This is a deliberate compatibility tolerance for legacy servers.

The no-subprotocol fallback is explicitly allowed by the specification and is
not a deviation.
