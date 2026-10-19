import * as TextFormatting from '@/helpers/TextFormatting';
import * as WebpushUtils from './WebpushUtils';

// Servers may expire subscriptions at any time, so renew in-use
// subscriptions regularly (the spec suggests daily).
const RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000;

export default function webpushMiddleware(network, deps = {}) {
    // Injectable for tests; defaults to the real browser PushManager flow.
    const subscriptionProvider = deps.subscriptionProvider ||
        WebpushUtils.defaultBrowserSubscriptionProvider;
    let renewTimer = null;
    let swMessageListening = false;

    return function middlewareFn(client, rawEvents, parsedEvents) {
        const settingOn = () => {
            try {
                return !!network.appState.setting('webpushEnabled');
            } catch (err) {
                return false;
            }
        };

        const notificationsGranted = () => (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            window.Notification.permission === 'granted'
        );

        // A push subscription registered with the bouncer is bouncer-wide:
        // only the control connection may register or remove it.
        const bouncerManaged = () => (
            typeof network.bouncerHasCap === 'function' &&
            !(typeof network.isBouncerController === 'function' &&
                network.isBouncerController()) &&
            network.bouncerHasCap(network.webpushCap())
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

        const ensureRegistered = async() => {
            if (
                bouncerManaged() ||
                !network.webpushAvailable() ||
                !settingOn() ||
                !notificationsGranted()
            ) {
                return;
            }
            let sub = null;
            try {
                sub = await subscriptionProvider(network.supports('VAPID'));
            } catch (err) {
                // No retry loop; the next connect or toggle tries again.
                return;
            }
            if (!sub || !sub.endpoint || !sub.keys) {
                return;
            }
            network.webpush_endpoint = sub.endpoint;
            client.raw('WEBPUSH', 'REGISTER', sub.endpoint, sub.keys);
        };

        const unregister = () => {
            clearRenewTimer();
            if (network.webpush_registered && network.webpush_endpoint) {
                client.raw('WEBPUSH', 'UNREGISTER', network.webpush_endpoint);
            }
            network.webpush_registered = false;
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
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'webpush-subscription-changed') {
                    network.webpush_registered = false;
                    ensureRegistered();
                }
            });
        };

        const permissionRequestable = () => (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            window.Notification.permission === 'default'
        );

        const permissionDeniedError = () => {
            const buffer = network.serverBuffer();
            network.appState.addMessage(buffer, {
                time: Date.now(),
                nick: '*',
                message: TextFormatting.t('webpush_permission_denied'),
                type: 'error',
            });
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

        // Exposed for the settings checkbox so a toggle applies immediately
        // instead of waiting for the next connect. A toggle is a user
        // gesture, which is the right moment to prompt for permission;
        // background paths (connect, renewal) stay silent.
        network.setWebpushEnabled = () => {
            if (!settingOn()) {
                unregister();
                return;
            }
            listenForSubscriptionChange();
            if (notificationsGranted()) {
                ensureRegistered();
            } else if (permissionRequestable()) {
                requestPermissionThenRegister();
            } else {
                permissionDeniedError();
            }
        };

        client.on('connecting', () => {
            clearRenewTimer();
            network.webpush_registered = false;
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
            if (verb === 'PERSISTENCE' && bouncerManaged()) {
                // The bouncer owns the endpoint: a bound connection must not
                // unregister it or change the shared setting.
                next();
                return;
            }
            if (verb === 'WEBPUSH') {
                const subcommand = (event.params[0] || '').toUpperCase();
                if (subcommand === 'REGISTER') {
                    network.webpush_registered = true;
                    scheduleRenewal();
                } else if (subcommand === 'UNREGISTER') {
                    network.webpush_registered = false;
                    clearRenewTimer();
                }
            } else if (verb === 'PERSISTENCE' &&
                (event.params[0] || '').toUpperCase() === 'STATUS'
            ) {
                // The server tells us this session is not persistent, so a
                // webpush opt-in is meaningless: drop any registration and
                // switch the setting off so it cannot silently re-arm.
                // STATUS only arrives when the persistence cap is up.
                const statusTail = event.params.slice(-2).map((p) => (
                    (p || '').toUpperCase()
                ));
                if (statusTail.length === 2 &&
                    ['ON', 'OFF', 'DEFAULT'].includes(statusTail[0]) &&
                    ['ON', 'OFF'].includes(statusTail[1]) &&
                    statusTail[1] !== 'ON'
                ) {
                    if (network.webpush_registered && network.webpush_endpoint) {
                        client.raw('WEBPUSH', 'UNREGISTER', network.webpush_endpoint);
                    }
                    network.webpush_registered = false;
                    network.webpush_endpoint = '';
                    clearRenewTimer();
                }
            } else if (verb === 'FAIL' && (event.params[0] || '').toUpperCase() === 'WEBPUSH') {
                // The failure itself surfaces via the normal FAIL path below;
                // just stop claiming to be registered. No retry loop.
                network.webpush_registered = false;
            }
            next();
        });
    };
}
