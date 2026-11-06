function desktopFiles() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.files || null;
}

export function isNativeDownloadAvailable() {
    return !!desktopFiles();
}

export function saveUrl(url) {
    const files = desktopFiles();
    if (!files || typeof files.saveUrl !== 'function') {
        return null;
    }
    return files.saveUrl(url);
}
