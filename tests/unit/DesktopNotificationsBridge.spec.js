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
