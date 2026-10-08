'kiwi public';

import * as Misc from '@/helpers/Misc';

/** @module */

/**
 * Adds the draft/read-marker IRCv3 spec to irc-framework
 */
export default function readMarkerMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        addFunctionsToClient(client, network);
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

    if (effectiveCommand !== 'MARKREAD') {
        if (next) next();
        return;
    }

    const target = message.params[0];
    const timestamp = message.params[1];

    // Emit the event so state can handle it
    client.emit('read-marker', {
        target,
        timestamp,
        tags: message.tags,
    });

    // We handled it, do not call next() so the unknown command handler doesn't catch it
}

function addFunctionsToClient(client, network) {
    const readMarker = client.readMarker = {};

    function isSupported() {
        return network.hasCap('draft/read-marker');
    }

    readMarker.set = function set(target, ref) {
        if (!isSupported()) {
            return;
        }

        let refString = ref;
        if (ref instanceof Date) {
            refString = 'timestamp=' + Misc.dateIso(ref);
        } else if (typeof ref === 'string' && ref.indexOf('timestamp=') !== 0) {
            refString = 'timestamp=' + ref;
        }

        const tags = {};
        if (network.hasCap('labeled-response')) {
            tags.label = Misc.generateLabel();
        }

        client.raw('MARKREAD', target, refString, tags);
    };

    readMarker.get = function get(target) {
        if (!isSupported()) {
            return;
        }

        const tags = {};
        if (network.hasCap('labeled-response')) {
            tags.label = Misc.generateLabel();
        }

        client.raw('MARKREAD', target, tags);
    };
}
