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
