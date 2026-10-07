# KiwiIRC IRCv3 Support

This document outlines the current state of IRCv3 capability and extension support in KiwiIRC.

## Capability Negotiation

KiwiIRC explicitly requests and supports the following capabilities during the connection phase:

- **echo-message:** Acknowledges outgoing messages by echoing them back to the client. KiwiIRC uses this for authoritative synchronization and multi-client consistency.
- **labeled-response:** Correlates echoes and server responses with outgoing commands using unique labels. KiwiIRC uses this to accurately promote local pending messages to their authoritative server-side state.
- **draft/chathistory:** Allows retrieving message history from a server or bouncer. Supports `CHATHISTORY` and `MSGREFTYPES` ISUPPORT tokens and the `draft/chathistory-end` tag for authoritative synchronization.
- **draft/event-playback:** Requests that the server include non-message events (like `JOIN`, `PART`, `MODE`) in history playback.
- **bouncer:** Generic capability for bouncer-specific extensions.
- **chghost:** Updates user hostnames without requiring a quit/join cycle.
- **setname:** Allows updating a user's realname (gecos) at runtime.
- **SASL v3.1/v3.2:** Supports modern authentication negotiation with priority given to **SCRAM-SHA-256** over **PLAIN**. Implements full challenge-response logic using the Web Crypto API.

- **Standard Replies:** Implemented centralized handling for `FAIL`, `WARN`, and `NOTE` messages. KiwiIRC uses these to provide contextual feedback to the user and accurately revert local state if a command is rejected by the server.

The underlying `irc-framework`
 also automatically handles core capabilities such as `multi-prefix`, `userhost-in-names`, `message-tags`, `batch`, `server-time`, and `cap-notify`.

## Core Extensions

### Echoes & Labels (`echo-message` & `labeled-response`)
Implemented via `src/libs/InputHandler.js` and `src/libs/state.js`, these extensions provide a robust and consistent view of the chat history:
- **Local Echo:** Outgoing messages and reactions are added to the chat log immediately with a "pending" status (visualized by reduced opacity).
- **Authoritative Promotion:** When the server echoes the message back (optionally with a `label`), KiwiIRC correlates it with the local pending message, updates it with authoritative metadata (like `msgid` and `time`), and removes the pending status.
- **Strict ID Matching:** To ensure protocol compliance, all correlation logic strictly utilizes authoritative IRC `msgid` tags. Internal numeric IDs are never used for protocol-facing lookups or synchronization.
- **Reaction Synchronization:** Support for labels and local echo extends to message reactions (`+draft/react`). Outgoing reactions are correlated with server echoes to ensure the UI remains snappy and accurate.
- **Multi-Client Sync:** Incoming echoes without a matching local pending message are added as new messages, ensuring the client reflects activity from other sessions on the same account.
- **Robustness:** A timeout mechanism automatically reverts the pending status after 60 seconds if no confirmation is received, restoring the original state and logging a descriptive error to the buffer.
- **Heuristic Matching:** If the server supports `echo-message` but not `labeled-response`, KiwiIRC utilizes a "nick + text + time window" or "msgid" heuristic to accurately correlate echoes and failures with local state.

### CHATHISTORY (`draft/chathistory`)
Implemented via `src/libs/ChathistoryMiddleware.js`, this extension allows KiwiIRC to perform authoritative history queries:
- **Operations:** Supports `BEFORE`, `AFTER`, `LATEST`, `AROUND`, and `BETWEEN` using either `msgid` or `timestamp` references. Employs `labeled-response` for precise acknowledgment and failure correlation.
- **Intelligence:** Correctlly respects server-side limits defined in the `CHATHISTORY` ISUPPORT token and utilizes supported reference types from `MSGREFTYPES`.
- **End Detection:** Utilizes the `draft/chathistory-end` tag to authoritatively determine when history is exhausted, ensuring the UI accurately reflects available backlog.
- **Context:** Leverages the `draft/chathistory-context` tag to identify historical messages in the state, allowing for specialized rendering or behavior for recorded traffic.
- **Integration:** Integrated into `BufferState.js` to automatically request scrollback for channels and queries when they are opened or scrolled.
- **Batching:** Uses the `BATCH` extension to group related commands, ensuring they are processed together.
- **Event Playback:** Supports `draft/event-playback` to include joins, parts, and mode changes in history streams for complete buffer context.
    - **Netsplit/Netjoin:** Collapses large traffic floods during server partitions into single summary messages.
    - **draft/multiline:** Provides atomic delivery of long messages and pastes. Renders incoming multi-line messages as single cohesive blocks, and authoritatively sends outgoing multiline input using the `draft/multiline` batch type and `draft/multiline-concat` tag. Strictly adheres to server-advertised `max-bytes` and `max-lines` limits, providing user-facing warnings if exceeded. Supports recursive resolution when nested within other batches (e.g., `chathistory`). Utilizes internal outgoing batch tracking to ensure accurate failure routing to the correct buffer.


### Typing Notifications (`+typing` tag)
Implemented via `src/libs/TypingMiddleware.js`, supporting both `TAGMSG` and `PRIVMSG` events:
- **Statuses:** Supports `active`, `paused`, and `done` (cleared) statuses.
- **UI Feedback:** Real-time typing indicators are shown in the nicklist and buffer header based on incoming `+typing` tags.

### Message Reactions (`+draft/react` tag)
Implemented via `src/libs/ReactionMiddleware.js`, supporting both `TAGMSG` and `PRIVMSG` events:
- **Operations:** Supports `+draft/react` and `+draft/unreact` tags for adding and removing emoji reactions.
- **Integration:** Reactions are tracked per-message and displayed as reactive "pills" below the message body.
- **UI Feedback:** Users can react via the message info overlay or by clicking existing reaction pills. Tooltips display a list of users who have reacted with a specific emoji.

### Message Redaction (`draft/message-redaction`)
Implemented via `src/libs/RedactionMiddleware.js`, providing authoritative synchronization of message removals:
- **Operations:** Supports the `REDACT` command for permanent removal of message content from the scrollback log.
- **Authoritative Sync:** Incoming `REDACT` events are correlated with local messages via `msgid`, updating their state across all clients (including history playback).
- **Local Echo:** Outgoing redactions are applied immediately with a "pending" status and a label for authoritative confirmation.
- **UI Integration:** Redacted messages are replaced with an informative placeholder (`[Redacted by NICK - REASON]`) that can be clicked to reveal the original content in a struck-through state.
- **Spec Deviation:** KiwiIRC intentionally ignores `REDACT` commands for `TAGMSG` events. Since reactions are the primary use of `TAGMSG` and already possess a standardized `+draft/unreact` mechanism, redacting them is treated as redundant and is suppressed to maintain UI and state consistency.

### Standard Replies (`FAIL`, `WARN`, `NOTE`)
Implemented via `src/libs/IrcClient.js` and `src/libs/state.js`, this extension ensures that all server-side feedback is meaningful and contextual:
- **Intelligent Routing:** Commands like `FAIL REDACT` or `WARN INVITE` are automatically routed to the relevant channel or query buffer instead of the server status tab.
- **Authoritative Reversion:** When a `FAIL` message is received, KiwiIRC uses labels (priority) or heuristics (fallback) to find the local pending item and revert its state immediately.
- **Informative Logging:** The server-provided description is logged as a system message (styled as an error for `FAIL`/`WARN`) to provide immediate feedback to the user.

### Message Delivery & Identification
- **Message Tags:** KiwiIRC parses standard IRCv3 tags from all incoming messages.
- **Identification:** Uses `msgid` or `draft/msgid` tags for robust message de-duplication in the state.
- **Server-Time:** Automatically parses the `time` tag to provide accurate message timestamps, regardless of local client clock skew.

### Identity Tracking
KiwiIRC leverages `irc-framework` to maintain accurate user state using:
- **account-notify:** Tracks when users log in or out of services.
- **account-tag:** Provides the user's account name on every message, enabling continuous identity verification.
- **away-notify:** Real-time updates for user away status.
- **extended-join:** Provides account name and realname during the `JOIN` event.
- **bot mode:** Authoritatively identifies bot users and bot-authored messages using the `BOT` ISUPPORT token and the `bot` message tag. Displays persistent visual indicators (`🤖`) in the nicklist and chat view.
- **WHOX:** Leverages the `WHO` extension (gated by `RPL_ISUPPORT`) to retrieve extended user metadata (account names, SSL status) efficiently. Uses a token-based identification system to correlate requests and responses.
- **ACCOUNTEXTBAN:** Automatically detects authoritative account-based ban syntax via the `ACCOUNTEXTBAN` ISUPPORT token, with robust fallbacks for legacy networks.
