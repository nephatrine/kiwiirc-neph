const APP_CSP = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    // Plugins are trusted code and bundled HTML plugins may contain inline
    // scripts. Captcha providers may also use eval, so script-src cannot use a
    // nonce-only policy here.
    "script-src 'self' https: 'unsafe-inline' 'unsafe-eval' kiwi-plugin:",
    "style-src 'self' 'unsafe-inline' https: kiwi-theme: kiwi-plugin:",
    "img-src 'self' data: blob: https: kiwi-media: kiwi-theme: kiwi-emoji: kiwi-icon: kiwi-plugin:",
    "font-src 'self' data: https: kiwi-theme: kiwi-plugin:",
    "media-src 'self' data: blob: https: kiwi-media: kiwi-plugin:",
    "connect-src 'self' https: wss: ws: kiwi-plugin:",
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "manifest-src 'self'",
].join('; ');

const APP_PERMISSIONS_POLICY = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'display-capture=()',
    'usb=()',
    'serial=()',
    'hid=()',
    'midi=()',
].join(', ');

const APP_PERMISSIONS = new Set([
    'clipboard-sanitized-write',
    'fullscreen',
    'automatic-fullscreen',
    'mediaKeySystem',
    // IRC gateways and bouncers may live on localhost or a private network.
    'local-network',
    'local-network-access',
    'loopback-network',
]);

const EMBED_PERMISSIONS = new Set([
    'fullscreen',
    'automatic-fullscreen',
    'mediaKeySystem',
]);

function parseUrl(value) {
    try {
        return new URL(String(value || ''));
    } catch (err) {
        return null;
    }
}

function isAppOrigin(value, {
    appScheme = 'app',
    appHost = 'kiwi',
    devOrigin = 'http://localhost:8080',
    isDev = false,
} = {}) {
    const url = parseUrl(value);
    if (!url) {
        return false;
    }
    if (url.protocol === `${appScheme}:` && url.host === appHost) {
        return true;
    }
    return isDev && url.origin === devOrigin;
}

function isHttpsOrigin(value) {
    const url = parseUrl(value);
    return !!url && url.protocol === 'https:';
}

function isAllowedPermission(permission, requestingUrl, context = {}) {
    if (isAppOrigin(requestingUrl, context)) {
        return APP_PERMISSIONS.has(permission);
    }
    if (isHttpsOrigin(requestingUrl)) {
        return EMBED_PERMISSIONS.has(permission);
    }
    return false;
}

function isTrustedIpcSender(event, {
    webContents = null,
    isAllowedNavigation = null,
} = {}) {
    if (!event || !webContents || event.sender !== webContents) {
        return false;
    }

    const frame = event.senderFrame;
    if (frame && frame.parent) {
        return false;
    }
    if (frame && frame.url && frame.url !== 'about:blank' &&
        typeof isAllowedNavigation === 'function' &&
        !isAllowedNavigation(frame.url)
    ) {
        return false;
    }
    return true;
}

module.exports = {
    APP_CSP,
    APP_PERMISSIONS_POLICY,
    isAllowedPermission,
    isAppOrigin,
    isHttpsOrigin,
    isTrustedIpcSender,
};
