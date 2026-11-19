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

export function exportBundle(bundle, filename, options = {}) {
    const profile = desktopProfile();
    if (!profile || typeof profile.export !== 'function') {
        return Promise.resolve({ saved: false });
    }
    return profile.export(JSON.stringify(bundle, null, 2), {
        filename,
        includeAssets: options.includeAssets !== false,
    });
}

export function importBundle() {
    const profile = desktopProfile();
    if (!profile || typeof profile.import !== 'function') {
        return Promise.resolve({ canceled: true });
    }
    return profile.import();
}

export function applyImport(pending) {
    const profile = desktopProfile();
    if (!profile || typeof profile.applyImport !== 'function' || !pending) {
        return Promise.resolve(null);
    }
    return profile.applyImport(pending);
}

export function cancelImport(pending) {
    const profile = desktopProfile();
    if (!profile || typeof profile.cancelImport !== 'function' || !pending) {
        return Promise.resolve(false);
    }
    return profile.cancelImport(pending);
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
