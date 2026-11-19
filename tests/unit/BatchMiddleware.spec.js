import EventEmitter from 'eventemitter3';
import batchMiddleware from '@/libs/BatchMiddleware';

describe('BatchMiddleware reconnect cleanup', () => {
    function setup() {
        const client = new EventEmitter();
        const network = {
            active_outgoing_batches: new Map([['outgoing', {}]]),
        };
        batchMiddleware(network)(client, { use: jest.fn() }, { use: jest.fn() });
        return { client, network };
    }

    test('clears active batches when connecting and when the client closes', () => {
        let { client, network } = setup();
        client.active_batches.set('incoming', {});

        client.emit('connecting');

        expect(client.active_batches.size).toBe(0);
        expect(network.active_outgoing_batches.size).toBe(0);

        ({ client, network } = setup());
        client.active_batches.set('incoming', {});

        client.emit('close');

        expect(client.active_batches.size).toBe(0);
        expect(network.active_outgoing_batches.size).toBe(0);
    });
});

describe('BatchMiddleware nested chathistory', () => {
    function setup() {
        const client = new EventEmitter();
        const network = {
            active_outgoing_batches: new Map(),
        };
        let rawHandler = null;
        client.command_handler = { dispatch: jest.fn() };
        client.chathistory = {
            batchCallbacks: { resolve: jest.fn() },
        };
        batchMiddleware(network)(client, {
            use(handler) {
                rawHandler = handler;
            },
        }, { use: jest.fn() });

        const feed = (command, message) => {
            rawHandler(command, message, '', client, () => {});
        };

        return { client, feed };
    }

    test('keeps chathistory metadata through a labeled-response parent', () => {
        const { client, feed } = setup();

        feed('BATCH', {
            command: 'BATCH',
            params: ['+1', 'labeled-response'],
            tags: {},
        });
        feed('BATCH', {
            command: 'BATCH',
            params: ['+2', 'chathistory', '#channel'],
            tags: { label: 'history-label' },
        });
        feed('PRIVMSG', {
            command: 'PRIVMSG',
            params: ['#channel', 'replayed message'],
            tags: { batch: '2', msgid: 'abc' },
            nick: 'alice',
        });
        feed('BATCH', {
            command: 'BATCH',
            params: ['-2'],
            tags: {},
        });

        expect(client.chathistory.batchCallbacks.resolve).toHaveBeenCalled();
        expect(client.command_handler.dispatch).toHaveBeenCalledTimes(1);

        feed('BATCH', {
            command: 'BATCH',
            params: ['-1'],
            tags: {},
        });

        expect(client.command_handler.dispatch).toHaveBeenCalledTimes(1);

        const dispatched = client.command_handler.dispatch.mock.calls[0][0];
        expect(dispatched.tags['kiwi-history']).toBe(true);
        expect(dispatched.tags['kiwi-history-target']).toBe('#channel');
        expect(dispatched.batch).toEqual({
            type: 'chathistory',
            id: '2',
            params: ['#channel'],
        });
    });
});
