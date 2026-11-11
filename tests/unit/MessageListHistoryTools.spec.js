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
    test('offers local logs when chathistory is unsupported', () => {
        const context = {
            buffer: makeBuffer({ historySupported: false }),
            localLogsAvailable: true,
        };

        expect(MessageList.computed.shouldShowLocalLogsTools.call(context))
            .toBe(true);
    });

    test('offers local logs when server history is exhausted', () => {
        const context = {
            buffer: makeBuffer({
                historySupported: true,
                chathistoryAvailable: false,
            }),
            localLogsAvailable: true,
        };

        expect(MessageList.computed.shouldShowLocalLogsTools.call(context))
            .toBe(true);
    });

    test('does not offer local logs while server history remains', () => {
        const context = {
            buffer: makeBuffer({
                historySupported: true,
                chathistoryAvailable: true,
            }),
            localLogsAvailable: true,
        };

        expect(MessageList.computed.shouldShowLocalLogsTools.call(context))
            .toBe(false);
    });

    test('does not offer local logs without the desktop log store', () => {
        const context = {
            buffer: makeBuffer({ historySupported: false }),
            localLogsAvailable: false,
        };

        expect(MessageList.computed.shouldShowLocalLogsTools.call(context))
            .toBe(false);
    });

    test('opens channel logs with the current network and buffer', () => {
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
