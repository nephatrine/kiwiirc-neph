function desktopUpdates() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.updates || null;
}

export function isAvailable() {
    const updates = desktopUpdates();
    return !!updates && typeof updates.check === 'function';
}

export function currentVersion() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return '';
    }
    return typeof window.kiwiDesktop.version === 'string' ?
        window.kiwiDesktop.version :
        '';
}

export function check() {
    const updates = desktopUpdates();
    if (!updates || typeof updates.check !== 'function') {
        return Promise.reject(new Error('desktop update checks are unavailable'));
    }
    return updates.check();
}

export function status() {
    const updates = desktopUpdates();
    if (!updates || typeof updates.status !== 'function') {
        return Promise.resolve(null);
    }
    return updates.status();
}

export function onStatus(handler) {
    const updates = desktopUpdates();
    if (!updates || typeof updates.onStatus !== 'function') {
        return () => {};
    }
    return updates.onStatus(handler);
}
