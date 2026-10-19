import Irc from 'irc-framework';
import * as Misc from '@/helpers/Misc';
import * as TextFormatting from '@/helpers/TextFormatting';
import * as MetadataCache from '@/libs/MetadataCache';

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

const sojuBufferKeys = ['soju.im/pinned', 'soju.im/muted'];
const sojuUserKeys = ['soju.im/blocked'];
const sojuMetadataKeys = sojuBufferKeys.concat(sojuUserKeys);
const watchedSojuBuffers = new WeakSet();

// max-keys=0 means the server does not store arbitrary metadata at all.
// Soju's own keys are still valid in that mode, which is how it stores the
// user's pinned/muted channels and blocked users.
function metadataKeyAllowed(network, key) {
    return network.metadata_limits.maxKeys > 0 || sojuMetadataKeys.includes(key);
}

export default function metadataMiddleware(network) {
    const visibilityCache = new Set();

    const initialSyncKeys = [
        'avatar',
        'pronouns',
        'display-name',
        'description',
        'homepage',
        'status',
        'color',
    ];

    const initialSync = () => {
        // Subscriptions are a per-connection key list, not per target. Joining
        // a channel then delivers its metadata and its members' metadata for
        // these keys, so no per-channel SUB or SYNC is needed.
        let keys = initialSyncKeys;
        if (network.isSoju()) {
            keys = keys.concat(sojuMetadataKeys);
        }
        network.subMetadata('*', keys);
        // Initial fetch
        network.getMetadata('*', initialSyncKeys);
    };

    return function middlewareFn(client, rawEvents, parsedEvents) {
        // Self-profile restore: re-SEND remembered SETs once the initial
        // GET returns, blank-keys only. All per-attempt state resets on
        // every new connection attempt (see 'connecting' below).
        let profileRestoreDone = false;
        let profileRestoreTimer = null;
        const profileGetLabels = new Set();

        const isSelfTarget = (target) => !!target && !!network.nick &&
            target.toLowerCase() === network.nick.toLowerCase();

        // Adopt a server-provided self value into the remembered profile so
        // a value set elsewhere (or surviving server-side) is never clobbered
        // by a stale remembered one on the next reconnect.
        const adoptSelfMetadata = (target, key) => {
            if (!isSelfTarget(target)) {
                return;
            }
            const current = network.metadata[key];
            if (typeof current !== 'undefined' && current !== '') {
                network.appState.$set(network.saved_profile_metadata, key, current);
            }
        };

        // Re-send remembered self SETs for keys that are currently blank.
        // Runs once per connection attempt, after the initial GET resolves.
        const restoreSelfProfile = () => {
            if (profileRestoreDone || !network.metadataCap()) {
                return;
            }
            profileRestoreDone = true;
            if (profileRestoreTimer) {
                clearTimeout(profileRestoreTimer);
                profileRestoreTimer = null;
            }
            Object.keys(network.saved_profile_metadata).forEach((key) => {
                const remembered = network.saved_profile_metadata[key];
                const current = network.metadata[key];
                if (remembered && !current) {
                    network.setMetadata('*', key, remembered);
                }
            });
        };

        client.on('connecting', () => {
            // A different identity never inherits another one's profile.
            // Anonymous attempts (no account) share the blank owner.
            const owner = (network.connection && network.connection.account) || '';
            if (network.saved_profile_owner !== owner) {
                network.saved_profile_owner = owner;
                network.saved_profile_metadata = {};
            }
            profileRestoreDone = false;
            profileGetLabels.clear();
            if (profileRestoreTimer) {
                clearTimeout(profileRestoreTimer);
                profileRestoreTimer = null;
            }
        });

        const updateLimits = () => {
            const cap = network.metadataCap();
            if (!cap) {
                return;
            }
            const capValue = network.capValue(cap);
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
                } else if (key === 'max-key-bytes') {
                    network.metadata_limits.maxKeyBytes = numVal;
                } else if (key === 'max-value-bytes') {
                    network.metadata_limits.maxValueBytes = numVal;
                }
            });
        };

        client.on('cap ls', updateLimits);
        client.on('cap new', updateLimits);
        client.on('cap ack', updateLimits);

        client.on('connected', () => {
            if (network.isBouncerController()) {
                // The bouncer control connection has no metadata of its own
                return;
            }

            visibilityCache.clear();
            if (network.metadataCap()) {
                updateLimits();
                initialSync();
                // Backstop for servers without labeled-response (no labeled
                // GET ACK to key off). The labeled-ACK path runs first and
                // cancels this; blank-only guard keeps a premature run safe.
                if (profileRestoreTimer) {
                    clearTimeout(profileRestoreTimer);
                }
                profileRestoreTimer = setTimeout(() => restoreSelfProfile(), 3000);
                return;
            }

            // Request the preferred metadata cap explicitly. This cannot go
            // through the blind DESIRED_CAPS path: the spec forbids
            // requesting more than one metadata cap at a time.
            const advertised = Object.keys(network.cap_values || {}).map((c) => (
                c.toLowerCase()
            ));
            const preferred = ['draft/metadata-3', 'draft/metadata-2'].find((cap) => (
                advertised.includes(cap)
            ));
            if (preferred) {
                client.raw('CAP', 'REQ', preferred);
            }
        });

        client.on('join', (event) => {
            // Channel and member metadata arrive with the join burst for the
            // keys subscribed to in initialSync(). Soju's buffer keys still
            // need watching so the Favorite/Mute settings stay in sync.
            if (
                network.metadataCap() &&
                network.isSoju() &&
                event.nick === client.user.nick
            ) {
                watchSojuBufferSettings(network, network.bufferByName(event.channel));
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

            if (effectiveCmd === 'ACK') {
                // Labeled ACK to our initial self GET: the GET replies are in
                // and current values are known, so restore blank keys now.
                const ackLabel = event.tags && event.tags.label;
                if (ackLabel && profileGetLabels.has(ackLabel)) {
                    profileGetLabels.delete(ackLabel);
                    restoreSelfProfile();
                }
            }

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
                    adoptSelfMetadata(normalizedTarget, key);
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
                queueMetadataSync(network, target, retryVal);
            } else if (effectiveCmd === '775' || effectiveCmd === 'RPL_METADATARATELIMIT') {
                // 775: <client> <RetryAfter> <target> <command> [<params> ...]
                // The retry delay comes before the target here, unlike 774.
                const retryVal = event.params.length >= 3 ? event.params[1] : '';
                const target = event.params.length >= 3 ? event.params[2] : event.params[0];
                queueMetadataSync(network, target, retryVal);
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
                // Track our own initial-fetch GETs: their labeled ACK marks
                // the moment current values are known and blank keys can be
                // restored from the remembered profile.
                if (subcommand === 'GET' && (targetArg === '*' || isSelfTarget(target))) {
                    profileGetLabels.add(label);
                }
                setTimeout(() => network.metadata_label_targets.delete(label), 60000);
                m.tags.label = label;
            }

            client.raw(m);
        };

        // Helper to set metadata
        network.setMetadata = (targetArg, keyArg, valueArg) => {
            if (!network.metadataCap()) {
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

            if (!metadataKeyAllowed(network, key)) {
                return;
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

            const keyBytes = encoder.encode(key).length;
            if (keyBytes > (network.metadata_limits.maxKeyBytes || 64)) {
                const error = TextFormatting.t('metadata_key_too_long', {
                    max: network.metadata_limits.maxKeyBytes || 64,
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

            // Remember self SETs so they can be re-sent after reconnects;
            // servers may not persist metadata. Recorded here, after the
            // length/throttle validation above, so failed SETs are skipped.
            // An emptied field is remembered too, so it stays empty.
            if (target === '*' || isSelfTarget(target)) {
                network.appState.$set(network.saved_profile_metadata, key, value);
            }
        };

        // Helper to get metadata
        network.getMetadata = (targetArg, keys) => {
            if (!network.metadataCap()) {
                return;
            }

            const target = targetArg === '*' ? network.nick : targetArg;
            const throttle = network.metadata_throttles.get(target);
            if (throttle && Date.now() < throttle) {
                return;
            }

            let keyList = (Array.isArray(keys) ? keys : [keys]).filter((key) => (
                metadataKeyAllowed(network, key)
            ));
            const maxKeys = network.metadata_limits.maxKeys;
            if (maxKeys > 0 && keyList.length > maxKeys) {
                keyList = keyList.slice(0, maxKeys);
            }
            if (keyList.length === 0) {
                return;
            }
            dispatchLabeledCommand(targetArg, 'GET', keyList);
        };

        // Helper to subscribe to metadata
        network.subMetadata = (targetArg, keys) => {
            if (!network.metadataCap()) {
                return;
            }

            const target = targetArg === '*' ? network.nick : targetArg;
            const throttle = network.metadata_throttles.get(target);
            if (throttle && Date.now() < throttle) {
                return;
            }

            let keyList = (Array.isArray(keys) ? keys : [keys]).filter((key) => (
                metadataKeyAllowed(network, key)
            ));

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
            if (!network.metadataCap()) {
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
            if (!network.metadataCap()) {
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

function queueMetadataSync(network, target, retryVal) {
    // 774 makes RetryAfter mandatory, 775 always carries it, but older
    // draft/metadata-2 servers may omit it. Fall back to 10 seconds.
    const retryAfter = parseInt(retryVal, 10) || 10;

    const normalizedTarget = target === '*' ? network.nick : target;
    network.metadata_throttles.set(normalizedTarget, Date.now() + (retryAfter * 1000));

    setTimeout(() => {
        if (network.state === 'connected') {
            network.metadata_throttles.delete(normalizedTarget);
            network.syncMetadata(target);
        }
    }, retryAfter * 1000);
}

// Soju's own buffer metadata maps onto our own buffer settings. The watchers
// installed by watchSojuBufferSettings() send the reverse direction, and skip
// keys whose server value already matches so incoming metadata never echoes.
function applySojuBufferMetadata(buffer, key, value) {
    if (key === 'soju.im/pinned') {
        buffer.setting('favorite', value === '1');
    } else if (key === 'soju.im/muted') {
        if (value === '1') {
            buffer.setting('alert_on', 'never');
            buffer.setting('mute_sound', true);
        } else if (buffer.setting('alert_on') === 'never' && buffer.setting('mute_sound')) {
            buffer.setting('alert_on', 'highlight');
            buffer.setting('mute_sound', false);
        }
    }
}

function watchSojuBufferSettings(network, buffer) {
    if (!buffer || watchedSojuBuffers.has(buffer)) {
        return;
    }
    watchedSojuBuffers.add(buffer);

    let lastPinned = null;
    let lastMuted = null;
    let pinnedQueued = false;
    let mutedQueued = false;

    // Coalesce changes made in the same tick (ticking both notification
    // settings counts as one muted change) and never echo a value the server
    // just gave us.
    const flushPinned = () => {
        pinnedQueued = false;
        if (!network.isSoju() || !network.metadataCap()) {
            return;
        }

        const pinned = buffer.setting('favorite') ? '1' : '0';
        if (buffer.metadata['soju.im/pinned'] === pinned || lastPinned === pinned) {
            return;
        }
        lastPinned = pinned;
        network.setMetadata(buffer.name, 'soju.im/pinned', pinned);
    };

    const flushMuted = () => {
        mutedQueued = false;
        if (!network.isSoju() || !network.metadataCap()) {
            return;
        }

        const muted = buffer.setting('alert_on') === 'never' && buffer.setting('mute_sound') ?
            '1' :
            '0';
        if (buffer.metadata['soju.im/muted'] === muted || lastMuted === muted) {
            return;
        }
        lastMuted = muted;
        network.setMetadata(buffer.name, 'soju.im/muted', muted);
    };

    const queuePinned = () => {
        if (pinnedQueued) {
            return;
        }
        pinnedQueued = true;
        Promise.resolve().then(flushPinned);
    };

    const queueMuted = () => {
        if (mutedQueued) {
            return;
        }
        mutedQueued = true;
        Promise.resolve().then(flushMuted);
    };

    network.appState.$watch(() => buffer.setting('favorite'), queuePinned);
    network.appState.$watch(() => buffer.setting('alert_on'), queueMuted);
    network.appState.$watch(() => buffer.setting('mute_sound'), queueMuted);
}

function updateMetadataState(network, target, key, value, event, isAuth) {
    const state = network.appState;
    const isChannel = network.isChannelName(target);
    const sanitizedValue = sanitizeMetadata(key, value);

    if (isChannel && key === 'display-name') {
        MetadataCache.rememberChannel(network, target, sanitizedValue);
    }

    if (target.toLowerCase() === network.nick.toLowerCase()) {
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
            if (sanitizedValue === '') {
                state.$delete(buffer.metadata, key);
            } else {
                state.$set(buffer.metadata, key, sanitizedValue);
            }
            if (network.isSoju()) {
                applySojuBufferMetadata(buffer, key, sanitizedValue);
            }
        }
    } else {
        const user = isAuth ?
            state.addUser(network.id, { nick: target }) :
            network.userByName(target);

        if (user) {
            user.lastMetadataFetch = Date.now();
            if (sanitizedValue === '') {
                state.$delete(user.metadata, key);
            } else {
                state.$set(user.metadata, key, sanitizedValue);
            }
            if (network.isSoju() && key === 'soju.im/blocked') {
                user.ignore = sanitizedValue === '1';
            }
            if (key === 'display-name' || key === 'avatar') {
                MetadataCache.rememberUser(network, user);
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
