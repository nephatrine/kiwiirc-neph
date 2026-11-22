import Irc from 'irc-framework';
import GlobalApi from '@/libs/GlobalApi';
import state from '@/libs/state';
import { PUMP_MS } from '@/libs/RelayMeta';
import { throttlePingTimeoutReset } from '@/libs/IrcClient';
import {
    buildOutgoingMessage,
    serializeOutgoingMessage
} from '@/helpers/IrcSerialization';

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

        const message = lastServerMessage();
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

        const message = lastServerMessage();
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
            const relayed = s.addUser(network.id, { nick: 'relayuser' });
            s.addUser(network.id, { nick: 'DiscordBot' });
            const channel = s.addBuffer(network.id, '#test');
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

describe('IRC ping timeout throttling', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('coalesces resets and wraps a newly assigned reset function', () => {
        const now = jest.spyOn(Date, 'now');
        now.mockReturnValue(1000);
        let original = jest.fn();
        let client = { resetPingTimeoutTimer: original };

        throttlePingTimeoutReset(client, 1000);
        const throttled = client.resetPingTimeoutTimer;

        throttled();
        throttled();
        expect(original).toHaveBeenCalledTimes(1);

        now.mockReturnValue(1999);
        throttled();
        expect(original).toHaveBeenCalledTimes(1);

        now.mockReturnValue(2000);
        throttled();
        expect(original).toHaveBeenCalledTimes(2);

        now.mockReturnValue(1000);
        original = jest.fn();
        client = { resetPingTimeoutTimer: original };

        throttlePingTimeoutReset(client, 1000);
        const firstWrapper = client.resetPingTimeoutTimer;

        const replacement = jest.fn();
        client.resetPingTimeoutTimer = replacement;
        throttlePingTimeoutReset(client, 1000);

        expect(client.resetPingTimeoutTimer).not.toBe(firstWrapper);
        client.resetPingTimeoutTimer();
        expect(replacement).toHaveBeenCalledTimes(1);
    });

    test('ignores clients without a reset function', () => {
        expect(() => throttlePingTimeoutReset(null)).not.toThrow();
        expect(() => throttlePingTimeoutReset({})).not.toThrow();
    });
});

describe('outgoing IRC serialization', () => {
    test('serializes empty trailing parameters, tags, and ordinary text', () => {
        let message = buildOutgoingMessage(Irc, ['KICK', '#test', 'Other', '']);
        expect(message.params).toEqual(['#test', 'Other', '']);
        expect(serializeOutgoingMessage(message)).toBe('KICK #test Other :');

        message = buildOutgoingMessage(Irc, ['TOPIC #test :']);
        expect(serializeOutgoingMessage(message)).toBe('TOPIC #test :');

        message = new Irc.Message('TOPIC', '#test', '');
        expect(serializeOutgoingMessage(message)).toBe('TOPIC #test :');

        message = buildOutgoingMessage(Irc, ['AWAY']);
        expect(serializeOutgoingMessage(message)).toBe('AWAY');

        message = buildOutgoingMessage(Irc, ['PRIVMSG', '#test', 'hello world']);
        expect(serializeOutgoingMessage(message)).toBe('PRIVMSG #test :hello world');

        message = new Irc.Message('PRIVMSG', '#test', '');
        message.tags.label = 'abc';
        expect(serializeOutgoingMessage(message)).toBe('@label=abc PRIVMSG #test :');
    });
});

describe('IrcClient raw wrapper', () => {
    test('keeps explicit empty trailing arguments and avoids extra colons', () => {
        const appState = state.create();
        const network = appState.addNetwork('TestNetwork', 'TestNick', {});
        const client = network.ircClient;
        const write = jest.fn();
        client.connection.write = write;

        client.raw('KICK', '#test', 'Other', '');
        expect(write).toHaveBeenCalledWith('KICK #test Other :');

        client.raw('TOPIC #test :');
        expect(write).toHaveBeenCalledWith('TOPIC #test :');

        client.raw('AWAY');
        expect(write).toHaveBeenCalledWith('AWAY');
    });
});

describe('IrcClient initial channels', () => {
    let s;
    let network;
    let client;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        network.connection.channels = '#one,#two key';
        client = network.ircClient;
        jest.spyOn(client, 'join').mockImplementation(() => {});
        jest.spyOn(client, 'who').mockImplementation(() => {});
        jest.spyOn(client, 'raw').mockImplementation(() => {});
        jest.spyOn(s, 'addMessage').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('creates and joins the configured initial channels on registration', async() => {
        const event = {
            command: 'registered',
            nick: 'TestNick',
            params: [],
        };
        await new Promise((resolve, reject) => {
            client.parsed_middleware.handle(
                ['registered', event, client],
                (err) => (err ? reject(err) : resolve())
            );
        });

        const one = s.getBufferByName(network.id, '#one');
        const two = s.getBufferByName(network.id, '#two');

        expect(one).toMatchObject({ joined: false, enabled: true, key: 'key' });
        expect(two).toMatchObject({ joined: false, enabled: true, key: '' });
        expect(client.join).toHaveBeenCalledWith('#one', 'key');
        expect(client.join).toHaveBeenCalledWith('#two', '');
    });
});

describe('IrcClient message filters', () => {
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

    afterEach(() => {
        const api = GlobalApi.singleton();
        api.incomingMessageFilters.length = 0;
        api.incomingTopicFilters.length = 0;
    });

    function dispatch(command, event) {
        client.parsed_middleware.handle([command, event, client], (err) => {
            if (err) {
                throw err;
            }
        });
    }

    function makeEvent(overrides) {
        return {
            nick: 'Other',
            ident: 'other',
            hostname: 'example.com',
            target: 'TestNick',
            type: 'privmsg',
            message: '+OK abc',
            time: Date.now(),
            tags: {},
            ...overrides,
        };
    }

    function lastMessage(buffer) {
        const messages = buffer.getMessages();
        return messages[messages.length - 1];
    }

    it('rewrites an incoming message body and keeps the wire text', () => {
        const api = GlobalApi.singleton();
        api.addIncomingMessageFilter((context) => (
            context.text === '+OK abc' ?
                { text: 'hello there ⚷', isEncrypted: true } :
                undefined
        ));

        dispatch('message', makeEvent());

        const buffer = s.getBufferByName(network.id, 'Other');
        const message = lastMessage(buffer);
        expect(message.message).toBe('hello there ⚷');
        expect(message.raw_text).toBe('+OK abc');
        expect(message.is_encrypted).toBe(true);
    });

    it('passes notice and action text through the filter', () => {
        const api = GlobalApi.singleton();
        const seen = [];
        api.addIncomingMessageFilter((context) => {
            seen.push(context.type);
            return { text: 'decrypted' };
        });

        dispatch('message', makeEvent({
            message: '\x01ACTION +OK abc\x01',
            type: 'action',
        }));

        expect(seen).toContain('action');
        const buffer = s.getBufferByName(network.id, 'Other');
        expect(lastMessage(buffer).message).toContain('decrypted');
    });

    it('tells filters whether the message is private', () => {
        const seen = [];
        GlobalApi.singleton().addIncomingMessageFilter((context) => {
            seen.push(context.isPrivate);
        });

        dispatch('message', makeEvent());
        dispatch('message', makeEvent({ target: '#test', nick: 'Other' }));

        expect(seen).toEqual([true, false]);
    });

    it('keeps the message when a filter throws', () => {
        const api = GlobalApi.singleton();
        api.addIncomingMessageFilter(() => {
            throw new Error('boom');
        });

        expect(() => dispatch('message', makeEvent({ message: 'plain' })))
            .not.toThrow();

        const buffer = s.getBufferByName(network.id, 'Other');
        expect(lastMessage(buffer).message).toBe('plain');
        expect(lastMessage(buffer).is_encrypted).toBe(false);
    });

    it('decrypts incoming topics through the topic filter', () => {
        const api = GlobalApi.singleton();
        api.addIncomingTopicFilter((topic) => (
            topic === '+OK topickey' ? 'the real topic' : undefined
        ));

        dispatch('topic', {
            channel: '#test',
            topic: '+OK topickey',
            time: Date.now(),
            tags: {},
        });

        const buffer = s.getBufferByName(network.id, '#test');
        expect(buffer.topic).toBe('the real topic');
        expect(lastMessage(buffer).message).toContain('the real topic');
    });
});
