'kiwi public';

import {
    AUTOCOMPLETE_REQUEST,
    AUTOCOMPLETE_RESPONSE
} from './Autocomplete';

export default function autocompleteMiddleware(network) {
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

            if (event.tags[AUTOCOMPLETE_RESPONSE] !== undefined) {
                network.appState.$emit('autocomplete.response', {
                    network,
                    event,
                });
                return;
            }

            if (event.tags[AUTOCOMPLETE_REQUEST] !== undefined) {
                network.appState.$emit('autocomplete.request', {
                    network,
                    event,
                });
                return;
            }

            next();
        });
    };
}
