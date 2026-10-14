import state from '@/libs/state';

describe('raw buffer scrollback', () => {
    let s;
    let network;
    let raw;
    let channel;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        raw = s.addBuffer(network.id, '*raw');
        channel = s.addBuffer(network.id, '#chan');
    });

    it('defaults the raw buffer to 500 lines', () => {
        expect(raw.setting('scrollback_size')).toBe(500);
    });

    it('uses the network raw_scrollback_size for the raw buffer', () => {
        network.setting('raw_scrollback_size', 5000);
        expect(raw.setting('scrollback_size')).toBe(5000);
    });

    it('prefers a per-buffer override over the network value', () => {
        network.setting('raw_scrollback_size', 5000);
        raw.setting('scrollback_size', 100);
        expect(raw.setting('scrollback_size')).toBe(100);
    });

    it('does not apply the network value to normal buffers', () => {
        network.setting('raw_scrollback_size', 5000);
        expect(channel.setting('scrollback_size')).toBe(s.setting('buffers.scrollback_size'));
    });
});
