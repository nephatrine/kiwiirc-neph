const {
    APP_CSP,
    APP_PERMISSIONS_POLICY,
    isAllowedPermission,
    isAppOrigin,
    isTrustedIpcSender,
} = require('../../desktop/electron/security');

describe('desktop security policy', () => {
    it('defines a restrictive CSP and disables device features', () => {
        expect(APP_CSP).toContain("default-src 'self'");
        expect(APP_CSP).toContain("object-src 'none'");
        expect(APP_CSP).toContain("base-uri 'none'");
        expect(APP_CSP).toContain("frame-ancestors 'none'");
        expect(APP_CSP).toContain('kiwi-media:');
        expect(APP_CSP).toContain('kiwi-theme:');

        expect(APP_PERMISSIONS_POLICY).toContain('camera=()');
        expect(APP_PERMISSIONS_POLICY).toContain('microphone=()');
        expect(APP_PERMISSIONS_POLICY).toContain('display-capture=()');
        expect(APP_PERMISSIONS_POLICY).toContain('usb=()');
    });

    it('recognises origins and allows only the intended permissions', () => {
        expect(isAppOrigin('app://kiwi/index.html')).toBe(true);
        expect(isAppOrigin('https://example.com/')).toBe(false);
        expect(isAppOrigin('http://localhost:8080/', { isDev: false })).toBe(false);
        expect(isAppOrigin('http://localhost:8080/', { isDev: true })).toBe(true);

        expect(isAllowedPermission(
            'clipboard-sanitized-write',
            'app://kiwi/index.html'
        )).toBe(true);
        expect(isAllowedPermission(
            'fullscreen',
            'https://www.youtube.com/embed/example'
        )).toBe(true);
        expect(isAllowedPermission(
            'mediaKeySystem',
            'https://player.twitch.tv/'
        )).toBe(true);
        expect(isAllowedPermission(
            'notifications',
            'app://kiwi/index.html'
        )).toBe(false);
        expect(isAllowedPermission(
            'media',
            'app://kiwi/index.html'
        )).toBe(false);
        expect(isAllowedPermission(
            'fullscreen',
            'http://example.com/'
        )).toBe(false);
    });

    it('accepts only top-frame IPC, including early preload IPC', () => {
        const webContents = {};
        const event = {
            sender: webContents,
            senderFrame: {
                parent: null,
                url: 'app://kiwi/index.html',
            },
        };

        expect(isTrustedIpcSender(event, {
            webContents,
            isAllowedNavigation: (url) => url.startsWith('app://kiwi/'),
        })).toBe(true);

        expect(isTrustedIpcSender({
            sender: webContents,
            senderFrame: {
                parent: {},
                url: 'app://kiwi/index.html',
            },
        }, {
            webContents,
            isAllowedNavigation: () => true,
        })).toBe(false);

        expect(isTrustedIpcSender({
            sender: {},
            senderFrame: null,
        }, {
            webContents,
            isAllowedNavigation: () => true,
        })).toBe(false);

        expect(isTrustedIpcSender({
            sender: webContents,
            senderFrame: {
                parent: null,
                url: 'https://example.com/',
            },
        }, {
            webContents,
            isAllowedNavigation: () => false,
        })).toBe(false);

        expect(isTrustedIpcSender({
            sender: webContents,
            senderFrame: null,
        }, {
            webContents,
            isAllowedNavigation: () => false,
        })).toBe(true);
    });
});
