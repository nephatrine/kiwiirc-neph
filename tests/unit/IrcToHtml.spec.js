import getState from '@/libs/state';
import { ircToHtml } from '@/helpers/IrcToHtml';

describe('ircToHtml', () => {
    test('renders IRC formatting and colours', () => {
        expect(ircToHtml('\x02bold\x02')).toContain('font-weight:bold');
        expect(ircToHtml('\x1Ditalic\x1D')).toContain('font-style:italic');
        expect(ircToHtml('\x1Funderline\x1F')).toContain('text-decoration:underline');
        expect(ircToHtml('\x1Estrike\x1E')).toContain('text-decoration:line-through');
        expect(ircToHtml('\x11mono\x11')).toContain('kiwi-formatting-extras-monospace');
        expect(ircToHtml('\x16reverse\x16')).toContain('kiwi-formatting-reverse');
        expect(ircToHtml('\x0304red\x03')).toContain('irc-fg-colour-light-red');
    });

    test('escapes HTML, keeps emoji, and converts shortcodes when enabled', () => {
        const html = ircToHtml('<b>unsafe</b> 👍');

        expect(html).not.toContain('<b>unsafe</b>');
        expect(html).toContain('&lt;b&gt;unsafe&lt;/b&gt;');
        expect(html).toContain('class="kiwi-emoji"');

        const state = getState();
        const previous = state.setting('buffers.emoji_convert_incoming');
        state.setting('buffers.emoji_convert_incoming', true);

        try {
            expect(ircToHtml(':thumbsup:')).toContain('kiwi-emoji');
        } finally {
            state.setting('buffers.emoji_convert_incoming', previous);
        }
    });
});
