import state from '@/libs/state';

describe('relayed nick tracking', () => {
    let s;
    let network;
    let buffer;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        buffer = s.addBuffer(network.id, '#channel');
    });

    afterEach(() => {
        s.$destroy();
    });

    test('records relayed authors per buffer and keeps the map session-only', () => {
        s.addMessage(buffer, {
            time: Date.now(),
            nick: 'nephatrine/bridged',
            message: 'hello',
            tags: {
                'draft/relaymsg': 'DiscordBot',
            },
            type: 'privmsg',
        });

        expect(buffer.relayNicks['NEPHATRINE/BRIDGED'])
            .toBe('nephatrine/bridged');
        expect(Object.keys(buffer)).not.toContain('relayNicks');

        const exported = JSON.parse(s.exportState(true, false));
        const exportedBuffer = exported.networks[0].buffers.find((item) => (
            item.name === '#channel'
        ));
        expect(exportedBuffer.relayNicks).toBeUndefined();
    });

    test('does not record ordinary message authors', () => {
        s.addMessage(buffer, {
            time: Date.now(),
            nick: 'ordinary',
            message: 'hello',
            tags: {},
            type: 'privmsg',
        });

        expect(buffer.relayNicks.ORDINARY).toBeUndefined();
    });
});
