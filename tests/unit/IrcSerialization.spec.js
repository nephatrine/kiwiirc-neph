import Irc from 'irc-framework';
import state from '@/libs/state';
import {
    buildOutgoingMessage,
    serializeOutgoingMessage
} from '@/helpers/IrcSerialization';

describe('outgoing IRC serialization', () => {
    test('keeps an explicitly empty final raw argument', () => {
        const message = buildOutgoingMessage(Irc, ['KICK', '#test', 'Other', '']);

        expect(message.params).toEqual(['#test', 'Other', '']);
        expect(serializeOutgoingMessage(message)).toBe('KICK #test Other :');
    });

    test('keeps an empty final parameter from a raw line', () => {
        const message = buildOutgoingMessage(Irc, ['TOPIC #test :']);

        expect(serializeOutgoingMessage(message)).toBe('TOPIC #test :');
    });

    test('keeps an empty final parameter on message objects', () => {
        const message = new Irc.Message('TOPIC', '#test', '');

        expect(serializeOutgoingMessage(message)).toBe('TOPIC #test :');
    });

    test('does not add an empty parameter when none was supplied', () => {
        const message = buildOutgoingMessage(Irc, ['AWAY']);

        expect(serializeOutgoingMessage(message)).toBe('AWAY');
    });

    test('serializes ordinary trailing parameters unchanged', () => {
        const message = buildOutgoingMessage(Irc, ['PRIVMSG', '#test', 'hello world']);

        expect(serializeOutgoingMessage(message)).toBe('PRIVMSG #test :hello world');
    });

    test('keeps tags when serializing an empty trailing parameter', () => {
        const message = new Irc.Message('PRIVMSG', '#test', '');
        message.tags.label = 'abc';

        expect(serializeOutgoingMessage(message)).toBe('@label=abc PRIVMSG #test :');
    });
});

describe('IrcClient raw wrapper', () => {
    let client;
    let write;

    beforeEach(() => {
        const appState = state.create();
        const network = appState.addNetwork('TestNetwork', 'TestNick', {});
        client = network.ircClient;
        write = jest.fn();
        client.connection.write = write;
    });

    test('keeps an explicitly empty final argument on the wire', () => {
        client.raw('KICK', '#test', 'Other', '');

        expect(write).toHaveBeenCalledWith('KICK #test Other :');
    });

    test('keeps an empty topic from a raw line on the wire', () => {
        client.raw('TOPIC #test :');

        expect(write).toHaveBeenCalledWith('TOPIC #test :');
    });

    test('does not add a trailing colon when no argument was given', () => {
        client.raw('AWAY');

        expect(write).toHaveBeenCalledWith('AWAY');
    });
});
