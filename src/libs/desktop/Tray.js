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

export function getSettings() {
    const tray = desktopTray();
    if (!tray || typeof tray.getSettings !== 'function') {
        return Promise.resolve(null);
    }
    return tray.getSettings();
}

export function setSettings(settings) {
    const tray = desktopTray();
    if (!tray || typeof tray.setSettings !== 'function') {
        return Promise.resolve(null);
    }
    return tray.setSettings(settings);
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

export function onSettingsChanged(handler) {
    const tray = desktopTray();
    if (!tray || typeof tray.onSettingsChanged !== 'function') {
        return () => {};
    }
    try {
        return tray.onSettingsChanged(handler);
    } catch (err) {
        return () => {};
    }
}
