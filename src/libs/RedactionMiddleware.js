'kiwi public';

/**
 * Adds the draft/message-redaction IRCv3 spec to irc-framework
 */
export default function redactionMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        parsedEvents.use(theMiddleware.bind(null, network));
    };
}

export function theMiddleware(network, command, message, client, next) {
    if (!message) {
        if (next) next();
        return;
    }

    const effectiveCommand = (command === 'unknown command' && message.command)
        ? message.command.toUpperCase()
        : command.toUpperCase();

    if (effectiveCommand !== 'REDACT') {
        if (next) next();
        return;
    }

    // REDACT <target> <msgid> [:<reason>]
    let target = message.params[0];
    const msgid = message.params[1];
    const reason = message.params[2] || '';
    const label = message.tags.label;

    if (!target || !msgid) {
        if (next) next();
        return;
    }

    const initialBuffer = network.bufferByName(target);
    const resolved = network.resolveMessage(msgid, initialBuffer, message.nick);
    if (!resolved) {
        if (next) next();
        return;
    }

    const { message: targetMessage, buffer } = resolved;

    if (targetMessage.type === 'tagmsg') {
        if (next) next();
        return;
    }

    // If this is an echo of our own redaction, handle promotion
    if (message.nick.toLowerCase() === client.user.nick.toLowerCase()) {
        if (label) {
            network.appState.promotePendingLabel(network.id, label);
        } else {
            // Scenario 2: Heuristic echo
            targetMessage.is_pending = false;
        }
    }

    targetMessage.is_redacted = true;
    targetMessage.redacted_by = message.nick;
    targetMessage.redaction_reason = reason;

    network.appState.$emit('message.redaction', {
        message: targetMessage,
        buffer: buffer,
    });

    // We handled it, do not call next() so the unknown command handler doesn't catch it
}
