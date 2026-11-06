function desktopSecrets() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.secrets || null;
}

export function isAvailable() {
    const secrets = desktopSecrets();
    return !!secrets &&
        typeof secrets.load === 'function' &&
        typeof secrets.save === 'function' &&
        typeof secrets.clear === 'function';
}

export function status() {
    const secrets = desktopSecrets();
    if (!secrets || typeof secrets.status !== 'function') {
        return Promise.resolve(null);
    }
    return secrets.status();
}

export function load(stateKey) {
    const secrets = desktopSecrets();
    if (!secrets || typeof secrets.load !== 'function') {
        return Promise.resolve(null);
    }
    return secrets.load(stateKey);
}

export function save(stateKey, values) {
    const secrets = desktopSecrets();
    if (!secrets || typeof secrets.save !== 'function') {
        return Promise.resolve(null);
    }
    return secrets.save(stateKey, values);
}

export function clear(stateKey) {
    const secrets = desktopSecrets();
    if (!secrets || typeof secrets.clear !== 'function') {
        return Promise.resolve(null);
    }
    return secrets.clear(stateKey);
}
