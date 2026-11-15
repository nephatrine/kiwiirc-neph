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
