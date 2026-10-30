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
            target: 'TestNick',
            time: Date.now(),
            tags: {},
        });

        let message = lastServerMessage();
        expect(message.type).toBe('ctcp');
        expect(message.message).toContain('[CTCP Other]');
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
                'display-name'
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
        } finally {
            jest.useRealTimers();
        }
    });
});
