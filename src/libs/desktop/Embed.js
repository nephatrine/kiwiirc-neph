export const DESKTOP_EMBED_HOST = 'localhost';

export function embedParentHostname() {
    if (typeof window === 'undefined') {
        return '';
    }
    return window.kiwiDesktop ?
        DESKTOP_EMBED_HOST :
        window.location.hostname;
}
