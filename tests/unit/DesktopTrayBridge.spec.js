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
    sendSync: jest.fn(() => true),
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

    it('reads and writes tray settings', async() => {
        await expect(mockDesktopApi.tray.getSettings()).resolves.toEqual({
            channel: 'kiwi:tray-settings',
            args: [],
        });
        await expect(mockDesktopApi.tray.setSettings({ closeToTray: false }))
            .resolves.toEqual({
                channel: 'kiwi:tray-settings-set',
                args: [{ closeToTray: false }],
            });
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

    it('dispatches settings changes', () => {
        const first = jest.fn();
        const second = jest.fn();
        const removeFirst = mockDesktopApi.tray.onSettingsChanged(first);
        const removeSecond = mockDesktopApi.tray.onSettingsChanged(second);

        emit('kiwi:tray-settings-changed', { closeToTray: false });

        expect(first).toHaveBeenCalledWith({ closeToTray: false });
        expect(second).toHaveBeenCalledWith({ closeToTray: false });

        removeFirst();
        emit('kiwi:tray-settings-changed', { closeToTray: true });

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
        removeSecond();
    });

    it('ignores invalid settings handlers', () => {
        const remove = mockDesktopApi.tray.onSettingsChanged(null);

        expect(() => remove()).not.toThrow();
    });
});
