function desktopNetworkIcons() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.networkIcons || null;
}

export function isAvailable() {
    const icons = desktopNetworkIcons();
    return !!icons && typeof icons.choose === 'function';
}

export function choose(networkName) {
    const icons = desktopNetworkIcons();
    if (!icons || typeof icons.choose !== 'function') {
        return Promise.resolve({ canceled: true });
    }
    return icons.choose(networkName);
}
