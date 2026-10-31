'kiwi public';

import {
    LIMNORIA_AUTOCOMPLETE_REQUEST,
    LIMNORIA_AUTOCOMPLETE_RESPONSE
} from './Limnoria';

export default function limnoriaMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        parsedEvents.use((command, event, clientArg, next) => {
            if (!event || !event.tags) {
                next();
                return;
            }

            const effectiveCommand = (event.command || command || '').toUpperCase();
            if (effectiveCommand !== 'TAGMSG') {
                next();
                return;
            }

            if (event.tags[LIMNORIA_AUTOCOMPLETE_RESPONSE] !== undefined) {
                network.appState.$emit('limnoria.autocomplete.response', {
                    network,
                    event,
                });
                return;
            }

            if (event.tags[LIMNORIA_AUTOCOMPLETE_REQUEST] !== undefined) {
                network.appState.$emit('limnoria.autocomplete.request', {
                    network,
                    event,
                });
                return;
            }

            next();
        });
    };
}
