const {
    APP_CSP,
    APP_PERMISSIONS_POLICY,
    isAllowedPermission,
    isAppOrigin,
    isTrustedIpcSender,
} = require('../../desktop/electron/security');
const {
    EMBED_REFERER,
    addEmbedReferer,
} = require('../../desktop/electron/embed-referer');
const {
    APP_FRAME_SOURCE,
    addAppFrameAncestor,
    allowAppFrameAncestor,
} = require('../../desktop/electron/twitch-embed-policy');

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

describe('Desktop Twitch CSP', () => {
    it('allows the app scheme without duplicating or touching other policies', () => {
        let csp = 'frame-ancestors http://localhost:* https://localhost:*';

        expect(allowAppFrameAncestor(csp))
            .toBe('frame-ancestors http://localhost:* https://localhost:* ' + APP_FRAME_SOURCE);

        csp = "default-src 'self'; frame-ancestors https://example.com; " +
            "script-src 'self'";

        expect(allowAppFrameAncestor(csp)).toBe(
            "default-src 'self'; frame-ancestors https://example.com app:; " +
                "script-src 'self'"
        );

        csp = 'frame-ancestors http://localhost:* app:';
        expect(allowAppFrameAncestor(csp)).toBe(csp);

        csp = "default-src 'self'; script-src 'self'";
        expect(allowAppFrameAncestor(csp)).toBe(csp);
    });

    it('updates only the CSP header for arrays and strings', () => {
        const headers = {
            'Content-Type': 'text/html',
            'content-security-policy': [
                'frame-ancestors https://localhost:*',
            ],
        };
        const result = addAppFrameAncestor(headers);

        expect(result['Content-Type']).toBe('text/html');
        expect(result['content-security-policy']).toEqual([
            'frame-ancestors https://localhost:* app:',
        ]);

        const stringResult = addAppFrameAncestor({
            'Content-Security-Policy': 'frame-ancestors https://localhost:*',
        });

        expect(stringResult['Content-Security-Policy'])
            .toBe('frame-ancestors https://localhost:* app:');
    });
});

describe('Desktop embed request headers', () => {
    it('adds a referer when one is missing', () => {
        expect(addEmbedReferer({})).toEqual({
            Referer: EMBED_REFERER,
        });
        expect(addEmbedReferer({ Accept: '*/*' })).toEqual({
            Accept: '*/*',
            Referer: EMBED_REFERER,
        });
    });

    it('preserves an existing referer regardless of case', () => {
        expect(addEmbedReferer({ Referer: 'https://example.com/' }))
            .toEqual({ Referer: 'https://example.com/' });
        expect(addEmbedReferer({ referer: 'https://example.com/' }))
            .toEqual({ referer: 'https://example.com/' });
    });

    it('replaces an empty referer', () => {
        expect(addEmbedReferer({ Referer: '' })).toEqual({
            Referer: EMBED_REFERER,
        });
    });
});

let mockDesktopApi = null;
const mockListeners = new Map();
const mockIpcRenderer = {
    on: jest.fn((channel, listener) => {
        if (!mockListeners.has(channel)) {
            mockListeners.set(channel, new Set());
        }
        mockListeners.get(channel).add(listener);
    }),
    removeListener: jest.fn((channel, listener) => {
        const channelListeners = mockListeners.get(channel);
        if (channelListeners) {
            channelListeners.delete(listener);
        }
    }),
    sendSync: jest.fn(),
    invoke: jest.fn(),
};

jest.mock('electron', () => ({
    contextBridge: {
        exposeInMainWorld: jest.fn((key, value) => {
            if (key === 'kiwiDesktop') {
                mockDesktopApi = value;
            }
        }),
    },
    ipcRenderer: mockIpcRenderer,
}), { virtual: true });

require('../../desktop/electron/preload');

function emitEmbedError(...args) {
    const channelListeners = mockListeners.get('kiwi:embed-error');
    if (!channelListeners) {
        return;
    }
    channelListeners.forEach((listener) => listener(...args));
}

describe('Desktop embed error channel', () => {
    it('uses one IPC listener, drops removed handlers, and isolates throws', () => {
        const channel = mockDesktopApi.embedErrors;
        const first = jest.fn();
        const second = jest.fn();

        const removeFirst = channel.on(first);
        const removeSecond = channel.on(second);

        expect(mockIpcRenderer.on).toHaveBeenCalledTimes(1);
        expect(mockListeners.get('kiwi:embed-error').size).toBe(1);

        emitEmbedError({}, 'https://example.test/frame', 'ERR_FAILED');

        expect(first).toHaveBeenCalledWith({
            url: 'https://example.test/frame',
            error: 'ERR_FAILED',
        });
        expect(second).toHaveBeenCalledWith({
            url: 'https://example.test/frame',
            error: 'ERR_FAILED',
        });

        removeFirst();
        emitEmbedError({}, 'https://example.test/frame', 'ERR_FAILED');

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
        removeSecond();

        const failing = jest.fn(() => {
            throw new Error('handler failed');
        });
        const working = jest.fn();

        const removeFailing = channel.on(failing);
        const removeWorking = channel.on(working);

        expect(() => emitEmbedError(
            {},
            'https://example.test/frame',
            'ERR_FAILED'
        )).not.toThrow();
        expect(working).toHaveBeenCalledTimes(1);
        removeFailing();
        removeWorking();
    });

    it('ignores invalid handlers without attaching a listener', () => {
        const channel = mockDesktopApi.embedErrors;
        const calls = mockIpcRenderer.on.mock.calls.length;

        const remove = channel.on(null);

        expect(mockIpcRenderer.on).toHaveBeenCalledTimes(calls);
        expect(() => remove()).not.toThrow();
    });
});
