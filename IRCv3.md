# KiwiIRC IRCv3 Technical Reference

KiwiIRC utilizes IRCv3 capabilities and extensions to provide a high-fidelity,
authoritative, and synchronized chat experience across multiple sessions.

## Capability Negotiation

KiwiIRC explicitly requests the following capabilities during connection and via
`CAP NEW`:

### Synchronization & Consistency

- **echo-message**: Authoritatively acknowledges outgoing messages by echoing
  them back.
- **labeled-response**: Correlates echoes and server responses with outgoing
  commands using unique labels.
- **message-tags**: Enables parsing of rich metadata attached to IRC messages.
- **batch**: Groups related commands (e.g., multiline or history playback) for
  atomic processing.
- **server-time**: Ensures accurate message timestamps by utilizing
  server-provided UTC times.

### User Identity & State

- **sasl (v3.1 & v3.2)**: Modern authentication with priority for
  `SCRAM-SHA-256` over `PLAIN`.
- **account-notify**: Tracks service login/logout status of users in real-time.
- **account-tag**: Provides the authoritative account name on every incoming
  message.
- **extended-join**: Retrieves account names and realnames immediately upon user
  join.
- **chghost**: Updates user hostnames dynamically without requiring a cycle.
- **setname**: Allows authoritative updates to a user's realname (gecos) at
  runtime.
- **away-notify**: Synchronizes real-time "away" status for all visible users.

### Advanced Messaging

- **draft/chathistory**: High-fidelity backlog retrieval using `BEFORE`,
  `AFTER`, and `LATEST` operations.
- **draft/event-playback**: Requests inclusion of non-message events (joins,
  parts, modes) in history streams.
- **draft/multiline**: Supports atomic delivery of long messages using
  specialized batches and tags.
- **draft/message-redaction**: Enables permanent removal of message content from
  the authoritative log.
- **draft/read-marker**: Synchronizes the read status of buffers across multiple
  clients and sessions. Utilizes informational `MARKREAD` requests to establish
  synchronization boundaries for query buffers where `JOIN` events are absent.
- **+channel-context**: Client-only tag used on `PRIVMSG` and `NOTICE` to route
  messages between buffers (e.g. PM to Channel or Channel to Channel).

### Helper Capabilities

- **multi-prefix**: Shows all applicable user prefixes (e.g., `~@`) in member
  lists.
- **userhost-in-names**: Provides full hostmasks in `NAMES` replies for
  immediate user state initialization.
- **invite-notify**: Receives notifications when users are invited to channels.
  Notifications are contextually routed to the relevant channel buffer if the
  user is already present.
- **cap-notify**: Dynamically reacts to capability changes on the server.
- **extended-isupport**: Enables receipt of `RPL_ISUPPORT` tokens during
  capability negotiation, allowing for early branding and state initialization
  before registration finishes.
- **draft/metadata-2**: Supports retrieval and synchronization of public user
  and channel metadata (`display-name`, `pronouns`, `description`, `homepage`,
  `status`, `color`) for enriched social interaction. KiwiIRC authoritatively
  respects server-provided resource limits (`max-subs`, `max-keys`,
  `max-value-bytes`) and enforces a 30-minute proactive fetch cooldown. Social
  colors are automatically snapped to a 4.5:1 contrast ratio against the theme
  background, and standard IRC `/AWAY` messages take precedence over social
  status keys.

## Authoritative Synchronization Logic

KiwiIRC employs a 3-scenario model to maintain a consistent state:

1. **Scenario 1 (Instant)**: For networks lacking echo support, UI updates are
   performed optimistically.
1. **Scenario 2 (Heuristic Pending)**: On `echo-message` networks without
   labels, matches echoes via "nick + text + time window" or `msgid` heuristics.
1. **Scenario 3 (Labeled Pending)**: Utilizing `labeled-response`, provides
   $O(1)$ promotion of local "pending" state to authoritative server state using
   session-unique labels.

The "seen" boundary for all scenarios is inclusive of the authoritative marker
timestamp, ensuring context replayed exactly at the marker does not trigger
visual or audio notifications.

Pending items automatically revert and log an error after 60 seconds if no
server confirmation arrives.

## Metadata-Synchronized History Handshake

KiwiIRC gates initial `CHATHISTORY` requests to ensure all necessary metadata
(member lists, sync boundaries) is authoritatively established:

- **Channel Synchronization**: requests strictly wait for the `RPL_ENDOFNAMES`
  (366) numeric. This ensures member lists are fully populated for rerouting and
  security checks.
- **Query Synchronization**: requests wait for a `MARKREAD` echo or a 2-second
  safety timeout.
- **Network Readiness**: history retrieval is synchronized network-wide; every
  enabled channel must finish its handshake (or timeout) before replayed traffic
  is processed.

## Intelligent Message Rerouting

Utilizing the `+channel-context` tag, KiwiIRC supports two routing models:

1. **Lenient (Default)**: Trust the tag for all traffic (live and history) if
   the target buffer exists.
1. **Strict**: Reroute only if both sender and receiver are present in the
   destination channel, or if the original target was a private message queue.
   Rerouting is explicitly disabled for historical traffic in this mode.

**Dual-Path Interaction Security**: Reactions and redactions resolve correctly
if the sender is present in either the context buffer (where displayed) or the
original buffer (protocol destination).

## ISUPPORT Intelligence

KiwiIRC examines specific `RPL_ISUPPORT` tokens to adjust its behavior:

- **CHATHISTORY / MSGREFTYPES**: Determines retrieval limits and preferred
  reference formats (e.g., `msgid` vs `timestamp`).
- **BOT**: Identifies automated users for specialized UI rendering (🤖).
- **WHOX**: Optimizes metadata retrieval (accounts, SSL status) via token-based
  correlation.
- **ACCOUNTEXTBAN / EXTBAN**: Constructs protocol-compliant account-based bans
  based on server support.
- **CLIENTTAGDENY**: Respects server restrictions on outgoing client tags.
- **UTF8ONLY**: Automatically enforces `utf8` encoding and restricts non-ASCII
  outgoing actions (like emoji reactions) on traditional networks to prevent
  protocol-level garbling.
- **NETWORK**: Displays the canonical network name in the server information
  view.
- **DRAFT/ICON**: Supports server-provided network branding. Template variables
  like `{size}` are automatically resolved (standardized on 64px for caching).
  If no token is provided but the server is identified as Ergo (via `IRCD` token
  or numeric `002`), KiwiIRC automatically falls back to `/static/ergo.svg`.
- **DRAFT/FILEHOST**: Preferred upload URI when `fileupload.service` is
  `filehost`.
- **SOJU.IM/FILEHOST**: Fallback upload URI when `draft/FILEHOST` is absent or
  unusable.

Note: All `RPL_ISUPPORT` keys are normalized to uppercase within the state
singleton to ensure robust architectural lookups.

## File Host Uploads

When `fileupload.service` is `filehost`, KiwiIRC uploads to the ISUPPORT URI.
`draft/FILEHOST` is preferred. `soju.im/FILEHOST` is used only if the draft
token is absent or unusable. Empty or non-string tokens are ignored. Plain
`http` is refused when the IRC connection is TLS.

Uploads require a completed SASL login. The request is an HTTP `POST` of the
file body with `Content-Type` and `Content-Disposition: attachment`, using HTTP
Basic. KiwiIRC does not implement `OAUTHBEARER`, so Bearer auth is not used.
Success is `201 Created` plus a `Location` header, resolved against the upload
URL. Resumable uploads are not implemented.

## Operational Constraints

### History Limits

KiwiIRC authoritatively caps single `CHATHISTORY` requests to 250 messages for
efficiency. Larger unread backlogs are retrieved via automated recursive
gap-filling.

### Boundary Sanitization

`CHATHISTORY` references strictly exclude synthetic traffic (e.g., local
connection notices) to prevent synchronization boundary pollution.

## Specification Deviations & Constraints

### Message Redaction (TAGMSG Suppression)

KiwiIRC intentionally ignores `REDACT` commands targeting `TAGMSG` events (e.g.,
reactions).

- **Rationale**: Reactions already possess a ratified `+draft/unreact` mechanism
  for state removal. Supporting redaction for these is redundant and increases
  the risk of state desync between the reaction engine and the message log.

### Authoritative Replies

KiwiIRC strictly routes `FAIL`, `WARN`, and `NOTE` messages to the relevant
buffer context (channel or query) based on command arguments or active labels,
rather than cluttering the server status tab.
