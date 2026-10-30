import state from '@/libs/state';
import { PUMP_MS } from '@/libs/RelayMeta';

describe('IrcClient CTCP messages', () => {
    let s;
    let network;
    let client;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        network.state = 'connected';
        network.nick = 'TestNick';
        client = network.ircClient;
        client.user.nick = 'TestNick';
        client.user.gecos = 'Test User';
        client.ctcpResponse = jest.fn();
        network.gecos = 'Test User';
        /* eslint-disable-next-line no-underscore-dangle */
        global.__VERSION__ = 'test-version';
    });

    function dispatchCtcp(command, event) {
        client.parsed_middleware.handle([command, event, client], (err) => {
            if (err) {
                throw err;
            }
        });
    }

    function lastServerMessage() {
        let messages = network.serverBuffer().getMessages();
        return messages[messages.length - 1];
    }

    it('renders unconsumed CTCP responses as informational messages', () => {
        dispatchCtcp('ctcp response', {
            nick: 'Other',
            type: 'TIME',
            message: 'TIME Fri Oct 30 12:00:00 2026',
            target: 'TestNick',
            time: Date.now(),
            tags: {},
        });

        let message = lastServerMessage();
        expect(message.type).toBe('ctcp');
        expect(message.message).toContain('[CTCP Other reply]');
    });

    it('renders CTCP requests as informational messages', () => {
        dispatchCtcp('ctcp request', {
            nick: 'Other',
            type: 'TIME',
            message: 'TIME',
            target: '#test',
            time: Date.now(),
            tags: {},
        });

        let message = lastServerMessage();
        expect(message.type).toBe('ctcp');
        expect(message.message).toContain('[CTCP Other]');
    });

    describe('automatic CTCP replies', () => {
        function request(type, message, overrides = {}) {
            dispatchCtcp('ctcp request', {
                nick: 'Other',
                type,
                message,
                target: 'TestNick',
                time: Date.now(),
                tags: {},
                ...overrides,
            });
        }

        it('replies to supported metadata queries', () => {
            request('CLIENTINFO', 'CLIENTINFO');
            expect(client.ctcpResponse).toHaveBeenLastCalledWith(
                'Other',
                'CLIENTINFO',
                'ACTION CLIENTINFO FINGER PING SOURCE TIME USERINFO VERSION'
            );

            request('VERSION', 'VERSION');
            expect(client.ctcpResponse).toHaveBeenLastCalledWith(
                'Other',
                'VERSION',
                'Kiwi IRC test-version'
            );

            request('FINGER', 'FINGER');
            expect(client.ctcpResponse).toHaveBeenLastCalledWith('Other', 'FINGER', 'Test User');

            request('USERINFO', 'USERINFO');
            expect(client.ctcpResponse).toHaveBeenLastCalledWith(
                'Other',
                'USERINFO',
                'TestNick (Test User)'
            );

            request('SOURCE', 'SOURCE');
            expect(client.ctcpResponse).toHaveBeenLastCalledWith(
                'Other',
                'SOURCE',
                'https://code.nephatrine.net/nephatrine/kiwiirc'
            );
        });

        it('echoes PING parameters exactly', () => {
            request('PING', 'PING 123 456');
            expect(client.ctcpResponse).toHaveBeenLastCalledWith('Other', 'PING', '123 456');
        });

        it('replies to TIME with an ISO 8601 timestamp', () => {
            request('TIME', 'TIME');
            expect(client.ctcpResponse).toHaveBeenLastCalledWith(
                'Other',
                'TIME',
                expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
            );
        });

        it('does not reply to ACTION or undocumented USERNAME', () => {
            request('ACTION', 'ACTION waves');
            request('USERNAME', 'USERNAME');
            expect(client.ctcpResponse).not.toHaveBeenCalled();
        });

        it('replies when a request targets our own nick', () => {
            request('VERSION', 'VERSION', { nick: 'TestNick' });
            expect(client.ctcpResponse).toHaveBeenCalledWith(
                'TestNick',
                'VERSION',
                'Kiwi IRC test-version'
            );
        });

        it('does not reply when the target is another nick or a channel', () => {
            request('VERSION', 'VERSION', { target: 'OtherClient' });
            request('VERSION', 'VERSION', { target: '#test' });
            expect(client.ctcpResponse).not.toHaveBeenCalled();
        });

        it('replies to a server request through the server hostname', () => {
            request('VERSION', 'VERSION', {
                from_server: true,
                hostname: 'server.example',
            });
            expect(client.ctcpResponse).toHaveBeenCalledWith(
                'server.example',
                'VERSION',
                'Kiwi IRC test-version'
            );
        });
    });

    it('consumes automatic CLIENTINFO and RELAYMETA responses', () => {
        jest.useFakeTimers();

        try {
            let relayed = s.addUser(network.id, { nick: 'relayuser' });
            s.addUser(network.id, { nick: 'DiscordBot' });
            let channel = s.addBuffer(network.id, '#test');
            channel.joined = true;
            client.ctcpRequest = jest.fn();

            dispatchCtcp('message', {
                type: 'privmsg',
                nick: 'relayuser',
                target: '#test',
                message: 'hello',
                time: Date.now(),
                tags: { 'draft/relaymsg': 'DiscordBot' },
            });

            expect(client.ctcpRequest).not.toHaveBeenCalled();
            jest.advanceTimersByTime(PUMP_MS);
            expect(client.ctcpRequest).toHaveBeenCalledWith('DiscordBot', 'CLIENTINFO');

            dispatchCtcp('ctcp response', {
                nick: 'DiscordBot',
                type: 'CLIENTINFO',
                message: 'CLIENTINFO ACTION RELAYMETA VERSION',
                target: 'TestNick',
                time: Date.now(),
                tags: {},
            });
            expect(network.serverBuffer().getMessages()).toHaveLength(0);

            jest.advanceTimersByTime(PUMP_MS);
            expect(client.ctcpRequest).toHaveBeenCalledWith(
                'DiscordBot',
                'RELAYMETA',
                'GET',
                'relayuser',
                'avatar',
                'display-name',
                'bot',
                'color'
            );

            dispatchCtcp('ctcp response', {
                nick: 'DiscordBot',
                type: 'RELAYMETA',
                message: 'RELAYMETA DATA relayuser display-name=Some\\sOne',
                target: 'TestNick',
                time: Date.now(),
                tags: {},
            });
            expect(network.serverBuffer().getMessages()).toHaveLength(0);
            expect(relayed.metadata['display-name']).toBe('Some One');

            const notifications = jest.fn();
            const titleFlashes = jest.fn();
            s.$on('notification.show', notifications);
            s.$on('notification.title', titleFlashes);

            dispatchCtcp('ctcp response', {
                nick: 'DiscordBot',
                type: 'RELAYMETA',
                message: 'RELAYMETA ERR relayuser UNKNOWN_TARGET',
                target: 'TestNick',
                time: Date.now(),
                tags: {},
            });
            expect(network.serverBuffer().getMessages()).toHaveLength(0);
            expect(notifications).not.toHaveBeenCalled();
            expect(titleFlashes).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });
});
