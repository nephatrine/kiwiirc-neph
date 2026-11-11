import Vue from 'vue';
import state from '@/libs/state';
import MessageListMessageRaw from '@/components/MessageListMessageRaw';

describe('raw buffer messages', () => {
    let s;
    let network;
    let buffer;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        buffer = s.addBuffer(network.id, '*raw');
    });

    afterEach(() => {
        s.$destroy();
    });

    function addRawMessage(message) {
        s.addMessage(buffer, {
            time: Date.now(),
            nick: '',
            message,
        });
        return buffer.getMessages()[buffer.getMessages().length - 1];
    }

    test('keeps shortcodes, URLs, and other message content literal', () => {
        const message = addRawMessage(
            '[S] :smile: https://example.com/' + 'a'.repeat(120)
        );
        const html = message.toHtml({
            buffer,
            useExtraFormatting: true,
        });

        expect(message.blocks).toHaveLength(1);
        expect(message.blocks[0].type).toBe('raw');
        expect(message.blocks[0].content).toContain('[S] :smile:');
        expect(message.blocks[0].content).toContain('https://example.com/');
        expect(message.mentioned_urls).toEqual([]);
        expect(message.embed.payload).toBeNull();

        expect(html).toContain('[S] :smile:');
        expect(html).toContain('a'.repeat(120));
        expect(html).not.toContain('<a ');
        expect(html).not.toContain('kiwi-emoji');
        expect(html).not.toContain('...');
    });

    test('makes formatting control characters printable without applying them', () => {
        const message = addRawMessage('[S] \x02bold\x02 \x0304,1red');
        const html = message.toHtml({
            buffer,
            useExtraFormatting: true,
        });

        expect(message.blocks[0].content).toContain('␂bold␂');
        expect(message.blocks[0].content).toContain('␃04,1red');
        expect(html).toContain('␂bold␂');
        expect(html).toContain('␃04,1red');
        expect(html).not.toContain('font-weight:bold');
    });

    test('escapes raw HTML', () => {
        const message = addRawMessage('[S] <script>alert(1)</script>');
        const html = message.toHtml({
            buffer,
            useExtraFormatting: true,
        });

        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).not.toContain('<script>');
    });

    test('does not change regular buffers', () => {
        const channel = s.addBuffer(network.id, '#channel');
        s.addMessage(channel, {
            time: Date.now(),
            nick: 'alice',
            message: 'see https://example.com',
        });
        const message = channel.getMessages()[0];
        const html = message.toHtml({
            buffer: channel,
            useExtraFormatting: false,
        });

        expect(html).toContain('<a ');
    });

    function mountRaw(showTimestamps) {
        const vm = new Vue({
            el: document.createElement('div'),
            render: (h) => h(MessageListMessageRaw, {
                props: {
                    message: {
                        id: 7,
                        time: Date.now(),
                    },
                    ml: {
                        bufferSetting: (name) => (
                            name === 'show_timestamps' ? showTimestamps : false
                        ),
                        formatMessage: () => '[S] raw text',
                        formatTime: () => '12:34',
                        formatTimeFull: () => '12:34:56',
                        isTemporaryHighlighted: () => false,
                    },
                },
            }),
        });

        return vm;
    }

    test('renders a compact raw row with timestamps when enabled', () => {
        const vm = mountRaw(true);
        const el = vm.$el;

        expect(el.classList.contains('kiwi-messagelist-message--raw')).toBe(true);
        expect(el.querySelector('.kiwi-messagelist-raw-time').textContent)
            .toContain('12:34');
        expect(el.querySelector('.kiwi-messagelist-modern-left')).toBeNull();
        expect(el.querySelector('.kiwi-messagelist-nick')).toBeNull();
        expect(el.querySelector('.kiwi-messagelist-actions')).toBeNull();

        vm.$destroy();
    });

    test('omits the raw timestamp when timestamps are disabled', () => {
        const vm = mountRaw(false);

        expect(vm.$el.querySelector('.kiwi-messagelist-raw-time')).toBeNull();

        vm.$destroy();
    });
});
