/* Kiwi IRC web push service worker.
   Receives draft/webpush (or soju.im/webpush) notifications, whose payload
   is exactly one IRC message, and surfaces them as system notifications.
   Kept dependency-free on purpose: workers cannot use the app bundler aliases,
   so the tiny IRC-line parse below is intentionally standalone. */

// Minimal parse of one IRC line: [:prefix ]COMMAND [params...] [:trailing].
// Returns the sender nick (prefix without any !user@host) and the trailing text.
function parseIrcLine(line) {
    let rest = line || '';
    let prefix = '';
    if (rest.charAt(0) === ':') {
        const spaceIdx = rest.indexOf(' ');
        prefix = spaceIdx === -1 ? rest.slice(1) : rest.slice(1, spaceIdx);
        rest = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1);
    }
    const trailingIdx = rest.indexOf(' :');
    const text = trailingIdx === -1 ? '' : rest.slice(trailingIdx + 2);
    return {
        nick: prefix.split('!')[0],
        text: text,
    };
}

self.addEventListener('push', (event) => {
    let title = 'Kiwi IRC';
    let body = '';
    try {
        const text = event.data ? event.data.text() : '';
        const parsed = parseIrcLine(text);
        if (parsed.nick) {
            title = parsed.nick;
        }
        body = parsed.text || text;
    } catch (err) {
        body = '';
    }
    if (!body) {
        return;
    }
    event.waitUntil(self.registration.showNotification(title, {
        body: body,
        icon: 'icon-192.png',
        data: { url: '../' },
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '../';
    event.waitUntil(clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
    }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
            if (windowClients[i].focus) {
                return windowClients[i].focus();
            }
        }
        if (clients.openWindow) {
            return clients.openWindow(url);
        }
        return null;
    }));
});

self.addEventListener('pushsubscriptionchange', (event) => {
    // The browser rotated our subscription: re-subscribe, then tell any open
    // page so it can WEBPUSH REGISTER the new endpoint.
    event.waitUntil(Promise.resolve().then(() => {
        const oldSub = event.oldSubscription;
        const key = oldSub && oldSub.options ?
            oldSub.options.applicationServerKey :
            null;
        return self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
        });
    }).then(() => clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
    })).then((windowClients) => {
        windowClients.forEach((windowClient) => {
            windowClient.postMessage({ type: 'webpush-subscription-changed' });
        });
    }).catch(() => {
        // Swallowed: the next page load re-registers from the stored subscription.
    }));
});
