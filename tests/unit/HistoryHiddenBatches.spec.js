import state from '@/libs/state';

describe('hidden-only chathistory batches', () => {
    let s;
    let network;
    let buffer;
    let newestTime;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        network.enabled_caps = ['draft/chathistory'];
        buffer = s.addBuffer(network.id, '#channel');
        buffer.isMessageTrimming = false;
        buffer.setting('show_joinparts', false);
        newestTime = Date.now();
        s.addMessage(buffer, {
            time: newestTime,
            server_time: newestTime,
            nick: 'user',
            message: 'newest',
            irc_id: 'newest',
            tags: {},
            type: 'privmsg',
        });
        buffer.last_read = newestTime + 1000;
    });

    afterEach(() => {
        s.$destroy();
    });

    test('advances through hidden batches and finds older displayable messages', async() => {
        const calls = [];
        let resolveSecond;
        const secondCall = new Promise((resolve) => {
            resolveSecond = resolve;
        });

        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['msgid'],
            before: jest.fn((target, ref) => {
                calls.push(ref);
                if (calls.length === 1) {
                    const time = newestTime - 1000;
                    s.addMessage(buffer, {
                        time,
                        server_time: time,
                        nick: 'user',
                        message: 'joined',
                        irc_id: 'hidden1',
                        tags: { msgid: 'hidden1' },
                        type: 'traffic',
                    });
                    return Promise.resolve({
                        commands: [{ time, tags: { msgid: 'hidden1' } }],
                    });
                }

                const time = newestTime - 2000;
                s.addMessage(buffer, {
                    time,
                    server_time: time,
                    nick: 'user',
                    message: 'older message',
                    irc_id: 'older1',
                    tags: { msgid: 'older1' },
                    type: 'privmsg',
                });
                resolveSecond();
                return Promise.resolve({
                    commands: [{ time, tags: { msgid: 'older1' } }],
                });
            }),
        };

        buffer.requestScrollback();
        await secondCall;
        await Promise.resolve();

        expect(calls).toEqual(['newest', 'hidden1']);
        expect(buffer.flags.chathistory_available).toBe(true);
        expect(buffer.chathistory_cursor).toMatchObject({
            irc_id: 'older1',
        });
    });

    test('uses the chathistory cursor for the next manual request', async() => {
        buffer.chathistory_cursor = {
            irc_id: 'hidden1',
            server_time: newestTime - 1000,
        };
        const before = jest.fn(() => Promise.resolve({ commands: [] }));
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['msgid'],
            before,
        };

        buffer.requestScrollback();

        expect(before).toHaveBeenCalledWith('#channel', 'hidden1');
    });
});
