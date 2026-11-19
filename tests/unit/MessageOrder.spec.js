import state from '@/libs/state';
import {
    compareMessages,
    insertMessageInOrder,
    messageNeedsSort,
    orderedMessages
} from '@/libs/bufferTools';

describe('message ordering', () => {
    test('compares messages and reports sort requirements', () => {
        expect(compareMessages(
            { time: 100, instance_num: 1 },
            { time: 200, instance_num: 2 }
        )).toBe(-1);
        expect(compareMessages(
            { time: 200, instance_num: 2 },
            { time: 100, instance_num: 1 }
        )).toBe(1);
        expect(compareMessages(
            { time: 100, instance_num: 2 },
            { time: 100, instance_num: 1 }
        )).toBe(1);
        expect(compareMessages(
            { time: 100, instance_num: 1 },
            { time: 100, instance_num: 1 }
        )).toBe(0);

        const previous = { time: 200, instance_num: 10 };

        expect(messageNeedsSort(previous, { time: 201, instance_num: 11 })).toBe(false);
        expect(messageNeedsSort(previous, { time: 200, instance_num: 11 })).toBe(false);
        expect(messageNeedsSort(previous, { time: 199, instance_num: 12 })).toBe(true);
        expect(messageNeedsSort(previous, { time: 200, instance_num: 9 })).toBe(true);
        expect(messageNeedsSort(null, { time: 1, instance_num: 1 })).toBe(false);
    });

    test('inserts late messages in chronological order', () => {
        const messages = [
            { time: 100, instance_num: 1 },
            { time: 300, instance_num: 3 },
        ];

        insertMessageInOrder(messages, { time: 200, instance_num: 2 });
        insertMessageInOrder(messages, { time: 400, instance_num: 4 });
        insertMessageInOrder(messages, { time: 100, instance_num: 0 });

        expect(messages.map((message) => message.time)).toEqual([100, 100, 200, 300, 400]);
        expect(messages.map((message) => message.instance_num)).toEqual([0, 1, 2, 3, 4]);

        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#channel');

        s.addMessage(buffer, {
            time: 300,
            nick: 'alice',
            message: 'third',
            type: 'privmsg',
        });
        s.addMessage(buffer, {
            time: 100,
            nick: 'alice',
            message: 'first',
            type: 'privmsg',
        });
        s.addMessage(buffer, {
            time: 400,
            nick: 'alice',
            message: 'fourth',
            type: 'privmsg',
        });

        expect(buffer.getMessages().map((message) => message.message)).toEqual([
            'first',
            'third',
            'fourth',
        ]);
        s.$destroy();
    });

    test('shows ignored users in queries but hides them in channels', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const alice = s.addUser(network.id, { nick: 'Alice' });
        alice.ignore = true;
        const channel = s.addBuffer(network.id, '#channel');
        const query = s.addBuffer(network.id, 'Alice');

        s.addMessage(channel, {
            time: 100,
            nick: 'Alice',
            message: 'channel message',
            type: 'privmsg',
        });
        s.addMessage(query, {
            time: 200,
            nick: 'Alice',
            message: 'query message',
            type: 'privmsg',
        });

        expect(orderedMessages(channel)).toEqual([]);
        expect(orderedMessages(query).map((message) => message.message))
            .toEqual(['query message']);
        s.$destroy();
    });
});
