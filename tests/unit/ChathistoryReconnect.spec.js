import EventEmitter from 'eventemitter3';
import chathistoryMiddleware from '@/libs/ChathistoryMiddleware';

function createClient() {
    const client = new EventEmitter();
    client.raw = jest.fn();
    client.Message = class Message {
        constructor(command, ...params) {
            this.command = command;
            this.params = params;
            this.tags = {};
        }
    };
    return client;
}

function createNetwork() {
    return {
        caseUpper(value) {
            return String(value).toUpperCase();
        },
        caseLower(value) {
            return String(value).toLowerCase();
        },
        hasCap(cap) {
            return cap === 'draft/chathistory';
        },
        supports(key) {
            if (key === 'CHATHISTORY') {
                return '50';
            }
            if (key === 'MSGREFTYPES') {
                return 'msgid,timestamp';
            }
            return '';
        },
    };
}

describe('chathistory reconnect cleanup', () => {
    let client;

    beforeEach(() => {
        client = createClient();
        chathistoryMiddleware(createNetwork())(client, {}, { use: jest.fn() });
    });

    it('resolves pending requests and clears the queue on socket close', async() => {
        const first = client.chathistory.latest('#test', '*');
        const second = client.chathistory.latest('#test', '*');

        expect(client.raw).toHaveBeenCalledTimes(1);

        client.emit('socket close');

        await expect(first).resolves.toMatchObject({
            error: 'disconnected',
            silent: true,
        });
        await expect(second).resolves.toMatchObject({
            error: 'disconnected',
            silent: true,
        });

        client.chathistory.latest('#test', '*');

        expect(client.raw).toHaveBeenCalledTimes(2);
    });

    it('clears stale requests when a new connection starts', async() => {
        const request = client.chathistory.latest('#test', '*');

        client.emit('connecting');

        await expect(request).resolves.toMatchObject({
            error: 'disconnected',
            silent: true,
        });

        client.chathistory.latest('#test', '*');

        expect(client.raw).toHaveBeenCalledTimes(2);
    });
});
