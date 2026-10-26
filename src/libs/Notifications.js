'kiwi public';

import { throttle } from '@/helpers/Async';
import IPC from '@/libs/IPC';

let isEnabled = (global.Notification && Notification.permission === 'granted');
let hasRegistered = false;
let webpushClicksRegistered = false;

export function requestPermission(state) {
    // Do we support notifications?
    if (!('Notification' in window)) {
        isEnabled = false;
        return;
    }

    // Permissions already been granted?
    if (Notification.permission === 'granted') {
        state.$emit('notification.enabled');
        isEnabled = true;
        return;
    }

    if (Notification.permission !== 'denied') {
        Notification.requestPermission((permission) => {
            if (permission === 'granted') {
                state.$emit('notification.enabled');
                isEnabled = true;
            } else {
                isEnabled = false;
            }
        });
    }
}

export function show(title, body, opts) {
    if (!isEnabled) {
        return false;
    }

    let notify = new Notification(title, {
        body: body,
        icon: opts.icon,
        tag: opts.tag,
    });

    if (opts.ttl) {
        setTimeout(notify.close.bind(notify), opts.ttl);
    }

    return notify;
}

const throttledShow = throttle(show, 2000);

export function listenForNewMessages(state) {
    if (hasRegistered) {
        return;
    }
    hasRegistered = true;

    state.$on('notification.show', (message, _opts) => {
        let opts = Object.assign({
            title: 'Kiwi IRC',
            message: message,
            icon: '',
            tag: '',
            onclick: null,
            ttl: 10000,
            force: false,
        }, _opts);

        if (!isEnabled || (state.ui.app_has_focus && !opts.force)) {
            return;
        }

        if (!opts.message) {
            return;
        }

        let notification = throttledShow(opts.title, opts.message, {
            ttl: opts.ttl,
            tag: opts.tag,
        });

        if (notification && typeof opts.onclick === 'function') {
            notification.onclick = opts.onclick;
        }
    });
}

export function listenForWebpushClicks(state) {
    if (webpushClicksRegistered) {
        return;
    }
    webpushClicksRegistered = true;

    const handle = (data) => {
        if (!data || data.type !== 'webpush-notification-click') {
            return;
        }
        if (state.handleWebpushNotificationClick) {
            state.handleWebpushNotificationClick(data.data || {});
        }
    };

    IPC.on('message', (msg) => {
        handle(msg && msg.data);
    });

    if (
        typeof navigator !== 'undefined' &&
        navigator.serviceWorker &&
        navigator.serviceWorker.addEventListener
    ) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            handle(event && event.data);
        });
    }
}
