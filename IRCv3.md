# Kiwi IRC IRCv3 Technical Reference

Kiwi IRC requests a fixed set of IRCv3 capabilities and uses several client-only
tags. `RPL_ISUPPORT` tokens adjust history, branding, bans, and file uploads.

## Capability Negotiation

Kiwi IRC requests the following capabilities during connection and again on
`CAP NEW`.

### Synchronization

- **echo-message**: Echoes outgoing messages so the client can confirm them.
- **labeled-response**: Correlates echoes and server responses with outgoing
  commands using unique labels.
- **message-tags**: Parses tags attached to IRC messages.
- **batch**: Groups related commands, such as multiline sends or history
  playback.
- **server-time**: Uses server-provided UTC timestamps.
- **draft/chathistory**: Retrieves backlog with `BEFORE`, `AFTER`, and `LATEST`.
- **draft/event-playback**: Includes joins, parts, and modes in history.
- **draft/multiline**: Sends long messages as one batch.
- **draft/message-redaction**: Removes message content from the log.
- **draft/read-marker**: Syncs read status across clients. Informational
  `MARKREAD` requests set a boundary for query buffers, which have no `JOIN`.
- **draft/relaymsg**: Marks messages relayed from another network. The relayer's
  nick arrives in the `draft/relaymsg` tag on the rewritten message.

### Identity

- **away-notify**: Tracks away status for visible users.
- **invite-notify**: Shows invites. If the user is already in the channel, the
  notice goes to that channel buffer.
- **account-notify**: Tracks account login and logout for visible users.
- **account-tag**: Carries the account name on incoming messages.
- **extended-join**: Includes account and realname on join.
- **chghost**: Updates a user's hostname without a rejoin.
- **setname**: Updates the user's realname (gecos) at runtime.
- **draft/account-registration**: Registers an account with `REGISTER` (plus
  `VERIFY` when the server asks for a code) instead of NickServ commands.
  Connected users without a SASL account get a Register Account action in their
  own profile. When the server advertises `before-connect` and the login page
  probe sees it, a Register tab appears next to Login: the attempt is armed
  before connect, `CAP END` is held open with a `kiwi-register-wait` token while
  `REGISTER` runs (5s backstop), and a `FAIL` aborts back to the form with the
  server's message. Successful registrations authenticate like SASL logins and
  persist under Remember Me.
- **draft/metadata-2**: Syncs public user and channel metadata (`display-name`,
  `pronouns`, `description`, `homepage`, `status`, `color`). Kiwi IRC respects
  `max-subs`, `max-keys`, and `max-value-bytes`, and waits 30 minutes between
  proactive fetches. Social colours are adjusted to at least 4.5:1 contrast
  against the theme background. An IRC away message takes precedence over the
  social `status` key.
- **draft/metadata-3**: Preferred over `draft/metadata-2` when a server
  advertises both; only one metadata capability is ever requested. Channel joins
  subscribe without an explicit `GET` (the server guarantees metadata or a
  `774`), `max-key-bytes` is enforced locally (default 64 bytes), and `775` rate
  limits are honored the same way as `774`.

SASL is negotiated when an account password is set. It is not in the
always-requested list above. Kiwi IRC prefers `SCRAM-SHA-256` over `PLAIN`.

### Helpers

- **cap-notify**: Reacts to capability changes after registration.
- **multi-prefix**: Shows every user prefix in member lists, such as `~@`.
- **userhost-in-names**: Includes full hostmasks in `NAMES` replies.
- **standard-replies**: Receives `FAIL`, `WARN`, and `NOTE`, routed to the
  relevant buffer rather than the server tab.
- **draft/extended-isupport**: Receives `RPL_ISUPPORT` during capability
  negotiation, before registration finishes. The name is draft-prefixed: servers
  never advertise the unprefixed form, so requesting it literally would NAK.
  When the server ACKs it for a login without credentials, Kiwi IRC holds
  `CAP END` until the first `005` batch arrives (1s debounce, 5s absolute cap),
  then checks `draft/ACCOUNTREQUIRED` below. Logins with credentials ask for
  `ISUPPORT` too, but without holding negotiation open.
- **draft/persistence**: Reports server-side client persistence with
  `PERSISTENCE STATUS <client-setting> <effective>` (in the registration burst
  and whenever it changes). Kiwi IRC assumes non-persistent until told
  otherwise. A Preferred Persistence setting (Keep As-Is by default, otherwise
  Server Default / Enabled / Disabled, shown only for account logins on servers
  with the cap) sends `PERSISTENCE SET DEFAULT|ON|OFF` when it disagrees with
  the reported client setting, and treats the next `STATUS` as the actual truth.
  When the cap is negotiated for an account login, our post-001 channel joins
  are held until the first STATUS arrives (5s backstop assumes non-persistent):
  effectively ON suppresses our rejoins since the server kept us joined, while
  OFF runs them normally. Guests and networks without the cap always join
  immediately.
- **draft/webpush** (or **soju.im/webpush**): Browser push notifications. Kiwi
  IRC negotiates exactly one of the two names, preferring the draft form, and
  never both in one request. Push Notifications is an opt-in checkbox (default
  off), shown only for account logins on servers that negotiate a cap and send a
  VAPID key. When enabled, the browser subscribes via its vendor push service
  and Kiwi IRC sends WEBPUSH REGISTER with the endpoint and keys, renewing
  daily; toggling off sends WEBPUSH UNREGISTER. Server FAILs only clear the
  local registered flag (the message itself still surfaces) and never trigger a
  retry loop. A dependency-free worker in static/sw.js turns each pushed IRC
  line into a system notification.

## Client Tags

These tags are not capabilities. Kiwi IRC sends them only when the server allows
the tag.

- **+channel-context**: Sent on `PRIVMSG` and `NOTICE` to show a message in a
  different buffer, such as a query copied into a channel.
- **+reply**: Points a message at another message by `msgid`. If the server does
  not allow `+reply`, Kiwi IRC falls back to `+draft/reply`.
- **+draft/react**: Adds or removes a reaction on a message with an `msgid`.
- **+typing**: Shares typing state (`active`, `paused`, `done`) when the user
  has typing sharing enabled.

## Message Confirmation

Kiwi IRC uses one of three paths for outgoing messages:

1. **No echo**: The UI updates immediately.
1. **Echo without labels**: Matches the echo by nick, text, and a time window,
   or by `msgid`.
1. **Labeled echo**: Matches the echo with the label from `labeled-response`.

The seen boundary includes the server read-marker time. Traffic replayed at that
exact time does not notify. Pending messages revert and log an error after 60
seconds if the server does not confirm them.

## History Handshake

The first `CHATHISTORY` request waits until the buffer is ready:

- **Channels**: Wait for `RPL_ENDOFNAMES` (366) so the member list is complete.
- **Queries**: Wait for a `MARKREAD` echo, or 2 seconds.
- **Network**: Every enabled channel must finish this handshake, or time out,
  before replayed traffic is processed.

## Message Rerouting

`+channel-context` has two modes:

1. **Lenient (default)**: Trust the tag for live and historical traffic when the
   target buffer exists.
1. **Strict**: Reroute only when both users are in the destination channel, or
   when the original target was a query. Historical traffic is not rerouted.

Reactions and redactions are accepted when the sender is in either the buffer
where the message is shown or the buffer it was sent to.

## Relay Metadata

Relayed users created by `draft/relaymsg` are not real IRC users, so the
`METADATA` command cannot describe them. A relay bot may instead advertise a
`RELAYMETA` CTCP command, answered over `PRIVMSG` / `NOTICE` like this:

- Clients check support with `PRIVMSG <bot> :\001CLIENTINFO\001`. A response
  listing `RELAYMETA` means the bot speaks this dialect.
- Requests look like `PRIVMSG <bot> :\001RELAYMETA GET <target> [key ...]\001`,
  where `<target>` is the relayed nick and each key is a metadata name such as
  `avatar` or `display-name`. When keys are omitted, the bot answers with every
  public key it holds for that nick.
- The bot answers with one or more
  `NOTICE <client> :\001RELAYMETA DATA <target> <key>=<value> ...\001` lines.
  Pairs are separated by spaces; the value runs to the next space, so a value
  containing a space is not representable. Values use IRCv3 message-tag escaping
  (`\\` for backslash, `\s` for space, `\:` for semicolon, `\r` and `\n` for
  line breaks). A requested key with no value is returned bare, as `<key>=` with
  nothing after the sign.
- Unknown targets fail with
  `NOTICE <client> :\001RELAYMETA ERR <target> <code> [message]\001`.

There is no subscription or polling. A client asks once per nick and keeps the
answer for the session. Unanswered requests may be retried; a bot that stays
silent is treated as having no data.

## ISUPPORT Tokens

Keys are stored in uppercase.

- **CHATHISTORY / MSGREFTYPES**: Sets retrieval limits and whether references
  use `msgid` or `timestamp`.
- **BOT**: Marks automated users in the UI.
- **WHOX**: Retrieves accounts and TLS status with token correlation.
- **ACCOUNTEXTBAN / EXTBAN**: Builds account bans in the form the server
  accepts.
- **CLIENTTAGDENY**: Blocks outgoing client tags the server rejects.
- **UTF8ONLY**: Forces `utf8` and blocks non-ASCII outgoing actions, including
  emoji reactions, on networks that cannot carry them.
- **draft/ACCOUNTREQUIRED**: The connection cannot register without SASL
  authentication. When seen pre-registration on a credential-less login, Kiwi
  IRC aborts the connect with an `account_required` error instead of wasting a
  registration round-trip, so the login page can collect credentials first.
- **NETWORK**: Shows the network name in the server view.
- **DRAFT/ICON**: Network icon URL. `{size}` is replaced with `64`. If the token
  is missing and the server is Ergo (`IRCD` or numeric `002`), Kiwi IRC uses
  `/static/ergo.svg`.
- **DRAFT/FILEHOST**: Preferred upload URI when `fileupload.service` is
  `filehost`. See File Host Uploads.
- **SOJU.IM/FILEHOST**: Fallback upload URI when `draft/FILEHOST` is absent or
  unusable.

## File Host Uploads

When `fileupload.service` is `filehost`, Kiwi IRC uploads to the ISUPPORT URI.
`draft/FILEHOST` is preferred. `soju.im/FILEHOST` is used only if the draft
token is missing or unusable. Empty and non-string tokens are ignored.

Plain `http` is refused when `connection.tls` is set. That flag means the client
connection is TLS, including a TLS websocket to a gateway. It is not a separate
check of the gateway's upstream IRC link.

Uploads require a completed SASL login and the stored SASL password. A NickServ
`ACCOUNT` notify is not enough. The request is an HTTP `POST` of the file body
with `Content-Type` and `Content-Disposition: attachment`, using HTTP Basic.
Kiwi IRC does not implement `OAUTHBEARER`, so Bearer auth is not used.
`Content-Length` is left to the browser. Success is `201 Created` plus a
`Location` header, resolved against the upload URL. Resumable uploads are not
implemented.

## Operational Constraints

### History Limits

A single `CHATHISTORY` request is capped at 250 messages. Larger unread gaps are
filled with follow-up requests.

### Boundary Sanitization

`CHATHISTORY` references skip local notices, such as connection messages, so
those lines do not become sync boundaries.

## Specification Notes

### Message Redaction

Kiwi IRC ignores `REDACT` commands that target `TAGMSG` events, including
reactions. Reactions already have `+draft/unreact`. Redacting them as well can
desync the reaction state from the message log.

### Standard Replies

Replies are routed using the command arguments or the active label. Replies for
commands Kiwi IRC does not implement are shown generically, so arbitrary codes
need no per-code handling.
