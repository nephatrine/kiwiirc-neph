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

    test('force-trims internal buffers on mount and when switching', () => {
        let context = makeContext(true);

        MessageList.created.call(context);

        expect(context.highlight_timeout).toBeNull();
        expect(context.buffer.trimMessages).toHaveBeenCalledWith(true);

        context = makeContext(false);

        MessageList.created.call(context);

        expect(context.buffer.trimMessages).not.toHaveBeenCalled();

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
        const switchContext = {
            buffer: newBuffer,
            message_info_open: {},
            clearTemporaryHighlight: jest.fn(),
            auto_scroll: false,
            force_smooth_scroll: true,
            $nextTick: jest.fn(),
            scrollToBottom: jest.fn(),
        };

        MessageList.watch.buffer.call(switchContext, newBuffer, oldBuffer);

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
                isRaw: () => false,
                setting: (name) => (name === 'scrollback_size' ? 2 : false),
                getMessages: () => makeMessages(),
                getNetwork: () => ({ nick: 'me' }),
                message_count: 1,
            },
        };
    }

    test('caps internal buffer rendering to its scrollback size', () => {
        let result = MessageList.computed.filteredMessages.call(
            makeFilteredContext(true)
        );

        expect(result.map((message) => message.id)).toEqual([3, 4]);

        result = MessageList.computed.filteredMessages.call(
            makeFilteredContext(false)
        );

        expect(result.map((message) => message.id)).toEqual([1, 2, 3, 4]);
    });
});
