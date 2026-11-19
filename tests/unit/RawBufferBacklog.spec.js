import state from '@/libs/state';

function rawMessage(index) {
    return {
        time: Date.now() + index,
        nick: '',
        message: '[S] line ' + index,
    };
}

describe('raw buffer backlog', () => {
    let s;
    let network;
    let raw;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        raw = s.addBuffer(network.id, '*raw');
    });

    afterEach(() => {
        s.$destroy();
    });

    test('keeps hidden raw lines until opened and caps the backlog', () => {
        raw.queueRawMessage(rawMessage(1));
        raw.queueRawMessage(rawMessage(2));

        expect(raw.getMessages()).toHaveLength(0);
        expect(raw.rawBacklog).toHaveLength(2);

        raw.isVisible = true;

        expect(raw.rawBacklog).toHaveLength(0);
        expect(raw.getMessages()).toHaveLength(2);
        expect(raw.getMessages()[0].message).toBe('[S] line 1');
        expect(raw.getMessages()[1].message).toBe('[S] line 2');

        raw.isVisible = false;
        raw.setting('scrollback_size', 2);
        raw.queueRawMessage(rawMessage(1));
        raw.queueRawMessage(rawMessage(2));
        raw.queueRawMessage(rawMessage(3));

        expect(raw.rawBacklog).toHaveLength(2);
        expect(raw.rawBacklog[0].message).toBe('[S] line 2');
        expect(raw.rawBacklog[1].message).toBe('[S] line 3');
    });
});
