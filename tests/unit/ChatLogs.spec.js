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

    it('reports availability from the bridge and the main store', () => {
        window.kiwiDesktop = bridge(false);

        expect(ChatLogs.isBridgeAvailable()).toBe(true);
        expect(ChatLogs.isAvailable()).toBe(false);

        window.kiwiDesktop = bridge(true);

        expect(ChatLogs.isAvailable()).toBe(true);

        delete window.kiwiDesktop;

        expect(ChatLogs.isAvailable()).toBe(false);
    });
});
