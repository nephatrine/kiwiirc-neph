import MessageList from '@/components/MessageList';
import state from '@/libs/state';

describe('global simple markdown', () => {
    let s;

    beforeEach(() => {
        s = state.create();
    });

    afterEach(() => {
        s.$destroy();
    });

    test('uses the global setting instead of a buffer override', () => {
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#test');
        buffer.setting('extra_formatting', false);
        s.setting('buffers.extra_formatting', true);

        expect(MessageList.computed.useExtraFormatting.call({
            $state: s,
            buffer,
        })).toBe(true);

        s.setting('buffers.extra_formatting', false);

        expect(MessageList.computed.useExtraFormatting.call({
            $state: s,
            buffer,
        })).toBe(false);
    });
});
