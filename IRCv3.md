# KiwiIRC IRCv3 Technical Reference

KiwiIRC requests a fixed set of IRCv3 capabilities and uses several client-only
tags. `RPL_ISUPPORT` tokens adjust history, branding, bans, and file uploads.

## Capability Negotiation

KiwiIRC requests the following capabilities during connection and again on
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
- **draft/metadata-2**: Syncs public user and channel metadata (`display-name`,
  `pronouns`, `description`, `homepage`, `status`, `color`). KiwiIRC respects
  `max-subs`, `max-keys`, and `max-value-bytes`, and waits 30 minutes between
  proactive fetches. Social colors are adjusted to at least 4.5:1 contrast
  against the theme background. An IRC away message takes precedence over the
  social `status` key.

SASL is negotiated when an account password is set. It is not in the
always-requested list above. KiwiIRC prefers `SCRAM-SHA-256` over `PLAIN`.

### Helpers

- **cap-notify**: Reacts to capability changes after registration.
- **multi-prefix**: Shows every user prefix in member lists, such as `~@`.
- **userhost-in-names**: Includes full hostmasks in `NAMES` replies.
- **extended-isupport**: Receives `RPL_ISUPPORT` during capability negotiation,
  before registration finishes.

## Client Tags

These tags are not capabilities. KiwiIRC sends them only when the server allows
the tag.

- **+channel-context**: Sent on `PRIVMSG` and `NOTICE` to show a message in a
  different buffer, such as a query copied into a channel.
- **+reply**: Points a message at another message by `msgid`. If the server does
  not allow `+reply`, KiwiIRC falls back to `+draft/reply`.
- **+draft/react**: Adds or removes a reaction on a message with an `msgid`.
- **+typing**: Shares typing state (`active`, `paused`, `done`) when the user
  has typing sharing enabled.

## Message Confirmation

KiwiIRC uses one of three paths for outgoing messages:

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
- **NETWORK**: Shows the network name in the server view.
- **DRAFT/ICON**: Network icon URL. `{size}` is replaced with `64`. If the token
  is missing and the server is Ergo (`IRCD` or numeric `002`), KiwiIRC uses
  `/static/ergo.svg`.
- **DRAFT/FILEHOST**: Preferred upload URI when `fileupload.service` is
  `filehost`. See File Host Uploads.
- **SOJU.IM/FILEHOST**: Fallback upload URI when `draft/FILEHOST` is absent or
  unusable.

## File Host Uploads

When `fileupload.service` is `filehost`, KiwiIRC uploads to the ISUPPORT URI.
`draft/FILEHOST` is preferred. `soju.im/FILEHOST` is used only if the draft
token is missing or unusable. Empty and non-string tokens are ignored.

Plain `http` is refused when `connection.tls` is set. That flag means the client
connection is TLS, including a TLS websocket to a gateway. It is not a separate
check of the gateway's upstream IRC link.

Uploads require a completed SASL login and the stored SASL password. A NickServ
`ACCOUNT` notify is not enough. The request is an HTTP `POST` of the file body
with `Content-Type` and `Content-Disposition: attachment`, using HTTP Basic.
KiwiIRC does not implement `OAUTHBEARER`, so Bearer auth is not used.
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

KiwiIRC ignores `REDACT` commands that target `TAGMSG` events, including
reactions. Reactions already have `+draft/unreact`. Redacting them as well can
desync the reaction state from the message log.

### Standard Replies

`FAIL`, `WARN`, and `NOTE` are routed to the relevant channel or query from the
command arguments or the active label. They are not dumped on the server tab.
KiwiIRC does not request the `standard-replies` capability.
