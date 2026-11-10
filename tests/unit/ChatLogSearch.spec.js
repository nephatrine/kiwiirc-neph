jest.mock('@/libs/desktop/ChatLogs', () => ({
    search: jest.fn(),
    isAvailable: jest.fn(() => true),
    onOpenSearch: jest.fn(() => () => {}),
}));

import * as ChatLogs from '@/libs/desktop/ChatLogs';
import ChatLogSearch from '@/components/ChatLogSearch';

describe('ChatLogSearch buffer filters', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('opens with a preselected network and buffer', () => {
        const context = {
            visible: false,
            error: 'old error',
            networkId: 0,
            bufferName: '',
            $nextTick: (cb) => cb(),
            $refs: {},
            search: jest.fn(),
        };

        ChatLogSearch.methods.open.call(context, {
            networkId: 5,
            bufferName: '#channel',
        });

        expect(context.visible).toBe(true);
        expect(context.error).toBe('');
        expect(context.networkId).toBe(5);
        expect(context.bufferName).toBe('#channel');
        expect(context.search).toHaveBeenCalledWith(true);
    });

    test('clears a previous buffer filter when opened without one', () => {
        const context = {
            visible: false,
            error: '',
            networkId: 5,
            bufferName: '#old',
            $nextTick: (cb) => cb(),
            $refs: {},
            search: jest.fn(),
        };

        ChatLogSearch.methods.open.call(context);

        expect(context.networkId).toBe(0);
        expect(context.bufferName).toBe('');
    });

    test('passes the buffer filter to log search', async() => {
        ChatLogs.search.mockResolvedValue({ rows: [], hasMore: false });
        const context = {
            loading: false,
            offset: 0,
            results: [],
            query: 'hello',
            networkId: 5,
            bufferName: '#channel',
            $t: (key) => key,
        };

        await ChatLogSearch.methods.search.call(context, true);

        expect(ChatLogs.search).toHaveBeenCalledWith({
            query: 'hello',
            networkId: 5,
            bufferName: '#channel',
            limit: 50,
            offset: 0,
        });
    });

    test('clears the buffer filter and searches again', () => {
        const context = {
            bufferName: '#channel',
            search: jest.fn(),
        };

        ChatLogSearch.methods.clearBufferFilter.call(context);

        expect(context.bufferName).toBe('');
        expect(context.search).toHaveBeenCalledWith(true);
    });
});
