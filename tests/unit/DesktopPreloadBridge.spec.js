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
        const listeners = mockListeners.get(channel);
        if (listeners) {
            listeners.delete(listener);
        }
    }),
    sendSync: jest.fn((channel) => (
        channel === 'kiwi:app-version' ? '2.2.0' : true
    )),
    send: jest.fn(),
    invoke: jest.fn((channel, ...args) => Promise.resolve({ channel, args })),
};

function emit(channel, ...args) {
    const listeners = mockListeners.get(channel);
    if (!listeners) {
        return;
    }
    listeners.forEach((listener) => listener({}, ...args));
}

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

describe('Desktop tray bridge', () => {
    it('reports tray support', () => {
        expect(mockDesktopApi.capabilities.tray).toBe(true);
        expect(mockDesktopApi.tray.isAvailable()).toBe(true);
        expect(mockIpcRenderer.sendSync).toHaveBeenCalledWith('kiwi:tray-supported');
    });

    it('sends badge summaries', () => {
        mockDesktopApi.tray.setBadge({
            unread: 2,
            highlights: 1,
            errors: 0,
        });

        expect(mockIpcRenderer.send).toHaveBeenCalledWith('kiwi:tray-badge', {
            unread: 2,
            highlights: 1,
            errors: 0,
        });
    });
});

describe('Desktop settings bridge', () => {
    it('reports desktop log support', () => {
        expect(mockDesktopApi.logs.isAvailable()).toBe(true);
        expect(mockIpcRenderer.sendSync).toHaveBeenCalledWith('kiwi:logs-supported');
    });

    it('reads and writes desktop settings', async() => {
        await expect(mockDesktopApi.settings.get()).resolves.toEqual({
            channel: 'kiwi:desktop-settings',
            args: [],
        });
        await expect(mockDesktopApi.settings.set({
            closeToTray: false,
            spellcheck: true,
        })).resolves.toEqual({
            channel: 'kiwi:desktop-settings-set',
            args: [{
                closeToTray: false,
                spellcheck: true,
            }],
        });
    });

    it('reads and writes auto-launch state', async() => {
        await expect(mockDesktopApi.autoLaunch.get()).resolves.toEqual({
            channel: 'kiwi:auto-launch-get',
            args: [],
        });
        await expect(mockDesktopApi.autoLaunch.set(true)).resolves.toEqual({
            channel: 'kiwi:auto-launch-set',
            args: [true],
        });
    });

    it('dispatches desktop settings changes', () => {
        const first = jest.fn();
        const second = jest.fn();
        const removeFirst = mockDesktopApi.settings.onChanged(first);
        const removeSecond = mockDesktopApi.settings.onChanged(second);

        emit('kiwi:desktop-settings-changed', { closeToTray: false });

        expect(first).toHaveBeenCalledWith({ closeToTray: false });
        expect(second).toHaveBeenCalledWith({ closeToTray: false });

        removeFirst();
        emit('kiwi:desktop-settings-changed', { closeToTray: true });

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
        removeSecond();
    });

    it('dispatches window visibility changes', () => {
        const handler = jest.fn();
        const remove = mockDesktopApi.windowVisibility.onChange(handler);

        emit('kiwi:window-visibility', false);

        expect(handler).toHaveBeenCalledWith(false);
        remove();
    });

    it('ignores invalid handlers', () => {
        expect(() => mockDesktopApi.settings.onChanged(null)()).not.toThrow();
        expect(() => mockDesktopApi.windowVisibility.onChange(null)()).not.toThrow();
    });
});

describe('Desktop notification bridge', () => {
    it('reports native notification support', () => {
        expect(mockDesktopApi.capabilities.nativeNotifications).toBe(true);
        expect(mockDesktopApi.notifications.isAvailable()).toBe(true);
        expect(mockIpcRenderer.sendSync).toHaveBeenCalledWith(
            'kiwi:notification-supported'
        );
    });

    it('forwards notification payloads to the main process', async() => {
        const payload = {
            id: 'n1',
            title: 'Title',
            body: 'Body',
        };

        await expect(mockDesktopApi.notifications.show(payload))
            .resolves.toEqual({
                channel: 'kiwi:notification-show',
                args: [payload],
            });
    });

    it('forwards notification close requests', async() => {
        await expect(mockDesktopApi.notifications.close('n1'))
            .resolves.toEqual({
                channel: 'kiwi:notification-close',
                args: ['n1'],
            });
    });

    it('dispatches click events to every registered handler', () => {
        const first = jest.fn();
        const second = jest.fn();

        const removeFirst = mockDesktopApi.notifications.onClick(first);
        const removeSecond = mockDesktopApi.notifications.onClick(second);

        emit('kiwi:notification-click', 'n1');

        expect(first).toHaveBeenCalledWith('n1', undefined);
        expect(second).toHaveBeenCalledWith('n1', undefined);

        removeFirst();
        emit('kiwi:notification-click', 'n2');

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
        removeSecond();
    });

    it('dispatches close events with the close reason', () => {
        const handler = jest.fn();
        const remove = mockDesktopApi.notifications.onClose(handler);

        emit('kiwi:notification-closed', 'n1', 'ttl');

        expect(handler).toHaveBeenCalledWith('n1', 'ttl');
        remove();
    });

    it('ignores invalid handlers', () => {
        const remove = mockDesktopApi.notifications.onClick(null);

        expect(() => remove()).not.toThrow();
    });
});

describe('Desktop updates bridge', () => {
    it('exposes the app version and update capability', () => {
        expect(mockDesktopApi.version).toBe('2.2.0');
        expect(mockDesktopApi.capabilities.updates).toBe(true);
    });

    it('checks updates and reads cached status', async() => {
        await expect(mockDesktopApi.updates.check()).resolves.toEqual({
            channel: 'kiwi:updates-check',
            args: [],
        });
        await expect(mockDesktopApi.updates.status()).resolves.toEqual({
            channel: 'kiwi:updates-status',
            args: [],
        });
    });

    it('dispatches update status changes', () => {
        const first = jest.fn();
        const second = jest.fn();
        const removeFirst = mockDesktopApi.updates.onStatus(first);
        const removeSecond = mockDesktopApi.updates.onStatus(second);

        emit('kiwi:update-status', { updateAvailable: true, latestVersion: '2.3.0' });

        expect(first).toHaveBeenCalledWith({
            updateAvailable: true,
            latestVersion: '2.3.0',
        });
        expect(second).toHaveBeenCalledWith({
            updateAvailable: true,
            latestVersion: '2.3.0',
        });

        removeFirst();
        emit('kiwi:update-status', { updateAvailable: false });

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
        removeSecond();
    });
});
