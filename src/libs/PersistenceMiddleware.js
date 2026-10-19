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

// Maps a wire value reported by the server back to a stored preference.
function wireToPreference(wire) {
    if (wire === 'DEFAULT') {
        return 'default';
    }
    if (wire === 'ON') {
        return 'on';
    }
    if (wire === 'OFF') {
        return 'off';
    }
    return '';
}

export default function persistenceMiddleware(network) {
    // Wire value of the PERSISTENCE SET sent in response to the user's most
    // recent choice. The first STATUS after it is not adopted: it may have
    // been generated before the server saw our SET.
    let pendingSet = '';

    return function middlewareFn(client, rawEvents, parsedEvents) {
        // Bouncer-provided persistence is set from the control connection
        // only. The setting is bouncer-wide, so a bound connection must not
        // act on its own STATUS or send SET on its behalf.
        const ownedHere = () => (
            typeof network.bouncerHasCap !== 'function' ||
            !network.bouncerHasCap('draft/persistence') ||
            network.isBouncerController()
        );

        const sendSet = () => {
            if (!ownedHere()) {
                return;
            }
            const desired = preferenceToWire(currentPreference(network));
            if (!desired) {
                return;
            }
            pendingSet = desired;
            client.raw('PERSISTENCE', 'SET', desired);
        };

        client.on('connecting', () => {
            // Assume non-persistent on every connection until the server
            // says otherwise via PERSISTENCE STATUS.
            network.persistence_status = { client: '', effective: 'OFF' };
            pendingSet = '';
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
            sendSet();
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
                    if (!ownedHere()) {
                        next();
                        return;
                    }
                    network.persistence_status = {
                        client: tail[0],
                        effective: tail[1],
                    };
                    // The server's reported value is the truth. Adopt it
                    // instead of correcting it, so a change made from another
                    // client is not overwritten. The first STATUS after our
                    // own SET may predate it, so it is ignored.
                    const reported = wireToPreference(tail[0]);
                    if (pendingSet) {
                        pendingSet = '';
                    } else if (reported && reported !== 'keep') {
                        const current = currentPreference(network);
                        if (current !== 'keep' && current !== reported) {
                            network.appState.setting('persistencePreference', reported);
                        }
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
