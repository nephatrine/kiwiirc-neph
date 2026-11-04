'kiwi public';

/**
 * Track and apply negated RPL_ISUPPORT tokens.
 *
 * irc-framework stores "-TOKEN" as an option instead of removing the previous
 * value, so Kiwi removes both forms after the framework has processed the line.
 */
export default function isupportMiddleware(network) {
    return function middleware(client, rawEvents) {
        client.advertisedIsupport = new Set();

        client.on('connecting', () => {
            client.advertisedIsupport = new Set();
        });

        rawEvents.use((command, message, rawLine, rawClient, next) => {
            if (command !== '005') {
                next();
                return;
            }

            const { advertised, negated } = parseIsupportTokens(message.params);
            advertised.forEach((key) => {
                rawClient.advertisedIsupport.add(key);
            });
            negated.forEach((key) => {
                rawClient.advertisedIsupport.delete(key);
            });

            next();

            negated.forEach((key) => {
                delete rawClient.network.options[key];
                delete rawClient.network.options['-' + key];
                delete network.isupport[key];
                delete network.isupport['-' + key];
            });

            if (negated.includes('CASEMAPPING') &&
                typeof network.reindexUsers === 'function'
            ) {
                network.reindexUsers();
            }
        });
    };
}

export function parseIsupportTokens(params) {
    const advertised = [];
    const negated = [];

    (params || []).slice(1).forEach((token) => {
        if (typeof token !== 'string' || !token) {
            return;
        }

        const isNegated = token[0] === '-';
        const key = token.slice(isNegated ? 1 : 0).split('=')[0].toUpperCase();
        if (!key) {
            return;
        }

        (isNegated ? negated : advertised).push(key);
    });

    return { advertised, negated };
}
