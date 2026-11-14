function desktopTray() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.tray || null;
}

export function isAvailable() {
    const tray = desktopTray();
    try {
        return !!tray &&
            typeof tray.isAvailable === 'function' &&
            tray.isAvailable();
    } catch (err) {
        return false;
    }
}

export function setBadge(summary) {
    const tray = desktopTray();
    if (!tray || typeof tray.setBadge !== 'function') {
        return;
    }
    try {
        tray.setBadge(summary);
    } catch (err) {
        // Badge updates are best-effort.
    }
}
