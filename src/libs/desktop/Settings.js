function desktopSettings() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.settings || null;
}

export function isAvailable() {
    const settings = desktopSettings();
    return !!settings &&
        typeof settings.get === 'function' &&
        typeof settings.set === 'function';
}

export function get() {
    const settings = desktopSettings();
    if (!settings || typeof settings.get !== 'function') {
        return Promise.resolve(null);
    }
    return settings.get();
}

export function set(patch) {
    const settings = desktopSettings();
    if (!settings || typeof settings.set !== 'function') {
        return Promise.resolve(null);
    }
    return settings.set(patch);
}

export function onChanged(handler) {
    const settings = desktopSettings();
    if (!settings || typeof settings.onChanged !== 'function') {
        return () => {};
    }
    return settings.onChanged(handler);
}
