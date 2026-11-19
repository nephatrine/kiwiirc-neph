import Irc from 'irc-framework';
import state from '@/libs/state';
import {
    buildOutgoingMessage,
    serializeOutgoingMessage
} from '@/helpers/IrcSerialization';

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
