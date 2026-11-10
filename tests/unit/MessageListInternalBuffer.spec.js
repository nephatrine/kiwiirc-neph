import MessageList from '@/components/MessageList';

describe('MessageList internal buffer trimming', () => {
    function makeContext(immediate) {
        return {
            highlight_timeout: 'old-timeout',
            buffer: {
                shouldTrimImmediately: () => immediate,
                trimMessages: jest.fn(),
            },
        };
    }

    test('force-trims an internal buffer before the first render', () => {
        const context = makeContext(true);

        MessageList.created.call(context);

        expect(context.highlight_timeout).toBeNull();
        expect(context.buffer.trimMessages).toHaveBeenCalledWith(true);
    });

    test('does not force-trim a chat buffer on mount', () => {
        const context = makeContext(false);

        MessageList.created.call(context);

        expect(context.buffer.trimMessages).not.toHaveBeenCalled();
    });

    test('force-trims an internal buffer when switching to it', () => {
        const newBuffer = {
            shouldTrimImmediately: () => true,
            trimMessages: jest.fn(),
            flags: {},
            getNetwork: () => ({ state: 'connected' }),
        };
        const oldBuffer = {
            isMessageTrimming: false,
            scheduleTrim: jest.fn(),
        };
        const context = {
            buffer: newBuffer,
            message_info_open: {},
            clearTemporaryHighlight: jest.fn(),
            auto_scroll: false,
            force_smooth_scroll: true,
            $nextTick: jest.fn(),
            scrollToBottom: jest.fn(),
        };

        MessageList.watch.buffer.call(context, newBuffer, oldBuffer);

        expect(newBuffer.trimMessages).toHaveBeenCalledWith(true);
    });

    function makeMessages() {
        return [1, 2, 3, 4].map((id) => ({
            id,
            time: id,
            instance_num: id,
            type: 'message',
            ignore: false,
            user: null,
        }));
    }

    function makeFilteredContext(immediate) {
        return {
            buffer: {
                shouldTrimImmediately: () => immediate,
                setting: (name) => (name === 'scrollback_size' ? 2 : false),
                getMessages: () => makeMessages(),
                getNetwork: () => ({ nick: 'me' }),
                message_count: 1,
            },
        };
    }

    test('caps internal buffer rendering to its scrollback size', () => {
        const result = MessageList.computed.filteredMessages.call(
            makeFilteredContext(true)
        );

        expect(result.map((message) => message.id)).toEqual([3, 4]);
    });

    test('does not cap chat buffers in the rendered list', () => {
        const result = MessageList.computed.filteredMessages.call(
            makeFilteredContext(false)
        );

        expect(result.map((message) => message.id)).toEqual([1, 2, 3, 4]);
    });
});
