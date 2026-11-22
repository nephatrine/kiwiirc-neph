function desktopPluginSecrets() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.pluginSecrets || null;
}

export function isAvailable() {
    const secrets = desktopPluginSecrets();
    return !!secrets &&
        typeof secrets.get === 'function' &&
        typeof secrets.set === 'function';
}

export function get(scope) {
    const secrets = desktopPluginSecrets();
    if (!secrets || typeof secrets.get !== 'function') {
        return Promise.resolve(null);
    }
    return secrets.get(scope);
}

// A null value removes the scope entirely.
export function set(scope, value) {
    const secrets = desktopPluginSecrets();
    if (!secrets || typeof secrets.set !== 'function') {
        return Promise.resolve(false);
    }
    return secrets.set(scope, value === null ? null : String(value));
}
