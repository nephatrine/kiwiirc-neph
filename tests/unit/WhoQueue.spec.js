import EventEmitter from 'eventemitter3';
import WhoQueue from '@/libs/WhoQueue';

class FakeClient extends EventEmitter {
    constructor({ whox = false } = {}) {
        super();
        this.raw = jest.fn();
        this.network = {
            supports: jest.fn((name) => (name === 'whox' ? whox : false)),
        };
        this.whox_token = {
            next: jest.fn(() => 7),
        };
    }
}

describe('WhoQueue', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('sends one WHO at a time and throttles the next', () => {
        const client = new FakeClient();
        const queue = new WhoQueue(client, {
            throttleMs: 1000,
            rateLimitMs: 5000,
        });

        queue.who('one');
        queue.who('two');

        expect(client.raw).toHaveBeenCalledTimes(1);
        expect(client.raw).toHaveBeenCalledWith('WHO', 'one');

        client.emit('wholist', { target: 'one', users: [] });
        jest.advanceTimersByTime(1000);

        expect(client.raw).toHaveBeenCalledTimes(2);
        expect(client.raw).toHaveBeenLastCalledWith('WHO', 'two');
    });

    it('deduplicates queued targets', () => {
        const client = new FakeClient();
        const queue = new WhoQueue(client, {
            throttleMs: 1000,
            rateLimitMs: 5000,
        });

        const first = jest.fn();
        const second = jest.fn();
        queue.who('one', first);
        queue.who('one', second);

        expect(client.raw).toHaveBeenCalledTimes(1);
        client.emit('wholist', { target: 'one', users: [{ nick: 'one' }] });

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledWith({
            target: 'one',
            users: [{ nick: 'one' }],
        });
    });

    it('backs off after a rate limit and continues the queue', () => {
        const client = new FakeClient();
        const queue = new WhoQueue(client, {
            throttleMs: 1000,
            rateLimitMs: 5000,
        });

        const cb = jest.fn();
        queue.who('one', cb);
        queue.who('two');

        queue.handleRateLimit();
        expect(cb).toHaveBeenCalledWith({ target: 'one', users: [] });
        expect(client.raw).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(4999);
        expect(client.raw).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(1);
        expect(client.raw).toHaveBeenCalledTimes(2);
        expect(client.raw).toHaveBeenLastCalledWith('WHO', 'two');
    });

    it('uses WHOX when the network supports it', () => {
        const client = new FakeClient({ whox: true });
        const queue = new WhoQueue(client);

        queue.who('one');

        expect(client.whox_token.next).toHaveBeenCalled();
        expect(client.raw).toHaveBeenCalledWith(
            'WHO',
            'one',
            '%tcuhsnfdaor,7'
        );
    });

    it('resets on reconnect', () => {
        const client = new FakeClient();
        const queue = new WhoQueue(client, {
            throttleMs: 1000,
            rateLimitMs: 5000,
        });

        queue.who('one');
        client.emit('connecting');
        jest.advanceTimersByTime(5000);

        expect(client.raw).toHaveBeenCalledTimes(1);

        queue.who('two');
        expect(client.raw).toHaveBeenCalledTimes(2);
        expect(client.raw).toHaveBeenLastCalledWith('WHO', 'two');
    });
});
