function desktopNotifications() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.notifications || null;
}

export function isAvailable() {
    const notifications = desktopNotifications();
    try {
        return !!notifications &&
            typeof notifications.isAvailable === 'function' &&
            notifications.isAvailable();
    } catch (err) {
        return false;
    }
}

export function show(payload) {
    const notifications = desktopNotifications();
    if (!notifications || typeof notifications.show !== 'function') {
        return Promise.resolve({ shown: false, reason: 'unavailable' });
    }
    try {
        return Promise.resolve(notifications.show(payload));
    } catch (err) {
        return Promise.resolve({ shown: false, reason: 'failed' });
    }
}

export function close(id) {
    const notifications = desktopNotifications();
    if (!notifications || typeof notifications.close !== 'function') {
        return Promise.resolve(false);
    }
    try {
        return Promise.resolve(notifications.close(id));
    } catch (err) {
        return Promise.resolve(false);
    }
}

export function onClick(handler) {
    const notifications = desktopNotifications();
    if (!notifications || typeof notifications.onClick !== 'function') {
        return () => {};
    }
    try {
        return notifications.onClick(handler);
    } catch (err) {
        return () => {};
    }
}

export function onClose(handler) {
    const notifications = desktopNotifications();
    if (!notifications || typeof notifications.onClose !== 'function') {
        return () => {};
    }
    try {
        return notifications.onClose(handler);
    } catch (err) {
        return () => {};
    }
}
