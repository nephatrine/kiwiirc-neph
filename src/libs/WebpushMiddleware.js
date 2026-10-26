import * as TextFormatting from '@/helpers/TextFormatting';
import IPC from './IPC';
import * as WebpushUtils from './WebpushUtils';

// Servers may expire subscriptions at any time, so renew in-use
// subscriptions regularly (the spec suggests daily).
const RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000;

export default function webpushMiddleware(network, deps = {}) {
    // Injectable for tests; defaults to the real browser PushManager flow.
    const subscriptionProvider = deps.subscriptionProvider ||
        WebpushUtils.defaultBrowserSubscriptionProvider;
    const unsubscribeProvider = deps.unsubscribeProvider ||
        WebpushUtils.unsubscribeBrowserSubscription;
    const ipc = deps.ipc || IPC;
    let renewTimer = null;
    let swMessageListening = false;
    let onSwMessage = null;

    return function middlewareFn(client, rawEvents, parsedEvents) {
        const stateKey = () => {
            const startupOptions = network.appState.settings.startupOptions || {};
            return startupOptions.state_key || 'kiwi-state';
        };
        const settingOn = () => !!network.setting('webpushEnabled');

        const notificationsGranted = () => (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            window.Notification.permission === 'granted'
        );

        const permissionRequestable = () => (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            window.Notification.permission === 'default'
        );

        const clearRenewTimer = () => {
            if (renewTimer) {
                clearTimeout(renewTimer);
                renewTimer = null;
            }
        };

        const scheduleRenewal = () => {
            clearRenewTimer();
            renewTimer = setTimeout(() => {
                renewTimer = null;
                if (network.webpush_registered) {
                    ensureRegistered();
                }
            }, RENEW_INTERVAL_MS);
        };

        const broadcast = (type, payload = {}) => {
            try {
                ipc.send(Object.assign({
                    type,
                    stateKey: stateKey(),
                    networkId: network.id,
                }, payload));
            } catch {
                // Cross-tab sync is best-effort.
            }
        };

        const unregister = ({
            unsubscribe = false,
            broadcast: doBroadcast = true,
            reason = '',
        } = {}) => {
            clearRenewTimer();

            const endpoints = [network.webpush_endpoint, network.webpush_pending_endpoint]
                .filter(Boolean)
                .filter((endpoint, index, list) => list.indexOf(endpoint) === index);
            if (client.connected !== false) {
                try {
                    endpoints.forEach((endpoint) => {
                        client.raw('WEBPUSH', 'UNREGISTER', endpoint);
                    });
                } catch {
                    // The connection went away; the server will prune it.
                }
            }

            network.webpush_registered = false;
            network.webpush_endpoint = '';
            network.webpush_pending_endpoint = '';

            if (doBroadcast) {
                broadcast('webpush-unregistered', { reason });
            }

            if (unsubscribe) {
                Promise.resolve()
                    .then(() => unsubscribeProvider({
                        stateKey: stateKey(),
                        networkId: network.id,
                    }))
                    .catch((err) => {
                        if (network.webpush_error) {
                            return;
                        }
                        network.webpush_error = (err && err.message) ||
                            TextFormatting.t('webpush_reset_failed');
                        broadcast('webpush-failed', { reason: network.webpush_error });
                    });
            }
        };

        const webpushFailed = (reason) => {
            network.setting('webpushEnabled', false);
            unregister({ unsubscribe: true, broadcast: false, reason: 'failed' });
            network.webpush_error = reason ||
                TextFormatting.t('webpush_subscription_failed');
            broadcast('webpush-failed', { reason: network.webpush_error });
        };

        const reportWebpushError = (reason) => {
            const buffer = network.serverBuffer();
            if (buffer) {
                network.appState.addMessage(buffer, {
                    time: Date.now(),
                    nick: '*',
                    message: reason,
                    type: 'error',
                });
            }
            webpushFailed(reason);
        };

        const permissionDeniedError = () => {
            reportWebpushError(TextFormatting.t('webpush_permission_denied'));
        };

        let ensurePromise = null;

        const doEnsureRegistered = async() => {
            if (
                client.connected === false ||
                !network.webpushAvailable() ||
                !settingOn()
            ) {
                return;
            }

            if (!notificationsGranted()) {
                // A default permission can only be requested from a user
                // gesture. A denied permission is a real failure, so do not
                // leave the checkbox looking enabled.
                if (!permissionRequestable()) {
                    permissionDeniedError();
                }
                return;
            }

            let sub = null;
            try {
                sub = await subscriptionProvider({
                    stateKey: stateKey(),
                    networkId: network.id,
                    vapidPublicKey: network.webpushVapidKey(),
                });
            } catch (err) {
                const serviceWorkerFailure = !!(
                    err && (
                        err.code === 'service-worker-missing' ||
                        err.code === 'service-worker-timeout' ||
                        err.code === 'service-worker-redundant' ||
                        /no active Service Worker/i.test(err.message || '')
                    )
                );
                reportWebpushError(serviceWorkerFailure ?
                    TextFormatting.t('webpush_service_worker_failed') :
                    (err && err.message) ||
                        TextFormatting.t('webpush_subscription_failed'));
                return;
            }

            if (!sub || !sub.endpoint || !sub.keys) {
                reportWebpushError(TextFormatting.t('webpush_subscription_failed'));
                return;
            }

            if (
                client.connected === false ||
                !settingOn() ||
                !network.webpushAvailable()
            ) {
                return;
            }

            try {
                if (
                    network.webpush_endpoint &&
                    network.webpush_endpoint !== sub.endpoint
                ) {
                    client.raw('WEBPUSH', 'UNREGISTER', network.webpush_endpoint);
                }

                network.webpush_pending_endpoint = sub.endpoint;
                client.raw('WEBPUSH', 'REGISTER', sub.endpoint, sub.keys);
            } catch {
                // The connection went away; the next connect will retry.
            }
        };

        const ensureRegistered = () => {
            if (ensurePromise) {
                return ensurePromise;
            }
            ensurePromise = doEnsureRegistered().finally(() => {
                ensurePromise = null;
            });
            return ensurePromise;
        };

        const requestPermissionThenRegister = () => {
            // Support both the promise form and the older callback form.
            // Each form fires exactly once: the promise form ignores
            // the extra argument, the callback form returns undefined.
            const onPermission = (permission) => {
                if (permission === 'granted') {
                    ensureRegistered();
                } else {
                    permissionDeniedError();
                }
            };
            let result = null;
            try {
                result = window.Notification.requestPermission(onPermission);
            } catch (err) {
                permissionDeniedError();
                return;
            }
            if (result && typeof result.then === 'function') {
                result.then(onPermission, () => {
                    permissionDeniedError();
                });
            }
        };

        const handleSubscriptionChange = () => {
            clearRenewTimer();
            network.webpush_registered = false;
            network.webpush_endpoint = '';
            network.webpush_pending_endpoint = '';
            network.webpush_error = '';
            ensureRegistered();
        };

        const listenForSubscriptionChange = () => {
            if (
                swMessageListening ||
                typeof navigator === 'undefined' ||
                !navigator.serviceWorker ||
                !navigator.serviceWorker.addEventListener
            ) {
                return;
            }
            swMessageListening = true;
            onSwMessage = (event) => {
                const data = event && event.data;
                if (!data || data.type !== 'webpush-subscription-changed') {
                    return;
                }
                if (data.stateKey && String(data.stateKey) !== String(stateKey())) {
                    return;
                }
                if (data.networkId && String(data.networkId) !== String(network.id)) {
                    return;
                }
                handleSubscriptionChange();
            };
            navigator.serviceWorker.addEventListener('message', onSwMessage);
        };

        // Exposed for the settings checkbox so a toggle applies immediately
        // instead of waiting for the next connect. A toggle is a user
        // gesture, which is the right moment to prompt for permission;
        // background paths (connect, renewal) stay silent.
        network.setWebpushEnabled = () => {
            if (!settingOn()) {
                network.webpush_error = '';
                broadcast('webpush-setting', { enabled: false });
                unregister({ unsubscribe: true, broadcast: true, reason: 'disabled' });
                return;
            }

            if (!network.webpushAvailable()) {
                network.webpush_error = '';
                broadcast('webpush-setting', { enabled: true });
                unregister({ unsubscribe: true, broadcast: true, reason: 'unavailable' });
                return;
            }

            network.webpush_error = '';
            broadcast('webpush-setting', { enabled: true });
            listenForSubscriptionChange();
            if (notificationsGranted()) {
                ensureRegistered();
            } else if (permissionRequestable()) {
                requestPermissionThenRegister();
            } else {
                permissionDeniedError();
            }
        };

        network.resetWebpush = () => {
            network.setting('webpushEnabled', false);
            network.webpush_error = '';
            broadcast('webpush-setting', { enabled: false });
            unregister({ unsubscribe: true, broadcast: true, reason: 'reset' });
        };

        network.clearWebpushRenewal = clearRenewTimer;

        const handleIpc = (msg) => {
            const data = msg && msg.data;
            if (!data || String(data.stateKey) !== String(stateKey())) {
                return;
            }
            if (String(data.networkId) !== String(network.id)) {
                return;
            }

            switch (data.type) {
            case 'webpush-setting':
                if (typeof data.enabled === 'boolean') {
                    network.setting('webpushEnabled', data.enabled);
                    network.webpush_error = '';
                    if (!data.enabled) {
                        unregister({
                            unsubscribe: false,
                            broadcast: false,
                            reason: 'disabled',
                        });
                    }
                }
                break;
            case 'webpush-registered':
                if (!settingOn()) {
                    break;
                }
                network.webpush_registered = true;
                network.webpush_endpoint = data.endpoint || network.webpush_endpoint;
                network.webpush_pending_endpoint = '';
                network.webpush_error = '';
                if (client.connected !== false) {
                    scheduleRenewal();
                }
                break;
            case 'webpush-unregistered':
                unregister({
                    unsubscribe: false,
                    broadcast: false,
                    reason: data.reason || 'sync',
                });
                network.webpush_error = '';
                break;
            case 'webpush-failed':
                network.setting('webpushEnabled', false);
                unregister({
                    unsubscribe: false,
                    broadcast: false,
                    reason: 'failed',
                });
                network.webpush_error = data.reason ||
                    TextFormatting.t('webpush_subscription_failed');
                break;
            case 'webpush-subscription-changed':
                handleSubscriptionChange();
                break;
            default:
                break;
            }
        };

        ipc.on('message', handleIpc);

        network.cleanupWebpush = () => {
            if (ipc.off) {
                ipc.off('message', handleIpc);
            }
            if (
                onSwMessage &&
                typeof navigator !== 'undefined' &&
                navigator.serviceWorker &&
                navigator.serviceWorker.removeEventListener
            ) {
                navigator.serviceWorker.removeEventListener('message', onSwMessage);
            }
            clearRenewTimer();
        };

        client.on('connecting', () => {
            clearRenewTimer();
            network.webpush_registered = false;
            network.webpush_endpoint = '';
            network.webpush_pending_endpoint = '';
            network.webpush_error = '';
        });

        client.on('connected', () => {
            listenForSubscriptionChange();
            ensureRegistered();
        });

        parsedEvents.use((command, event, clientArg, next) => {
            if (!event) {
                next();
                return;
            }

            const verb = (event.command || command || '').toUpperCase();
            if (verb === 'WEBPUSH') {
                const subcommand = (event.params[0] || '').toUpperCase();
                if (subcommand === 'REGISTER') {
                    const endpoint = event.params[1] ||
                        network.webpush_pending_endpoint || '';
                    network.webpush_pending_endpoint = '';

                    if (!endpoint) {
                        next();
                        return;
                    }

                    if (!settingOn() || !network.webpushAvailable()) {
                        if (endpoint && clientArg.connected !== false) {
                            clientArg.raw('WEBPUSH', 'UNREGISTER', endpoint);
                        }
                        network.webpush_registered = false;
                        network.webpush_endpoint = '';
                    } else {
                        network.webpush_registered = true;
                        network.webpush_endpoint = endpoint;
                        network.webpush_error = '';
                        scheduleRenewal();
                        broadcast('webpush-registered', { endpoint });
                    }
                } else if (subcommand === 'UNREGISTER') {
                    network.webpush_registered = false;
                    network.webpush_endpoint = '';
                    network.webpush_pending_endpoint = '';
                    clearRenewTimer();
                }
            } else if (verb === 'PERSISTENCE' &&
                (event.params[0] || '').toUpperCase() === 'STATUS'
            ) {
                // The server tells us this session is not persistent, so drop
                // any registration. Keep the per-network opt-in so it can
                // re-arm if persistence returns. STATUS only arrives when the
                // persistence cap is up.
                const statusTail = event.params.slice(-2).map((p) => (
                    (p || '').toUpperCase()
                ));
                if (statusTail.length === 2 &&
                    ['ON', 'OFF', 'DEFAULT'].includes(statusTail[0]) &&
                    ['ON', 'OFF'].includes(statusTail[1])
                ) {
                    if (statusTail[1] === 'ON') {
                        if (settingOn() && network.webpushAvailable()) {
                            ensureRegistered();
                        }
                    } else if (
                        network.webpush_registered ||
                        network.webpush_endpoint ||
                        network.webpush_pending_endpoint
                    ) {
                        network.webpush_error = '';
                        unregister({
                            unsubscribe: true,
                            broadcast: true,
                            reason: 'persistence',
                        });
                    }
                }
            } else if (verb === 'FAIL' &&
                (event.params[0] || '').toUpperCase() === 'WEBPUSH'
            ) {
                // The normal FAIL path still surfaces the server reply. Also
                // uncheck the opt-in so the UI never claims success.
                const code = event.params[1] || '';
                const description = event.params.length > 4 ?
                    event.params[event.params.length - 1] :
                    '';
                webpushFailed(description || code ||
                    TextFormatting.t('webpush_subscription_failed'));
            }

            next();
        });
    };
}
