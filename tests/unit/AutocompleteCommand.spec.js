jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key) => key),
    };
});

import state from '@/libs/state';
import InputHandler from '@/libs/InputHandler';

describe('InputHandler /auto', () => {
    let s;
    let network;
    let buffer;
    let handler;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.net',
        });
        network.nick = 'TestNick';
        network.state = 'connected';
        network.enabled_caps = ['message-tags'];
        buffer = s.addBuffer(network.id, '#test');
        handler = new InputHandler(s);
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('strips the /auto prefix, sends in queries, and toggles on bare /auto', () => {
        handler.processLine('/auto SupyBot: foo', { network, buffer });

        expect(network.ircClient.say).toHaveBeenCalledWith(
            '#test',
            'SupyBot: foo',
            {}
        );

        const query = s.addBuffer(network.id, 'SupyBot');
        network.ircClient.say.mockClear();

        handler.processLine('/auto !discord role', { network, buffer: query });

        expect(network.ircClient.say).toHaveBeenCalledWith(
            'SupyBot',
            '!discord role',
            {}
        );

        const emit = jest.spyOn(s, '$emit');
        network.ircClient.say.mockClear();

        handler.processLine('/auto', { network, buffer });

        expect(emit).toHaveBeenCalledWith('autocomplete.toggle', {
            network,
            buffer,
        });
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });

    test('errors when autocomplete requests are unavailable or denied', () => {
        network.enabled_caps = [];
        let addMessage = jest.spyOn(s, 'addMessage');

        handler.processLine('/auto SupyBot: foo', { network, buffer });

        let error = addMessage.mock.calls.find((call) => call[1].type === 'error');
        expect(error).toBeTruthy();
        expect(network.ircClient.say).not.toHaveBeenCalled();

        network.enabled_caps = ['message-tags'];
        network.isupport.CLIENTTAGDENY = ['*'];
        addMessage = jest.spyOn(s, 'addMessage');

        handler.processLine('/auto SupyBot: foo', { network, buffer });

        error = addMessage.mock.calls.find((call) => call[1].type === 'error');
        expect(error).toBeTruthy();
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });
});
