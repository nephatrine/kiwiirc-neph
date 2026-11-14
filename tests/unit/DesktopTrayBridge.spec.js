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
