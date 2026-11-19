import MessageList from '@/components/MessageList';

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

describe('MessageList local log history tools', () => {
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
