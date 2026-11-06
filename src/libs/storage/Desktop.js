function desktopStorage() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.storage || null;
}

export function isAvailable() {
    const storage = desktopStorage();
    return !!storage &&
        typeof storage.get === 'function' &&
        typeof storage.set === 'function';
}

export function get(name) {
    const storage = desktopStorage();
    if (!storage || typeof storage.get !== 'function') {
        return Promise.resolve(null);
    }
    return storage.get(name);
}

export function set(name, value) {
    const storage = desktopStorage();
    if (!storage || typeof storage.set !== 'function') {
        return Promise.resolve();
    }
    return storage.set(name, value);
}
