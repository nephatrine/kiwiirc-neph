import Irc from 'irc-framework';
import * as Misc from '@/helpers/Misc';
import * as TextFormatting from '@/helpers/TextFormatting';

function alertUnknownVisibility(network, target, key, visibility, visCache) {
    if (visibility && visibility !== '*') {
        const cacheKey = `${target}:${key}:${visibility}`;
        if (!visCache.has(cacheKey)) {
            const message = `Metadata for ${target} (${key}) has non-standard visibility: ${visibility}`;
            network.appState.addMessage(network.serverBuffer(), {
                time: Date.now(),
                nick: '*',
                message,
            });
            visCache.add(cacheKey);
        }
    }
}

export default function metadataMiddleware(network) {
    const visibilityCache = new Set();

    return function middlewareFn(client, rawEvents, parsedEvents) {
        const updateLimits = () => {
            const capValue = network.capValue('draft/metadata-2');
            if (!capValue) {
                return;
            }

            const parts = capValue.split(',');
            parts.forEach((part) => {
                const [key, val] = part.split('=');
                const numVal = parseInt(val, 10);
                if (Number.isNaN(numVal)) {
                    return;
                }

                if (key === 'max-subs') {
                    network.metadata_limits.maxSubs = numVal;
                } else if (key === 'max-keys') {
                    network.metadata_limits.maxKeys = numVal;
                } else if (key === 'max-value-bytes') {
                    network.metadata_limits.maxValueBytes = numVal;
                }
            });
        };

        client.on('cap ls', updateLimits);
        client.on('cap new', updateLimits);
        client.on('cap ack', updateLimits);

        client.on('connected', () => {
            visibilityCache.clear();
            if (network.hasCap('draft/metadata-2')) {
                updateLimits();

                // Subscribe to self metadata changes
                network.subMetadata('*', [
                    'avatar',
                    'pronouns',
                    'display-name',
                    'description',
                    'homepage',
                    'status',
                    'color',
                ]);
                // Initial fetch
                network.getMetadata('*', [
                    'avatar',
                    'pronouns',
                    'display-name',
                    'description',
                    'homepage',
                    'status',
                    'color',
                ]);
            }
        });

        client.on('join', (event) => {
            if (event.nick === client.user.nick && network.hasCap('draft/metadata-2')) {
                network.subMetadata(event.channel, ['description', 'display-name', 'avatar']);
                network.getMetadata(event.channel, ['description', 'display-name', 'avatar']);
            }
        });

        parsedEvents.use((command, event, clientArg, next) => {
            if (!event) {
                next();
                return;
            }

            const effectiveCmd = (event.command || command).toUpperCase();
            const isKv = effectiveCmd === '760' || effectiveCmd === '761'
                || effectiveCmd === 'RPL_KEYVALUE' || effectiveCmd === 'RPL_WHOISKEYVALUE';

            if (isKv) {
                // 760/761: <client> <target> <key> <visibility> :<value>
                const hasClientNick = event.params.length >= 5;
                const clientNick = hasClientNick ? event.params[0] : '';
                const target = hasClientNick ? event.params[1] : event.params[0];
                const key = hasClientNick ? event.params[2] : event.params[1];
                const visibility = hasClientNick ? event.params[3] : event.params[2];
                const value = hasClientNick ? event.params[4] : event.params[3];

                const normalizedTarget = target === '*' ? (clientNick || network.nick) : target;
                if (normalizedTarget) {
                    alertUnknownVisibility(
                        network,
                        normalizedTarget,
                        key,
                        visibility,
                        visibilityCache
                    );
                    updateMetadataState(network, normalizedTarget, key, value, event, true);
                }
            } else if (effectiveCmd === '770' || effectiveCmd === 'RPL_METADATASUBOK') {
                // 770: <client> <Key1> [<Key2> ...]
                const label = event.tags && event.tags.label;
                const target = network.metadata_label_targets.get(label);
                if (target) {
                    if (!network.active_metadata_subs[target]) {
                        network.active_metadata_subs[target] = new Set();
                    }
                    // All parameters after the client nickname are successful keys
                    event.params.slice(1).forEach((key) => {
                        network.active_metadata_subs[target].add(key);
                    });
                }
            } else if (effectiveCmd === '771' || effectiveCmd === 'RPL_METADATAUNSUBOK') {
                // 771: <client> <Key1> [<Key2> ...]
                const label = event.tags && event.tags.label;
                const target = network.metadata_label_targets.get(label);
                if (target && network.active_metadata_subs[target]) {
                    event.params.slice(1).forEach((key) => {
                        network.active_metadata_subs[target].delete(key);
                    });
                    if (network.active_metadata_subs[target].size === 0) {
                        delete network.active_metadata_subs[target];
                    }
                }
            } else if (effectiveCmd === '766' || effectiveCmd === 'RPL_KEYNOTSET') {
                // 766: <client> <target> <key> :description
                const hasClientNick = event.params.length >= 3;
                const clientNick = hasClientNick ? event.params[0] : '';
                const target = hasClientNick ? event.params[1] : event.params[0];
                const key = hasClientNick ? event.params[2] : event.params[1];

                const normalizedTarget = target === '*' ? (clientNick || network.nick) : target;
                if (normalizedTarget) {
                    updateMetadataState(network, normalizedTarget, key, '', event, true);
                }
            } else if (effectiveCmd === '774' || effectiveCmd === 'RPL_METADATASYNCLATER') {
                // 774: <client> <target> [<RetryAfter>]
                const hasClientNick = event.params.length >= 2;
                const target = hasClientNick ? event.params[1] : event.params[0];
                const retryVal = hasClientNick ? event.params[2] : event.params[1];
                const retryAfter = parseInt(retryVal, 10) || 10;

                const normalizedTarget = target === '*' ? network.nick : target;
                network.metadata_throttles.set(normalizedTarget, Date.now() + (retryAfter * 1000));

                setTimeout(() => {
                    if (network.state === 'connected') {
                        network.metadata_throttles.delete(normalizedTarget);
                        network.syncMetadata(target);
                    }
                }, retryAfter * 1000);
            } else if (effectiveCmd === 'METADATA') {
                // Live metadata notification: METADATA <target> <key> <visibility> :<value>
                let target = event.params[0];
                const key = event.params[1];
                const visibility = event.params[2];
                const value = event.params[3];

                if (target) {
                    if (target === '*') {
                        target = network.nick;
                    }

                    alertUnknownVisibility(network, target, key, visibility, visibilityCache);
                    // Echo of our own labeled change is authoritatively authorized
                    const isAuth = !!(event.tags && event.tags.label);
                    updateMetadataState(network, target, key, value, event, isAuth);
                }
            }

            next();
        });

        const dispatchLabeledCommand = (targetArg, subcommand, keys) => {
            const target = targetArg === '*' ? network.nick : targetArg;
            const hasLabels = network.hasCap('labeled-response');

            const m = new Irc.Message('METADATA', targetArg, subcommand, ...keys);
            if (hasLabels) {
                const label = Misc.generateLabel();
                network.metadata_label_targets.set(label, target);
                setTimeout(() => network.metadata_label_targets.delete(label), 60000);
                m.tags.label = label;
            }

            client.raw(m);
        };

        // Helper to set metadata
        network.setMetadata = (targetArg, keyArg, valueArg) => {
            if (!network.hasCap('draft/metadata-2')) {
                return;
            }

            // support both setMetadata(key, value) and setMetadata(target, key, value)
            let target = targetArg;
            let key = keyArg;
            let value = valueArg;
            if (typeof valueArg === 'undefined') {
                target = '*';
                key = targetArg;
                value = keyArg;
            }

            const normalizedTarget = target === '*' ? network.nick : target;
            const throttle = network.metadata_throttles.get(normalizedTarget);
            if (throttle && Date.now() < throttle) {
                return;
            }

            const encoder = new TextEncoder();
            const bytes = encoder.encode(value).length;
            if (bytes > network.metadata_limits.maxValueBytes) {
                const error = TextFormatting.t('metadata_too_long', {
                    current: bytes,
                    max: network.metadata_limits.maxValueBytes,
                });
                const buffer = network.serverBuffer();
                network.appState.addMessage(buffer, {
                    time: Date.now(),
                    nick: '*',
                    message: error,
                    type: 'error',
                });
                return;
            }

            dispatchLabeledCommand(target, 'SET', [key, value]);
        };

        // Helper to get metadata
        network.getMetadata = (targetArg, keys) => {
            if (!network.hasCap('draft/metadata-2')) {
                return;
            }

            const target = targetArg === '*' ? network.nick : targetArg;
            const throttle = network.metadata_throttles.get(target);
            if (throttle && Date.now() < throttle) {
                return;
            }

            let keyList = Array.isArray(keys) ? keys : [keys];
            if (keyList.length > network.metadata_limits.maxKeys) {
                keyList = keyList.slice(0, network.metadata_limits.maxKeys);
            }
            dispatchLabeledCommand(targetArg, 'GET', keyList);
        };

        // Helper to subscribe to metadata
        network.subMetadata = (targetArg, keys) => {
            if (!network.hasCap('draft/metadata-2')) {
                return;
            }

            const target = targetArg === '*' ? network.nick : targetArg;
            const throttle = network.metadata_throttles.get(target);
            if (throttle && Date.now() < throttle) {
                return;
            }

            let keyList = Array.isArray(keys) ? keys : [keys];

            // Filter out keys we are already subscribed to for this target
            const active = network.active_metadata_subs[target];
            if (active) {
                keyList = keyList.filter((k) => !active.has(k));
            }

            if (keyList.length === 0) {
                return;
            }

            if (keyList.length > network.metadata_limits.maxSubs) {
                keyList = keyList.slice(0, network.metadata_limits.maxSubs);
            }

            dispatchLabeledCommand(targetArg, 'SUB', keyList);
        };

        // Helper to unsubscribe from metadata
        network.unsubMetadata = (targetArg, keys) => {
            if (!network.hasCap('draft/metadata-2')) {
                return;
            }

            const target = targetArg === '*' ? network.nick : targetArg;
            const throttle = network.metadata_throttles.get(target);
            if (throttle && Date.now() < throttle) {
                return;
            }

            let keyList = Array.isArray(keys) ? keys : [keys];

            // Only unsub from keys that are actually active
            const active = network.active_metadata_subs[target];
            if (!active) {
                return;
            }
            keyList = keyList.filter((k) => active.has(k));

            if (keyList.length === 0) {
                return;
            }

            dispatchLabeledCommand(targetArg, 'UNSUB', keyList);
        };

        // Helper to sync metadata
        network.syncMetadata = (targetArg) => {
            if (!network.hasCap('draft/metadata-2')) {
                return;
            }

            const target = targetArg === '*' ? network.nick : targetArg;
            const throttle = network.metadata_throttles.get(target);
            if (throttle && Date.now() < throttle) {
                return;
            }

            dispatchLabeledCommand(targetArg, 'SYNC', []);
        };
    };
}

function updateMetadataState(network, target, key, value, event, isAuth) {
    const state = network.appState;
    const isChannel = network.isChannelName(target);

    if (target.toLowerCase() === network.nick.toLowerCase()) {
        const sanitizedValue = sanitizeMetadata(key, value);
        if (sanitizedValue === '') {
            state.$delete(network.metadata, key);
        } else {
            state.$set(network.metadata, key, sanitizedValue);
        }
    }

    if (isChannel) {
        const buffer = network.bufferByName(target);
        if (buffer) {
            buffer.lastMetadataFetch = Date.now();
            const sanitizedValue = sanitizeMetadata(key, value);
            if (sanitizedValue === '') {
                state.$delete(buffer.metadata, key);
            } else {
                state.$set(buffer.metadata, key, sanitizedValue);
            }
        }
    } else {
        const user = isAuth ?
            state.addUser(network.id, { nick: target }) :
            network.userByName(target);

        if (user) {
            user.lastMetadataFetch = Date.now();
            const sanitizedValue = sanitizeMetadata(key, value);
            if (sanitizedValue === '') {
                state.$delete(user.metadata, key);
            } else {
                state.$set(user.metadata, key, sanitizedValue);
            }
        }
    }
}

function sanitizeMetadata(key, value) {
    if (value === '') {
        return '';
    }

    // Strip most IRC control codes from all metadata values.
    // We allow \t (\x09), \n (\x0A), and \r (\x0D) per the draft/metadata-2 spec.
    const cleanValue = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g, '');

    if (key === 'avatar' || key === 'homepage') {
        return Misc.sanitizeUrl(cleanValue);
    }

    if (key === 'color') {
        // Must be a valid 7-character hex code starting with #
        const isSafeColor = /^#[0-9a-f]{6}$/i.test(cleanValue);
        return isSafeColor ? cleanValue.toLowerCase() : '';
    }

    if (key === 'display-name' || key === 'pronouns' || key === 'status') {
        // These should be relatively short and clean without whitespace control chars
        return cleanValue.replace(/[\n\r\t]/g, '').trim().substring(0, 100);
    }

    return cleanValue;
}
