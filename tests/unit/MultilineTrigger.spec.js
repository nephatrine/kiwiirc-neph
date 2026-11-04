import { TextEncoder } from 'util';
import state from '@/libs/state';

if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}

function sentChunks(client) {
    return client.raw.mock.calls
        .map(([message]) => message)
        .filter((message) => message && message.command === 'PRIVMSG')
        .map((message) => message.params[1]);
}

function hasBatchStart(client) {
    return client.raw.mock.calls.some(([message]) => (
        message && message.command === 'BATCH'
    ));
}

describe('outgoing multiline trigger', () => {
    let network;
    let client;

    beforeEach(() => {
        const appState = state.create();
        network = appState.addNetwork('TestNetwork', 'TestNick', {});
        network.enabled_caps = ['draft/multiline'];
        client = network.ircClient;
        client.raw = jest.fn();
    });

    test('uses multiline for a long emoji message by byte length', () => {
        const message = '😀'.repeat(100);
        client.say('#channel', message);

        expect(hasBatchStart(client)).toBe(true);
        const chunks = sentChunks(client);
        expect(chunks.join('')).toBe(message);
        chunks.forEach((chunk) => {
            expect(chunk.split('😀').join('')).toBe('');
        });
    });

    test('uses multiline for a long ZWJ sequence by byte length', () => {
        const family = '👨‍👩‍👧‍👦';
        const message = family.repeat(20);
        client.say('#channel', message);

        expect(hasBatchStart(client)).toBe(true);
        const chunks = sentChunks(client);
        expect(chunks.join('')).toBe(message);
        chunks.forEach((chunk) => {
            expect(chunk.split(family).join('')).toBe('');
        });
    });

    test('keeps short messages out of multiline batches', () => {
        client.say('#channel', 'hello');

        expect(hasBatchStart(client)).toBe(false);
    });
});
