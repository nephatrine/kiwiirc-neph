import * as ChatLogs from '@/libs/desktop/ChatLogs';

function bridge(available) {
    return {
        logs: {
            isAvailable: () => available,
            append: () => Promise.resolve(0),
            search: () => Promise.resolve({ rows: [], hasMore: false }),
        },
    };
}

describe('desktop chat log availability', () => {
    afterEach(() => {
        delete window.kiwiDesktop;
    });

    it('is unavailable when the main store failed', () => {
        window.kiwiDesktop = bridge(false);

        expect(ChatLogs.isBridgeAvailable()).toBe(true);
        expect(ChatLogs.isAvailable()).toBe(false);
    });

    it('is available when the main store opened', () => {
        window.kiwiDesktop = bridge(true);

        expect(ChatLogs.isAvailable()).toBe(true);
    });

    it('is unavailable without the desktop bridge', () => {
        expect(ChatLogs.isAvailable()).toBe(false);
    });
});
