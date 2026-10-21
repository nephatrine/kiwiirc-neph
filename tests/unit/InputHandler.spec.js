import InputHandler from '@/libs/InputHandler';

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
