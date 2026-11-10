import state from '@/libs/state';

function flushPromises() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe('chathistory cursor timestamps', () => {
    let s;
    let network;
    let buffer;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        network.enabled_caps = ['draft/chathistory'];
        buffer = s.addBuffer(network.id, '#channel');
        buffer.isMessageTrimming = false;
    });

    afterEach(() => {
        jest.useRealTimers();
        s.$destroy();
    });

    function installHistory(overrides = {}) {
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['timestamp'],
            latest: jest.fn(() => Promise.resolve({ commands: [] })),
            before: jest.fn(() => Promise.resolve({ commands: [] })),
            ...overrides,
        };
    }

    test('uses the oldest tagged event time for the cursor and manual loading', async() => {
        const latest = jest.fn(() => Promise.resolve({
            commands: [
                { tags: { time: '2026-11-10T20:06:05.166Z' } },
                {
                    tags: {
                        time: '2026-11-10T21:35:24.550Z',
                        msgid: 'chat-id',
                    },
                },
            ],
        }));
        const before = jest.fn(() => Promise.resolve({ commands: [] }));
        installHistory({ latest, before });

        buffer.requestLatestScrollback();
        await flushPromises();

        expect(buffer.chathistory_cursor).toMatchObject({
            irc_id: '',
            server_time: Date.parse('2026-11-10T20:06:05.166Z'),
        });

        buffer.requestScrollback();

        expect(before).toHaveBeenCalledTimes(1);
        expect(before.mock.calls[0][1]).toBeInstanceOf(Date);
        expect(before.mock.calls[0][1].toISOString())
            .toBe('2026-11-10T20:06:05.166Z');

        await flushPromises();
    });

    test('advances through presence-only batches using tagged times', async() => {
        jest.useFakeTimers();

        buffer.setting('show_joinparts', false);
        buffer.chathistory_cursor = {
            server_time: Date.parse('2026-11-10T21:00:00.000Z'),
        };

        let resolveSecond;
        const secondCall = new Promise((resolve) => {
            resolveSecond = resolve;
        });

        const before = jest.fn(() => {
            if (before.mock.calls.length === 1) {
                for (let i = 0; i < 5; i += 1) {
                    const time = Date.parse('2026-11-10T20:00:00.000Z') + i;
                    s.addMessage(buffer, {
                        time,
                        server_time: time,
                        nick: 'user',
                        message: 'joined',
                        type: 'traffic',
                        tags: {},
                    });
                }

                return Promise.resolve({
                    commands: [{ tags: { time: '2026-11-10T20:00:00.000Z' } }],
                });
            }

            const time = Date.parse('2026-11-10T19:00:00.000Z');
            s.addMessage(buffer, {
                time,
                server_time: time,
                nick: 'user',
                message: 'older message',
                irc_id: 'older',
                tags: { msgid: 'older', time: '2026-11-10T19:00:00.000Z' },
                type: 'privmsg',
            });
            resolveSecond();

            return Promise.resolve({
                commands: [{
                    tags: {
                        time: '2026-11-10T19:00:00.000Z',
                        msgid: 'older',
                    },
                }],
            });
        });

        installHistory({ before });

        buffer.requestScrollback();
        await secondCall;
        await flushMicrotasks();

        expect(before).toHaveBeenCalledTimes(2);
        expect(before.mock.calls[0][1].toISOString())
            .toBe('2026-11-10T21:00:00.000Z');
        expect(before.mock.calls[1][1].toISOString())
            .toBe('2026-11-10T20:00:00.000Z');
        expect(buffer.flags.chathistory_available).toBe(true);
    });
});
