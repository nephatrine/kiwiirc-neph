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

function emit(channel, ...args) {
    const channelListeners = mockListeners.get(channel);
    if (!channelListeners) {
        return;
    }
    channelListeners.forEach((listener) => listener(...args));
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

describe('Desktop embed error channel', () => {
    it('uses one IPC listener, drops removed handlers, and isolates throws', () => {
        const channel = mockDesktopApi.embedErrors;
        const first = jest.fn();
        const second = jest.fn();

        const removeFirst = channel.on(first);
        const removeSecond = channel.on(second);

        expect(mockIpcRenderer.on).toHaveBeenCalledTimes(1);
        expect(mockListeners.get('kiwi:embed-error').size).toBe(1);

        emit(
            'kiwi:embed-error',
            {},
            'https://example.test/frame',
            'ERR_FAILED'
        );

        expect(first).toHaveBeenCalledWith({
            url: 'https://example.test/frame',
            error: 'ERR_FAILED',
        });
        expect(second).toHaveBeenCalledWith({
            url: 'https://example.test/frame',
            error: 'ERR_FAILED',
        });

        removeFirst();
        emit(
            'kiwi:embed-error',
            {},
            'https://example.test/frame',
            'ERR_FAILED'
        );

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
        removeSecond();

        const failing = jest.fn(() => {
            throw new Error('handler failed');
        });
        const working = jest.fn();

        const removeFailing = channel.on(failing);
        const removeWorking = channel.on(working);

        expect(() => emit(
            'kiwi:embed-error',
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
