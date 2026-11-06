function desktopMedia() {
    if (typeof window === 'undefined' || !window.kiwiDesktop) {
        return null;
    }
    return window.kiwiDesktop.media || null;
}

export function isMediaProxyAvailable() {
    const media = desktopMedia();
    return !!media && typeof media.proxyUrl === 'function';
}

export function desktopMediaUrl(url) {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return url;
    }

    const media = desktopMedia();
    if (!media || typeof media.proxyUrl !== 'function') {
        return url;
    }

    return media.proxyUrl(url);
}
