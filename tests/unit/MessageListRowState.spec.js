import Vue from 'vue';
import MessageList from '@/components/MessageList';
import MessageListRow from '@/components/MessageListRow';
import { isConsecutiveMessage } from '@/libs/bufferTools';

function makeMessage(overrides = {}) {
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
    test('condenses the same author within a minute on the same day', () => {
        const previous = makeMessage({ id: 1, time: 1000 });
        const message = makeMessage({ id: 2, time: 20000 });

        expect(isConsecutiveMessage(previous, message)).toBe(true);
    });

    test('does not condense after a minute', () => {
        const previous = makeMessage({ id: 1, time: 1000 });
        const message = makeMessage({ id: 2, time: 61000 });

        expect(isConsecutiveMessage(previous, message)).toBe(false);
    });

    test('does not condense across a day change', () => {
        const previous = makeMessage({ id: 1, time: 1000, day_num: 1 });
        const message = makeMessage({ id: 2, time: 2000, day_num: 2 });

        expect(isConsecutiveMessage(previous, message)).toBe(false);
    });

    test('does not condense traffic or mixed message types', () => {
        const previous = makeMessage({ id: 1, time: 1000 });

        expect(isConsecutiveMessage(previous, makeMessage({
            id: 2,
            time: 2000,
            type: 'traffic',
        }))).toBe(false);
        expect(isConsecutiveMessage(makeMessage({
            id: 1,
            time: 1000,
            type: 'traffic',
        }), makeMessage({ id: 2, time: 2000 }))).toBe(false);
        expect(isConsecutiveMessage(previous, makeMessage({
            id: 2,
            time: 2000,
            type: 'action',
        }))).toBe(false);
    });

    test('never condenses the first message', () => {
        expect(isConsecutiveMessage(undefined, makeMessage())).toBe(false);
    });
});

describe('MessageList row state', () => {
    function context(messages, lastRead = 0) {
        return {
            filteredMessages: messages,
            buffer: { last_read: lastRead },
        };
    }

    test('unread marker sits on the first message after last_read', () => {
        const messages = [
            makeMessage({ id: 1, time: 1000 }),
            makeMessage({ id: 2, time: 2000 }),
            makeMessage({ id: 3, time: 3000 }),
        ];

        expect(MessageList.computed.unreadMarkerMessageId.call(
            context(messages, 2500)
        )).toBe(3);
    });

    test('unread marker is absent without a read marker', () => {
        const messages = [makeMessage({ id: 1 }), makeMessage({ id: 2 })];

        expect(MessageList.computed.unreadMarkerMessageId.call(
            context(messages, 0)
        )).toBeNull();
    });

    test('unread marker is absent when no message crosses last_read', () => {
        const messages = [
            makeMessage({ id: 1, time: 1000 }),
            makeMessage({ id: 2, time: 2000 }),
        ];

        expect(MessageList.computed.unreadMarkerMessageId.call(
            context(messages, 5000)
        )).toBeNull();
        expect(MessageList.computed.unreadMarkerMessageId.call(
            context(messages, 500)
        )).toBeNull();
    });

    test('shouldShowUnreadMarker matches the computed id', () => {
        const messages = [
            makeMessage({ id: 1, time: 1000 }),
            makeMessage({ id: 2, time: 2000 }),
        ];
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
            makeMessage({ id: 1, time: 1000 }),
            makeMessage({ id: 2, time: 2000 }),
            makeMessage({ id: 3, time: 200000 }),
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
            makeMessage({ id: 1, time: 1000, reply: 'a' }),
            makeMessage({ id: 2, time: 2000, reply: 'a' }),
            makeMessage({ id: 3, time: 3000, reply: 'b' }),
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
        const message = makeMessage();
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
