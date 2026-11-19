import Vue from 'vue';
import MessageList from '@/components/MessageList';
import MessageListRow from '@/components/MessageListRow';
import Container from '@/components/Container';
import ContainerHeader from '@/components/ContainerHeader';
import { isConsecutiveMessage } from '@/libs/bufferTools';

function makeRowMessage(overrides = {}) {
    return {
        id: 1,
        time: 1000,
        type: 'privmsg',
        day_num: 1,
        nick: 'Neph',
        reply: '',
        condenseKey: () => 'neph',
        ...overrides,
    };
}

describe('message condensing', () => {
    test('condenses only the same author within a minute on the same day', () => {
        const previous = makeRowMessage({ id: 1, time: 1000 });
        expect(isConsecutiveMessage(previous, makeRowMessage({ id: 2, time: 20000 })))
            .toBe(true);
        expect(isConsecutiveMessage(previous, makeRowMessage({ id: 2, time: 61000 })))
            .toBe(false);
        expect(isConsecutiveMessage(
            makeRowMessage({ id: 1, time: 1000, day_num: 1 }),
            makeRowMessage({ id: 2, time: 2000, day_num: 2 })
        )).toBe(false);
        expect(isConsecutiveMessage(previous, makeRowMessage({
            id: 2,
            time: 2000,
            type: 'traffic',
        }))).toBe(false);
        expect(isConsecutiveMessage(makeRowMessage({
            id: 1,
            time: 1000,
            type: 'traffic',
        }), makeRowMessage({ id: 2, time: 2000 }))).toBe(false);
        expect(isConsecutiveMessage(previous, makeRowMessage({
            id: 2,
            time: 2000,
            type: 'action',
        }))).toBe(false);
        expect(isConsecutiveMessage(undefined, makeRowMessage())).toBe(false);
    });
});

describe('MessageList row state', () => {
    function context(messages, lastRead = 0) {
        return {
            filteredMessages: messages,
            buffer: { last_read: lastRead },
        };
    }

    test('places the unread marker on the first message after last_read', () => {
        const messages = [
            makeRowMessage({ id: 1, time: 1000 }),
            makeRowMessage({ id: 2, time: 2000 }),
            makeRowMessage({ id: 3, time: 3000 }),
        ];

        expect(MessageList.computed.unreadMarkerMessageId.call(
            context(messages, 2500)
        )).toBe(3);
        expect(MessageList.computed.unreadMarkerMessageId.call(
            context([makeRowMessage({ id: 1 }), makeRowMessage({ id: 2 })], 0)
        )).toBeNull();
        expect(MessageList.computed.unreadMarkerMessageId.call(context([
            makeRowMessage({ id: 1, time: 1000 }),
            makeRowMessage({ id: 2, time: 2000 }),
        ], 5000))).toBeNull();
        expect(MessageList.computed.unreadMarkerMessageId.call(context([
            makeRowMessage({ id: 1, time: 1000 }),
            makeRowMessage({ id: 2, time: 2000 }),
        ], 500))).toBeNull();

        const ctx = {
            ...context(messages, 1500),
            unreadMarkerMessageId: 2,
        };
        expect(MessageList.methods.shouldShowUnreadMarker.call(ctx, messages[1]))
            .toBe(true);
        expect(MessageList.methods.shouldShowUnreadMarker.call(ctx, messages[0]))
            .toBe(false);
    });

    test('repeat flags are computed once per message', () => {
        const messages = [
            makeRowMessage({ id: 1, time: 1000 }),
            makeRowMessage({ id: 2, time: 2000 }),
            makeRowMessage({ id: 3, time: 200000 }),
        ];
        const repeats = MessageList.computed.messageRepeats.call(
            context(messages)
        );

        expect(repeats.get(messages[0])).toBe(false);
        expect(repeats.get(messages[1])).toBe(true);
        expect(repeats.get(messages[2])).toBe(false);
    });

    test('reply preview flags follow consecutive replies', () => {
        const messages = [
            makeRowMessage({ id: 1, time: 1000, reply: 'a' }),
            makeRowMessage({ id: 2, time: 2000, reply: 'a' }),
            makeRowMessage({ id: 3, time: 3000, reply: 'b' }),
        ];
        const previews = MessageList.computed.messageReplyPreviews.call(
            context(messages)
        );

        expect(previews.get(messages[0])).toBe(true);
        expect(previews.get(messages[1])).toBe(false);
        expect(previews.get(messages[2])).toBe(true);
    });
});

describe('MessageListRow', () => {
    function mountRow(props) {
        const received = {};
        const RowStub = {
            props: [
                'message',
                'idx',
                'ml',
                'showWithoutUser',
                'showRealNames',
                'showHostNames',
                'network',
                'hasExtendedJoin',
                'repeat',
                'showReplyPreview',
            ],
            created() {
                Object.keys(this.$options.props).forEach((name) => {
                    received[name] = this[name];
                });
            },
            render: (h) => h('div'),
        };
        const message = makeRowMessage();
        const ml = { name: 'ml' };
        const network = { name: 'network' };

        new Vue({
            render: (h) => h(MessageListRow, {
                props: {
                    rowComponent: RowStub,
                    message,
                    idx: 4,
                    ml,
                    showWithoutUser: true,
                    showRealNames: false,
                    showHostNames: true,
                    network,
                    hasExtendedJoin: true,
                    repeat: true,
                    showReplyPreview: false,
                },
            }),
        }).$mount();

        return { received, message, ml, network };
    }

    test('forwards row state and precomputed flags', () => {
        const { received, message, ml, network } = mountRow();

        expect(received.message).toBe(message);
        expect(received.ml).toBe(ml);
        expect(received.network).toBe(network);
        expect(received.idx).toBe(4);
        expect(received.showWithoutUser).toBe(true);
        expect(received.showRealNames).toBe(false);
        expect(received.showHostNames).toBe(true);
        expect(received.hasExtendedJoin).toBe(true);
        expect(received.repeat).toBe(true);
        expect(received.showReplyPreview).toBe(false);
    });
});

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

describe('MessageList local log history tools', () => {
    function makeBuffer(options = {}) {
        return {
            networkid: 1,
            name: '#channel',
            flags: {
                chathistory_available: options.chathistoryAvailable !== false,
            },
            isChannel: () => options.channel !== false,
            isQuery: () => !!options.query,
            getNetwork: () => ({
                state: 'connected',
                ircClient: {
                    chathistory: {
                        isSupported: () => !!options.historySupported,
                    },
                },
            }),
        };
    }

    test('decides when to offer local logs and opens them', () => {
        const cases = [
            {
                options: { historySupported: false },
                localLogsAvailable: true,
                expected: true,
            },
            {
                options: {
                    historySupported: true,
                    chathistoryAvailable: false,
                },
                localLogsAvailable: true,
                expected: true,
            },
            {
                options: {
                    historySupported: true,
                    chathistoryAvailable: true,
                },
                localLogsAvailable: true,
                expected: false,
            },
            {
                options: { historySupported: false },
                localLogsAvailable: false,
                expected: false,
            },
        ];

        cases.forEach((testCase) => {
            const context = {
                buffer: makeBuffer(testCase.options),
                localLogsAvailable: testCase.localLogsAvailable,
            };

            expect(MessageList.computed.shouldShowLocalLogsTools.call(context))
                .toBe(testCase.expected);
        });

        const emit = jest.fn();
        const context = {
            buffer: {
                networkid: 7,
                name: '#channel',
            },
            $state: { $emit: emit },
        };

        MessageList.methods.openChannelLogs.call(context);

        expect(emit).toHaveBeenCalledWith('chatlogs.open', {
            networkId: 7,
            bufferName: '#channel',
            source: 'local',
        });
    });
});

describe('MessageList history context scrolling', () => {
    test('skips the bottom jump while context is loading', () => {
        let context = {
            auto_scroll: true,
            buffer: { historyContextLoading: true },
            scrollToBottom: jest.fn(),
        };

        MessageList.methods.maybeScrollToBottom.call(context);
        expect(context.scrollToBottom).not.toHaveBeenCalled();

        context = {
            auto_scroll: true,
            buffer: { historyContextLoading: false },
            scrollToBottom: jest.fn(),
        };

        MessageList.methods.maybeScrollToBottom.call(context);
        expect(context.scrollToBottom).toHaveBeenCalled();
    });
});

describe('MessageList temporary message highlight', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function makeContext() {
        return {
            highlighted_message_id: null,
            highlight_timeout: null,
        };
    }

    test('highlights the focused message, clears after the timeout, or immediately', () => {
        let context = makeContext();

        MessageList.methods.highlightMessage.call(context, 42);

        expect(context.highlighted_message_id).toBe(42);
        expect(MessageList.methods.isTemporaryHighlighted.call(
            context,
            { id: 42 }
        )).toBe(true);
        expect(MessageList.methods.isTemporaryHighlighted.call(
            context,
            { id: 43 }
        )).toBe(false);

        jest.advanceTimersByTime(4000);

        expect(context.highlighted_message_id).toBeNull();
        expect(context.highlight_timeout).toBeNull();

        context = makeContext();
        MessageList.methods.highlightMessage.call(context, 7);

        MessageList.methods.clearTemporaryHighlight.call(context);

        expect(context.highlighted_message_id).toBeNull();
        expect(context.highlight_timeout).toBeNull();
    });

    test('replaces an older highlight and its timer', () => {
        const context = makeContext();
        MessageList.methods.highlightMessage.call(context, 1);
        MessageList.methods.highlightMessage.call(context, 2);

        jest.advanceTimersByTime(4000);

        expect(context.highlighted_message_id).toBeNull();
    });
});

describe('Container message list refresh key', () => {
    function makeContext(buffer, settings) {
        return {
            buffer,
            $state: {
                setting: jest.fn((key) => settings[key]),
            },
        };
    }

    test('changes with the buffer, theme, layout, and font settings, or uses the global layout', () => {
        const buffer = {
            name: '#kiwiirc',
            setting: jest.fn(() => 'inline'),
        };
        const settings = {
            theme: 'NephWave',
            useMonospace: false,
        };
        const context = makeContext(buffer, settings);

        const initialKey = Container.computed.messageListKey.call(context);

        settings.theme = 'NephDeck';
        const themeKey = Container.computed.messageListKey.call(context);
        expect(themeKey).not.toBe(initialKey);

        buffer.setting.mockReturnValue('corporate');
        const layoutKey = Container.computed.messageListKey.call(context);
        expect(layoutKey).not.toBe(themeKey);

        settings.useMonospace = true;
        const fontKey = Container.computed.messageListKey.call(context);
        expect(fontKey).not.toBe(layoutKey);

        buffer.name = '#other';
        const bufferKey = Container.computed.messageListKey.call(context);
        expect(bufferKey).not.toBe(fontKey);

        const globalContext = makeContext({ name: '#kiwiirc' }, {
            'buffers.messageLayout': 'modern',
            'theme': 'Default',
            'useMonospace': false,
        });

        expect(Container.computed.messageListKey.call(globalContext))
            .toBe('#kiwiirc|Default|modern|sans');
    });
});

describe('ContainerHeader link handling', () => {
    function makeContext(network = null) {
        return {
            buffer: {
                networkid: 1,
                getNetwork: () => network,
            },
            $state: {
                addBuffer: jest.fn(),
                $emit: jest.fn(),
            },
        };
    }

    test('opens media handles and joins channel links in the topic', () => {
        const url = 'https://example.com/image.jpg';
        const handle = {
            getAttribute: jest.fn((name) => (
                name === 'data-url' ? url : null
            )),
        };
        const mediaEvent = {
            target: {
                closest: jest.fn((selector) => (
                    selector === 'a[data-url]' ? handle : null
                )),
            },
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        };
        let context = makeContext();

        ContainerHeader.methods.onHeaderClick.call(context, mediaEvent);

        expect(context.$state.$emit).toHaveBeenCalledWith('mediaviewer.show', url);
        expect(mediaEvent.preventDefault).toHaveBeenCalled();
        expect(mediaEvent.stopPropagation).toHaveBeenCalled();
        expect(context.$state.addBuffer).not.toHaveBeenCalled();

        const channel = {
            getAttribute: jest.fn((name) => (
                name === 'data-channel-name' ? '#other' : null
            )),
        };
        const network = {
            ircClient: {
                join: jest.fn(),
            },
        };
        const channelEvent = {
            target: {
                closest: jest.fn((selector) => {
                    if (selector === 'a[data-url]') {
                        return null;
                    }
                    return selector === '[data-channel-name]' ? channel : null;
                }),
            },
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        };
        context = makeContext(network);

        ContainerHeader.methods.onHeaderClick.call(context, channelEvent);

        expect(context.$state.addBuffer).toHaveBeenCalledWith(1, '#other');
        expect(network.ircClient.join).toHaveBeenCalledWith('#other');
        expect(context.$state.$emit).not.toHaveBeenCalled();
    });

    test('enables search only with server support and ignores clicks without it', () => {
        let context = makeContext({
            state: 'connected',
            ircClient: {
                search: {
                    isSupported: () => true,
                },
            },
        });

        expect(ContainerHeader.computed.canSearch.call(context)).toBe(true);

        context = makeContext({
            state: 'connected',
            ircClient: {
                search: {
                    isSupported: () => false,
                },
            },
        });

        expect(ContainerHeader.computed.canSearch.call(context)).toBe(false);

        context.canSearch = false;

        ContainerHeader.methods.searchMessages.call(context);

        expect(context.$state.$emit).not.toHaveBeenCalled();
    });
});
