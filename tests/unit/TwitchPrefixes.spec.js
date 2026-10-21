import state from '@/libs/state';
import { theMiddleware } from '@/libs/TwitchMiddleware';

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

function makeTwitchNetwork() {
    const s = state.create();
    const network = s.addNetwork('Twitch', 'TestNick', {
        server: 'irc.chat.twitch.tv',
        port: 6697,
        tls: true,
    });
    network.nick = 'TestNick';
    network.enabled_caps = ['twitch.tv/commands'];
    const self = s.addUser(network, { nick: 'TestNick' });
    return { s, network, self };
}

describe('Twitch channel prefixes', () => {
    it('applies the current user modes from USERSTATE', () => {
        const { s, network, self } = makeTwitchNetwork();
        const buffer = s.addBuffer(network.id, '#channel');
        const next = jest.fn();

        theMiddleware(network, 'unknown command', {
            command: 'USERSTATE',
            params: ['#channel'],
            tags: {
                mod: '1',
                subscriber: '1',
            },
        }, {}, next);

        expect(buffer.userModePrefix(self)).toBe('@+');
        expect(next).not.toHaveBeenCalled();
    });

    it('marks the channel owner from NAMES before they speak', async() => {
        const { s, network } = makeTwitchNetwork();
        const client = network.ircClient;
        client.user.nick = 'TestNick';
        jest.spyOn(client, 'raw').mockImplementation(() => {});
        const buffer = s.addBuffer(network.id, '#Streamer');

        const founder = s.addUser(network, { nick: 'Streamer' });
        s.addUserToBuffer(buffer, founder, []);
        network.applyTwitchUserModes(buffer, founder, { mod: '1' });

        await emitParsed(client, 'USERLIST', {
            command: 'USERLIST',
            channel: '#Streamer',
            users: [
                {
                    nick: 'Streamer',
                    ident: 'streamer',
                    hostname: 'streamer.tmi.twitch.tv',
                    modes: [],
                },
                {
                    nick: 'Viewer',
                    ident: 'viewer',
                    hostname: 'viewer.tmi.twitch.tv',
                    modes: [],
                },
            ],
            tags: {},
        });

        const viewer = network.userByName('Viewer');
        expect(buffer.userModePrefix(founder)).toBe('~@');
        expect(buffer.userModePrefix(viewer)).toBe('');
        jest.restoreAllMocks();
    });
});
