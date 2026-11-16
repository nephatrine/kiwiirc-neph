/* Kiwi IRC web push service worker.
   Receives draft/webpush (or soju.im/webpush) notifications, whose payload
   is exactly one IRC message, and surfaces them as system notifications.
   One registration/scope exists per network so different VAPID keys can
   coexist. The tiny parser lives in sw-utils.js so it stays testable. */

// Bump this version when sw-utils.js changes so browsers install a new worker.
importScripts('sw-utils.js?v=4');

const utils = self.KiwiSwUtils;
const stateKey = utils.stateKeyFromScope(self.registration.scope);
const networkId = utils.networkIdFromScope(self.registration.scope);
const appRoot = utils.appRootFromScope(self.registration.scope);
const iconUrl = new URL('static/icon-192.png', appRoot).href;

let ipcChannel = null;
try {
    if (typeof BroadcastChannel !== 'undefined') {
        ipcChannel = new BroadcastChannel('kiwi-ipc');
    }
} catch (err) {
    ipcChannel = null;
}

function notifyApp(message) {
    if (ipcChannel) {
        try {
            ipcChannel.postMessage(message);
        } catch (err) {
            // The clients fallback below still runs.
        }
    }

    return self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
    }).then((clients) => {
        clients.forEach((client) => {
            if (client.postMessage) {
                client.postMessage(message);
            }
        });
    }).catch(() => {});
}

// Do Not Disturb lives in the page, so ask open clients before showing.
function clientNotificationsEnabled(client) {
    return new Promise((resolve) => {
        if (
            !client ||
            typeof client.postMessage !== 'function' ||
            typeof MessageChannel === 'undefined'
        ) {
            resolve(true);
            return;
        }

        const channel = new MessageChannel();
        let settled = false;
        let timer = null;
        const finish = (enabled) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timer) {
                clearTimeout(timer);
            }
            resolve(enabled);
        };

        timer = setTimeout(() => finish(true), 1000);
        channel.port1.onmessage = (event) => {
            const data = event && event.data;
            finish(!data || data.notificationsEnabled !== false);
        };

        try {
            client.postMessage({
                type: 'kiwi-notifications-state-request',
            }, [channel.port2]);
        } catch (err) {
            finish(true);
        }
    });
}

function anyClientNotificationsDisabled(clients) {
    return Promise.all((clients || []).map(clientNotificationsEnabled))
        .then((states) => utils.anyNotificationsDisabled(states));
}

function showNotification(note) {
    const tag = utils.notificationTag(stateKey, networkId, note.data.msgid);
    return self.registration.showNotification(note.title, {
        body: note.body,
        icon: iconUrl,
        tag: tag || undefined,
        data: Object.assign({}, note.data, {
            stateKey: stateKey,
            networkId: networkId,
            url: appRoot,
        }),
    }).catch(() => {});
}

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('push', (event) => {
    let note = null;
    try {
        const text = event.data ? event.data.text() : '';
        note = utils.buildNotification(text);
    } catch (err) {
        note = null;
    }

    if (!note) {
        event.waitUntil(Promise.resolve());
        return;
    }

    event.waitUntil((async() => {
        const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
        });

        if (utils.shouldSuppressPush(clients)) {
            return;
        }

        if (await anyClientNotificationsDisabled(clients)) {
            return;
        }

        await showNotification(note);
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data || {};

    event.waitUntil(self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
    }).then((clients) => {
        const notify = notifyApp({
            type: 'webpush-notification-click',
            data: data,
        });

        if (!clients.length) {
            if (self.clients.openWindow) {
                return Promise.all([notify, self.clients.openWindow(data.url || appRoot)]);
            }
            return notify;
        }

        const focused = clients.find((client) => client.focus);
        if (focused) {
            return Promise.all([notify, focused.focus()]);
        }
        return notify;
    }).catch(() => {}));
});

self.addEventListener('pushsubscriptionchange', (event) => {
    // The browser rotated our subscription: re-subscribe when the old key is
    // known, then tell the app so it can WEBPUSH REGISTER the new endpoint.
    event.waitUntil(Promise.resolve().then(() => {
        const oldSub = event.oldSubscription;
        const key = oldSub && oldSub.options ?
            oldSub.options.applicationServerKey :
            null;
        if (!key) {
            return null;
        }
        return self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
        }).catch(() => null);
    }).then(() => notifyApp({
        type: 'webpush-subscription-changed',
        stateKey: stateKey,
        networkId: networkId,
    })));
});
