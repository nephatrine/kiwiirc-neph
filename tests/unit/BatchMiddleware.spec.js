import EventEmitter from 'eventemitter3';
import batchMiddleware from '@/libs/BatchMiddleware';

function createClient() {
    return new EventEmitter();
}

describe('BatchMiddleware reconnect cleanup', () => {
    let client;
    let network;

    beforeEach(() => {
        client = createClient();
        network = {
            active_outgoing_batches: new Map([['outgoing', {}]]),
        };
        batchMiddleware(network)(client, { use: jest.fn() }, { use: jest.fn() });
    });

    test('clears active batches when connecting', () => {
        client.active_batches.set('incoming', {});

        client.emit('connecting');

        expect(client.active_batches.size).toBe(0);
        expect(network.active_outgoing_batches.size).toBe(0);
    });

    test('clears active batches when the client closes', () => {
        client.active_batches.set('incoming', {});

        client.emit('close');

        expect(client.active_batches.size).toBe(0);
        expect(network.active_outgoing_batches.size).toBe(0);
    });
});
