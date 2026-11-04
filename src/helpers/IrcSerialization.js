'kiwi public';

/**
 * Build the outgoing message object used for plugin events and serialization.
 *
 * Multiple raw arguments are kept as distinct parameters so an explicitly
 * empty trailing parameter is not lost while round-tripping through a string.
 *
 * @param {object} Irc irc-framework module
 * @param {Array} args raw() arguments
 * @returns {object|null}
 */
export function buildOutgoingMessage(Irc, args) {
    if (!args || args.length === 0) {
        return null;
    }

    if (args[0] instanceof Irc.Message || (args[0] && args[0].command && args[0].params)) {
        return args[0];
    }

    if (args.length === 1 && typeof args[0] === 'string') {
        return Irc.ircLineParser(args[0]);
    }

    const parts = Array.isArray(args[0]) ? args[0] : args;
    const command = String(parts[0] || '').toUpperCase();
    const params = parts
        .slice(1)
        .filter((item) => typeof item === 'number' || typeof item === 'string')
        .map((item) => String(item));

    return new Irc.Message(command, ...params);
}

/**
 * Serialize an IRC message, keeping an empty trailing parameter as ` :`.
 *
 * @param {object} message
 * @returns {string}
 */
export function serializeOutgoingMessage(message) {
    if (!message || typeof message.to1459 !== 'function') {
        return '';
    }

    let out = message.to1459();
    const params = message.params || [];
    if (params.length > 0 && params[params.length - 1] === '') {
        out = out.replace(/\s+$/, '') + ' :';
    }
    return out;
}
