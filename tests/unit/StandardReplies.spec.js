import { handleStandardReply } from '@/libs/IrcClient';

function harness() {
    let added = [];
    let serverBuffer = { name: '*server' };
    let state = {
        revertPendingLabel: jest.fn().mockReturnValue(false),
        revertPendingHeuristic: jest.fn().mockReturnValue(false),
        addMessage: jest.fn((buffer, message) => {
            added.push({ buffer, message });
        }),
    };
    let network = {
        id: 1,
        active_outgoing_batches: new Map(),
        bufferByName: jest.fn().mockReturnValue(null),
        serverBuffer: jest.fn().mockReturnValue(serverBuffer),
    };
    return { added, serverBuffer, state, network };
}

describe('handleStandardReply', () => {
    test('FAIL METADATA INVALID_TARGET names the target', () => {
        let h = harness();
        handleStandardReply('FAIL', {
            params: ['METADATA', 'INVALID_TARGET', 'x2Tuff4Ux/bridged', ''],
            tags: {},
        }, h.network, h.state);
        expect(h.added.length).toBe(1);
        expect(h.added[0].buffer).toBe(h.serverBuffer);
        expect(h.added[0].message.message).toBe(
            'FAIL METADATA x2Tuff4Ux/bridged (INVALID_TARGET)'
        );
        expect(h.added[0].message.type).toBe('error');
    });

    test('FAIL METADATA KEY_NOT_SET names the target and key', () => {
        let h = harness();
        handleStandardReply('FAIL', {
            params: ['METADATA', 'KEY_NOT_SET', 'SomeNick', 'avatar', ''],
            tags: {},
        }, h.network, h.state);
        expect(h.added[0].message.message).toBe(
            'FAIL METADATA SomeNick avatar (KEY_NOT_SET)'
        );
    });

    test('a server description wins over the formatted fallback', () => {
        let h = harness();
        handleStandardReply('FAIL', {
            params: ['METADATA', 'INVALID_TARGET', 'x2Tuff4Ux/bridged', 'No such nick'],
            tags: {},
        }, h.network, h.state);
        expect(h.added[0].message.message).toBe('No such nick');
    });
});
