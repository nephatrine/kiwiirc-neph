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

### Helper Capabilities

- **multi-prefix**: Shows all applicable user prefixes (e.g., `~@`) in member
  lists.
- **userhost-in-names**: Provides full hostmasks in `NAMES` replies for
  immediate user state initialization.
- **invite-notify**: Receives notifications when users are invited to channels.
- **cap-notify**: Dynamically reacts to capability changes on the server.

## Authoritative Synchronization Logic

KiwiIRC employs a 3-scenario model to maintain a consistent state:

1. **Scenario 1 (Instant)**: For networks lacking echo support, UI updates are
   performed optimistically.
1. **Scenario 2 (Heuristic Pending)**: On `echo-message` networks without
   labels, matches echoes via "nick + text + time window" or `msgid` heuristics.
1. **Scenario 3 (Labeled Pending)**: Utilizing `labeled-response`, provides
   $O(1)$ promotion of local "pending" state to authoritative server state using
   session-unique labels.

Pending items automatically revert and log an error after 60 seconds if no
server confirmation arrives.

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
