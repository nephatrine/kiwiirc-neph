'kiwi public';

import { throttle } from '@/helpers/Async';
import { isDesktop } from '@/libs/desktop/Http';
import * as DesktopNotifications from '@/libs/desktop/Notifications';
import IPC from '@/libs/IPC';

function browserNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return '';
    }
    return window.Notification.permission;
}

let isEnabled = DesktopNotifications.isAvailable() ||
    browserNotificationPermission() === 'granted';
let hasRegistered = false;
let webpushClicksRegistered = false;
let nativeListenersRegistered = false;
let nextNotificationId = 0;
const nativeCallbacks = new Map();

function ensureNativeListeners() {
    if (nativeListenersRegistered) {
        return;
    }
    nativeListenersRegistered = true;

    DesktopNotifications.onClick((id) => {
        const callback = nativeCallbacks.get(id);
        nativeCallbacks.delete(id);
        if (typeof callback === 'function') {
            callback();
        }
    });
    DesktopNotifications.onClose((id) => {
        nativeCallbacks.delete(id);
    });
}

function showNativeNotification(title, body, opts) {
    ensureNativeListeners();

    const id = `kiwi-${Date.now()}-${++nextNotificationId}`;
    if (typeof opts.onclick === 'function') {
        nativeCallbacks.set(id, opts.onclick);
    }

    let result = null;
    try {
        result = DesktopNotifications.show({
            id,
            title,
            body,
            tag: opts.tag || '',
            ttl: opts.ttl,
        });
    } catch (err) {
        nativeCallbacks.delete(id);
        return false;
    }

    if (result && typeof result.then === 'function') {
        result.then((response) => {
            if (!response || !response.shown) {
                nativeCallbacks.delete(id);
            }
        }).catch(() => {
            nativeCallbacks.delete(id);
        });
    } else if (!result || !result.shown) {
        nativeCallbacks.delete(id);
    }

    return true;
}

export function requestPermission(state) {
    if (DesktopNotifications.isAvailable()) {
        isEnabled = true;
        state.$emit('notification.enabled');
        return;
    }

    // Do we support notifications?
    if (typeof window === 'undefined' || !('Notification' in window)) {
        isEnabled = false;
        return;
    }

    // Permissions already been granted?
    if (window.Notification.permission === 'granted') {
        state.$emit('notification.enabled');
        isEnabled = true;
        return;
    }

    if (window.Notification.permission !== 'denied') {
        window.Notification.requestPermission((permission) => {
            if (permission === 'granted') {
                state.$emit('notification.enabled');
                isEnabled = true;
            } else {
                isEnabled = false;
            }
        });
    }
}

export function show(title, body, opts = {}) {
    if (!isEnabled) {
        return false;
    }

    if (DesktopNotifications.isAvailable()) {
        return showNativeNotification(title, body, opts);
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
        return false;
    }

    let notify = new window.Notification(title, {
        body: body,
        icon: opts.icon,
        tag: opts.tag,
    });

    if (typeof opts.onclick === 'function') {
        notify.onclick = opts.onclick;
    }

    if (opts.ttl) {
        setTimeout(() => {
            if (notify && typeof notify.close === 'function') {
                notify.close();
            }
        }, opts.ttl);
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

        if (
            !isEnabled ||
            state.ui.notifications_enabled === false ||
            (state.ui.app_has_focus && !opts.force)
        ) {
            return;
        }

        if (!opts.message) {
            return;
        }

        throttledShow(opts.title, opts.message, {
            icon: opts.icon,
            ttl: opts.ttl,
            tag: opts.tag,
            onclick: opts.onclick,
        });
    });
}

export function listenForWebpushClicks(state) {
    if (isDesktop() || webpushClicksRegistered) {
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

    const handleNotificationStateRequest = (event) => {
        const data = event && event.data;
        if (!data || data.type !== 'kiwi-notifications-state-request') {
            return;
        }
        const port = event.ports && event.ports[0];
        if (!port || typeof port.postMessage !== 'function') {
            return;
        }
        port.postMessage({
            notificationsEnabled: state.ui.notifications_enabled !== false,
        });
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
            handleNotificationStateRequest(event);
        });
    }
}
