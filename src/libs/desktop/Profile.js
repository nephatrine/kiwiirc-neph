function desktopProfile() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.profile || null;
}

export function isAvailable() {
    const profile = desktopProfile();
    return !!profile &&
        typeof profile.export === 'function' &&
        typeof profile.import === 'function';
}

export function exportBundle(bundle, filename) {
    const profile = desktopProfile();
    if (!profile || typeof profile.export !== 'function') {
        return Promise.resolve({ saved: false });
    }
    return profile.export(JSON.stringify(bundle, null, 2), filename);
}

export function importBundle() {
    const profile = desktopProfile();
    if (!profile || typeof profile.import !== 'function') {
        return Promise.resolve({ canceled: true });
    }
    return profile.import();
}

export function backup() {
    const profile = desktopProfile();
    if (!profile || typeof profile.backup !== 'function') {
        return Promise.resolve(null);
    }
    return profile.backup();
}

export function openFolder() {
    const profile = desktopProfile();
    if (!profile || typeof profile.openFolder !== 'function') {
        return Promise.resolve();
    }
    return profile.openFolder();
}
