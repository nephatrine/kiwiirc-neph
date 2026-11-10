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

    test('strips the /auto prefix and sends the remainder', () => {
        handler.processLine('/auto SupyBot: foo', { network, buffer });

        expect(network.ircClient.say).toHaveBeenCalledWith(
            '#test',
            'SupyBot: foo',
            {}
        );
    });

    test('toggles always-auto mode with a bare /auto', () => {
        const emit = jest.spyOn(s, '$emit');

        handler.processLine('/auto', { network, buffer });

        expect(emit).toHaveBeenCalledWith('autocomplete.toggle', {
            network,
            buffer,
        });
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });

    test('sends the remainder unchanged in a query', () => {
        const query = s.addBuffer(network.id, 'SupyBot');

        handler.processLine('/auto !discord role', { network, buffer: query });

        expect(network.ircClient.say).toHaveBeenCalledWith(
            'SupyBot',
            '!discord role',
            {}
        );
    });

    test('errors when autocomplete requests are unavailable', () => {
        network.enabled_caps = [];
        const addMessage = jest.spyOn(s, 'addMessage');

        handler.processLine('/auto SupyBot: foo', { network, buffer });

        const error = addMessage.mock.calls.find((call) => call[1].type === 'error');
        expect(error).toBeTruthy();
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });

    test('errors when the autocomplete request tag is denied', () => {
        network.isupport.CLIENTTAGDENY = ['*'];
        const addMessage = jest.spyOn(s, 'addMessage');

        handler.processLine('/auto SupyBot: foo', { network, buffer });

        const error = addMessage.mock.calls.find((call) => call[1].type === 'error');
        expect(error).toBeTruthy();
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });
});
