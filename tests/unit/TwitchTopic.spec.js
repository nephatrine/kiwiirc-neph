import state from '@/libs/state';

function emitParsed(client, command, event) {
    return new Promise((resolve, reject) => {
        client.parsed_middleware.handle(
            [command, event, client],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}

function joinEvent(channel = '#test') {
    return {
        command: 'JOIN',
        nick: 'TestNick',
        channel,
        ident: 'testnick',
        hostname: 'testnick.tmi.twitch.tv',
        gecos: '',
        account: '',
        params: [channel],
        tags: {},
        time: Date.now(),
    };
}

describe('Twitch channel topic on join', () => {
    let s;
    let network;
    let client;
    let buffer;

    function setup(server) {
        s = state.create();
        network = s.addNetwork('Network', 'TestNick', {
            server,
            port: 6697,
            tls: true,
        });
        network.state = 'connected';
        client = network.ircClient;
        client.user.nick = 'TestNick';
        jest.spyOn(client, 'raw').mockImplementation(() => {});
        buffer = s.addBuffer(network.id, '#test');
    }

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('adds a join topic message on a Twitch channel', async() => {
        setup('irc.chat.twitch.tv');

        await emitParsed(client, 'JOIN', joinEvent());

        const topics = buffer.messagesObj.messages.filter((msg) => msg.type === 'topic');
        expect(topics).toHaveLength(1);
        expect(topics[0].type_extra).toBe('topic_join');
        expect(topics[0].nick).toBe('');
        expect(topics[0].message).toContain('https://twitch.tv/test');
    });

    it('does not add the topic again on a later join', async() => {
        setup('irc.chat.twitch.tv');

        await emitParsed(client, 'JOIN', joinEvent());
        await emitParsed(client, 'JOIN', joinEvent());

        const topics = buffer.messagesObj.messages.filter((msg) => msg.type === 'topic');
        expect(topics).toHaveLength(1);
    });

    it('leaves non-Twitch channels unchanged', async() => {
        setup('irc.example.com');

        await emitParsed(client, 'JOIN', joinEvent());

        const topics = buffer.messagesObj.messages.filter((msg) => msg.type === 'topic');
        expect(topics).toHaveLength(0);
    });
});
