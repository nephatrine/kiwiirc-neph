import { TextEncoder } from 'util';
import InputHandler from '@/libs/InputHandler';
import * as TextFormatting from '@/helpers/TextFormatting';

// jsdom lacks TextEncoder, which the advertised byte-limit checks use.
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}

function makeHandler() {
    const state = {
        setting: jest.fn(() => ''),
        $watch: jest.fn(),
        $on: jest.fn(),
        $emit: jest.fn(),
    };
    return new InputHandler(state);
}

function makeContext(isChannel = true) {
    const user = {
        nick: 'streamer',
        metadata: {
            'display-name': 'Streamer',
            'color': '#9146ff',
            'user-id': '12345',
        },
        displayName: jest.fn(() => 'Streamer'),
    };
    const network = {
        name: 'twitch',
        nick: 'streamer',
        connection: {
            server: 'irc.chat.twitch.tv',
        },
        currentUser: jest.fn(() => user),
        ensureTwitchUser: jest.fn(),
        isChannelName: jest.fn(() => isChannel),
        ircClient: {
            raw: jest.fn(),
        },
        appState: {
            addMessage: jest.fn((buffer, message) => message),
            $emit: jest.fn(),
        },
    };
    const buffer = {
        name: '#channel',
        isChannel: jest.fn(() => isChannel),
    };

    return { network, buffer, user };
}

describe('InputHandler /fakesub', () => {
    it('adds a fake subscription notice to a channel', () => {
        const handler = makeHandler();
        const { network, buffer } = makeContext();

        handler.processLine('/fakesub Hello there', { network, buffer });

        expect(network.ircClient.raw).not.toHaveBeenCalled();
        expect(network.ensureTwitchUser).toHaveBeenCalledWith(
            'streamer',
            'streamer',
            '',
            expect.objectContaining({
                'msg-id': 'resub',
                'login': 'streamer',
                'display-name': 'Streamer',
            })
        );
        expect(network.appState.addMessage).toHaveBeenCalledTimes(1);

        const [targetBuffer, message] = network.appState.addMessage.mock.calls[0];
        expect(targetBuffer).toBe(buffer);
        expect(message).toEqual(expect.objectContaining({
            type: 'twitch_usernotice',
            type_extra: 'resub',
            nick: 'streamer',
            raw_text: 'Hello there',
        }));
        expect(message.tags['msg-param-sub-plan']).toBe('1000');
        expect(message.tags['msg-param-cumulative-months']).toBe('12');
        expect(message.tags['msg-param-streak-months']).toBe('3');
        expect(message.tags['subscriber']).toBe('1');
        expect(message.irc_id).toBeTruthy();
    });

    it('uses a default body when no message is given', () => {
        const handler = makeHandler();
        const { network, buffer } = makeContext();

        handler.processLine('/fakesub', { network, buffer });

        const message = network.appState.addMessage.mock.calls[0][1];
        expect(message.raw_text).toBe('Nice stream!');
    });

    it('does nothing outside a channel', () => {
        const handler = makeHandler();
        const { network, buffer } = makeContext(false);

        handler.processLine('/fakesub Hello', { network, buffer });

        expect(network.appState.addMessage).not.toHaveBeenCalled();
        expect(network.ircClient.raw).not.toHaveBeenCalled();
    });
});

describe('InputHandler advertised limits', () => {
    let tSpy;

    beforeEach(() => {
        tSpy = jest.spyOn(TextFormatting, 't').mockImplementation((key) => key);
    });

    afterEach(() => {
        tSpy.mockRestore();
    });

    function makeLimitContext(limits = {}) {
        const state = {
            setting: jest.fn(() => ''),
            $watch: jest.fn(),
            $on: jest.fn(),
            $emit: jest.fn(),
            addMessage: jest.fn(),
            addBuffer: jest.fn((networkid, name) => ({ name, key: '' })),
            setActiveBuffer: jest.fn(),
        };
        const network = {
            id: 1,
            nick: 'TestNick',
            name: 'TestNetwork',
            connection: { server: 'irc.example.com' },
            isupportLimit: jest.fn((name) => limits[name] || 0),
            isChannelName: jest.fn((name) => /^[#&]/.test(name)),
            ircClient: {
                join: jest.fn(),
                setTopic: jest.fn(),
                raw: jest.fn(),
                changeNick: jest.fn(),
            },
        };
        const buffer = {
            name: '#test',
            key: '',
            isChannel: jest.fn(() => true),
            isServer: jest.fn(() => false),
        };
        const handler = new InputHandler(state);

        return { handler, state, network, buffer };
    }

    it('rejects a channel name over CHANNELLEN by byte count', () => {
        const { handler, state, network, buffer } =
            makeLimitContext({ CHANNELLEN: 4 });

        handler.processLine('/join #éé', { network, buffer });

        expect(network.ircClient.join).not.toHaveBeenCalled();
        expect(state.addBuffer).not.toHaveBeenCalled();
        expect(state.addMessage).toHaveBeenCalledWith(
            buffer,
            expect.objectContaining({
                type: 'error',
                message: 'error_channel_too_long',
            })
        );
        expect(tSpy).toHaveBeenCalledWith('error_channel_too_long', {
            current: 5,
            max: 4,
        });
    });

    it('allows a channel name at CHANNELLEN', () => {
        const { handler, state, network, buffer } =
            makeLimitContext({ CHANNELLEN: 5 });

        handler.processLine('/join #éé', { network, buffer });

        expect(network.ircClient.join).toHaveBeenCalledWith('#éé', '');
        expect(state.addMessage).not.toHaveBeenCalled();
    });

    it('rejects a topic over TOPICLEN', () => {
        const { handler, state, network, buffer } =
            makeLimitContext({ TOPICLEN: 3 });

        handler.processLine('/topic éé', { network, buffer });

        expect(network.ircClient.setTopic).not.toHaveBeenCalled();
        expect(state.addMessage).toHaveBeenCalledWith(
            buffer,
            expect.objectContaining({
                type: 'error',
                message: 'error_topic_too_long',
            })
        );
    });

    it('rejects a kick reason over KICKLEN', () => {
        const { handler, state, network, buffer } =
            makeLimitContext({ KICKLEN: 3 });

        handler.processLine('/kick Other éé', { network, buffer });

        expect(network.ircClient.raw).not.toHaveBeenCalled();
        expect(state.addMessage).toHaveBeenCalledWith(
            buffer,
            expect.objectContaining({
                type: 'error',
                message: 'error_kick_reason_too_long',
            })
        );
    });

    it('rejects an away message over AWAYLEN', () => {
        const { handler, state, network, buffer } =
            makeLimitContext({ AWAYLEN: 3 });

        handler.processLine('/away éé', { network, buffer });

        expect(network.ircClient.raw).not.toHaveBeenCalled();
        expect(state.addMessage).toHaveBeenCalledWith(
            buffer,
            expect.objectContaining({
                type: 'error',
                message: 'error_away_too_long',
            })
        );
    });

    it('rejects a nickname over NICKLEN', () => {
        const { handler, state, network, buffer } =
            makeLimitContext({ NICKLEN: 3 });

        handler.processLine('/nick éé', { network, buffer });

        expect(network.ircClient.changeNick).not.toHaveBeenCalled();
        expect(state.addMessage).toHaveBeenCalledWith(
            buffer,
            expect.objectContaining({
                type: 'error',
                message: 'error_nick_too_long',
            })
        );
    });
});
