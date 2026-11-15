function desktopLogs() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.logs || null;
}

export function isBridgeAvailable() {
    const logs = desktopLogs();
    return !!logs &&
        typeof logs.append === 'function' &&
        typeof logs.search === 'function';
}

export function isAvailable() {
    const logs = desktopLogs();
    if (!isBridgeAvailable()) {
        return false;
    }
    return typeof logs.isAvailable !== 'function' || logs.isAvailable();
}

export function append(entries) {
    const logs = desktopLogs();
    if (!logs || typeof logs.append !== 'function') {
        return Promise.resolve(0);
    }
    return logs.append(entries);
}

export function search(options) {
    const logs = desktopLogs();
    if (!logs || typeof logs.search !== 'function') {
        return Promise.resolve({ rows: [], hasMore: false });
    }
    return logs.search(options);
}

export function context(options) {
    const logs = desktopLogs();
    if (!logs || typeof logs.context !== 'function') {
        return Promise.resolve({ rows: [], hasOlder: false, hasNewer: false });
    }
    return logs.context(options);
}

export function redact(options) {
    const logs = desktopLogs();
    if (!logs || typeof logs.redact !== 'function') {
        return Promise.resolve(0);
    }
    return logs.redact(options);
}

export function confirm(options) {
    const logs = desktopLogs();
    if (!logs || typeof logs.confirm !== 'function') {
        return Promise.resolve(0);
    }
    return logs.confirm(options);
}

export function prune(retentionDays) {
    const logs = desktopLogs();
    if (!logs || typeof logs.prune !== 'function') {
        return Promise.resolve(0);
    }
    return logs.prune(retentionDays);
}

export function clear() {
    const logs = desktopLogs();
    if (!logs || typeof logs.clear !== 'function') {
        return Promise.resolve();
    }
    return logs.clear();
}

export function stats() {
    const logs = desktopLogs();
    if (!logs || typeof logs.stats !== 'function') {
        return Promise.resolve({ count: 0, oldest: 0, newest: 0, size: 0 });
    }
    return logs.stats();
}

export function status() {
    const logs = desktopLogs();
    if (!logs || typeof logs.status !== 'function') {
        return Promise.resolve({ available: false });
    }
    return logs.status();
}

export function onOpenSearch(handler) {
    const logs = desktopLogs();
    if (!logs || typeof logs.onOpenSearch !== 'function') {
        return () => {};
    }
    return logs.onOpenSearch(handler);
}
