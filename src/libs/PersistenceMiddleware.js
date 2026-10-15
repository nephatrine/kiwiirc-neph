'kiwi public';

// Maps the user's persistence preference to the PERSISTENCE SET wire value.
// 'keep' (Keep As-Is) never sends anything, so it maps to an empty string.
function preferenceToWire(preference) {
    if (preference === 'default') {
        return 'DEFAULT';
    }
    if (preference === 'on') {
        return 'ON';
    }
    if (preference === 'off') {
        return 'OFF';
    }
    return '';
}

// Reads the user's preference, falling back to Keep As-Is on junk values
// (e.g. a stale persisted setting from an older client).
function currentPreference(network) {
    const preference = network.appState.setting('persistencePreference');
    return ['keep', 'default', 'on', 'off'].includes(preference) ?
        preference :
        'keep';
}

export default function persistenceMiddleware(network) {
    // Wire value of the last PERSISTENCE SET sent while converging on the
    // user's preference. Reset whenever the server confirms the desired
    // value (or a new connection starts) so a refused SET can be retried
    // on the next STATUS instead of wedging, while a repeated STATUS for
    // an already-sent value never produces a second SET.
    let lastSentSet = '';

    return function middlewareFn(client, rawEvents, parsedEvents) {
        const maybeSendSet = () => {
            const desired = preferenceToWire(currentPreference(network));
            const reported = (network.persistence_status &&
                network.persistence_status.client) || '';
            if (!desired || desired === reported || lastSentSet === desired) {
                return;
            }
            lastSentSet = desired;
            client.raw('PERSISTENCE', 'SET', desired);
        };

        client.on('connecting', () => {
            // Assume non-persistent on every connection until the server
            // says otherwise via PERSISTENCE STATUS.
            network.persistence_status = { client: '', effective: 'OFF' };
            lastSentSet = '';
            // Drop any parked channel joins from the previous attempt.
            if (network.pending_channel_joins_timer) {
                clearTimeout(network.pending_channel_joins_timer);
            }
            network.pending_channel_joins = null;
            network.pending_channel_joins_timer = null;
        });

        // Lets the settings panel apply a preference change immediately
        // against the last reported STATUS instead of waiting for the next
        // one (servers only send STATUS on change or at connect).
        network.setPersistencePreference = () => {
            maybeSendSet();
        };

        parsedEvents.use((command, event, clientArg, next) => {
            if (!event) {
                next();
                return;
            }

            // Unknown verbs (PERSISTENCE included) arrive as command
            // 'unknown command' with the real verb on event.command.
            const effectiveCmd = (event.command || command).toUpperCase();
            if (effectiveCmd !== 'PERSISTENCE') {
                next();
                return;
            }

            const subcommand = (event.params[0] || '').toUpperCase();
            if (subcommand === 'STATUS') {
                // Take the last two params as (client-setting, effective) so
                // both shapes work: STATUS <client> <effective>, with or
                // without a leading nick. Anything else is ignored.
                const tail = event.params.slice(-2).map((p) => (
                    (p || '').toUpperCase()
                ));
                const validClients = ['ON', 'OFF', 'DEFAULT'];
                const validEffective = ['ON', 'OFF'];
                if (tail.length === 2 &&
                    validClients.includes(tail[0]) &&
                    validEffective.includes(tail[1])
                ) {
                    network.persistence_status = {
                        client: tail[0],
                        effective: tail[1],
                    };
                    // The server confirmed a value. If it is the desired one
                    // the loop guard can be released; otherwise try to send
                    // the desired SET (guarded against repeats).
                    const desired = preferenceToWire(currentPreference(network));
                    if (tail[0] === desired) {
                        lastSentSet = '';
                    } else {
                        maybeSendSet();
                    }
                    // The hold from the REGISTERED handler (if any) is over
                    // now the status is known. Joins run only when the server
                    // reports effectively OFF; effective ON means the server
                    // kept us joined, so our rejoins stay suppressed. The
                    // parked fields are cleared, so this runs exactly once.
                    const pendingJoins = network.pending_channel_joins;
                    if (pendingJoins) {
                        if (network.pending_channel_joins_timer) {
                            clearTimeout(network.pending_channel_joins_timer);
                        }
                        network.pending_channel_joins = null;
                        network.pending_channel_joins_timer = null;
                        if (network.persistence_status.effective !== 'ON') {
                            pendingJoins();
                        }
                    }
                }
            }

            next();
        });
    };
}
