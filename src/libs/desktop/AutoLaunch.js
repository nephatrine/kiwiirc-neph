function desktopAutoLaunch() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.autoLaunch || null;
}

export function get() {
    const autoLaunch = desktopAutoLaunch();
    if (!autoLaunch || typeof autoLaunch.get !== 'function') {
        return Promise.resolve({
            supported: false,
            enabled: false,
        });
    }
    return autoLaunch.get();
}

export function set(enabled) {
    const autoLaunch = desktopAutoLaunch();
    if (!autoLaunch || typeof autoLaunch.set !== 'function') {
        return Promise.resolve({
            supported: false,
            enabled: false,
        });
    }
    return autoLaunch.set(enabled);
}
