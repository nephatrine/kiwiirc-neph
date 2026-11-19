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
    function makeClient() {
        const appState = state.create();
        const network = appState.addNetwork('TestNetwork', 'TestNick', {});
        network.enabled_caps = ['draft/multiline'];
        const client = network.ircClient;
        client.raw = jest.fn();
        return client;
    }

    test('uses multiline for long emoji messages by byte length', () => {
        let client = makeClient();
        const emoji = '😀';
        let message = emoji.repeat(100);
        client.say('#channel', message);

        expect(hasBatchStart(client)).toBe(true);
        let chunks = sentChunks(client);
        expect(chunks.join('')).toBe(message);
        chunks.forEach((chunk) => {
            expect(chunk.split(emoji).join('')).toBe('');
        });

        client = makeClient();
        const family = '👨‍👩‍👧‍👦';
        message = family.repeat(20);
        client.say('#channel', message);

        expect(hasBatchStart(client)).toBe(true);
        chunks = sentChunks(client);
        expect(chunks.join('')).toBe(message);
        chunks.forEach((chunk) => {
            expect(chunk.split(family).join('')).toBe('');
        });
    });

    test('keeps short messages out of multiline batches', () => {
        const client = makeClient();
        client.say('#channel', 'hello');

        expect(hasBatchStart(client)).toBe(false);
    });
});
