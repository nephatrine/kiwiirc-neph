import { blockToHtml, wrapEmojiText } from '@/libs/EmojiProvider';
import render from '@/libs/renderers/Html';
import EmojiText from '@/components/utils/EmojiText';

describe('Emoji text wrapping', () => {
    it('wraps known native emoji with their primary shortcode', () => {
        expect(wrapEmojiText('👍')).toBe(
            '<span class="kiwi-emoji" title=":thumbsup:">👍</span>'
        );
        expect(wrapEmojiText('⚡️')).toBe(
            '<span class="kiwi-emoji" title=":zap:">⚡️</span>'
        );
    });

    it('wraps a known ZWJ sequence as one unit', () => {
        expect(wrapEmojiText('👨‍👩‍👦')).toBe(
            '<span class="kiwi-emoji" title=":family_man_woman_boy:">👨‍👩‍👦</span>'
        );
    });

    it('does not wrap skin-tone variants or unqualified forms', () => {
        expect(wrapEmojiText('👍🏽')).toBe('👍🏽');
        expect(wrapEmojiText('❤')).toBe('❤');
        expect(wrapEmojiText('⚡')).toBe('⚡');
    });

    it('escapes surrounding text and leaves unknown emoji untouched', () => {
        expect(wrapEmojiText('<👍>')).toBe(
            '&lt;<span class="kiwi-emoji" title=":thumbsup:">👍</span>&gt;'
        );
        expect(wrapEmojiText('👍🏽')).not.toContain('kiwi-emoji');
    });

    it('wraps converted shortcodes with the typed shortcode', () => {
        expect(blockToHtml({
            content: ':+1:',
            meta: {
                emoji: '👍',
                shortcode: '+1',
            },
        })).toBe('<span class="kiwi-emoji" title=":+1:">👍</span>');
    });

    it('wraps native emoji through the message HTML renderer', () => {
        const html = render([{
            content: 'Hi 👍',
            styles: {},
            type: 'text',
        }], true);

        expect(html).toBe(
            'Hi <span class="kiwi-emoji" title=":thumbsup:">👍</span>'
        );
    });

    it('wraps emoji in nick and channel links', () => {
        const nick = render([{
            content: '👍',
            styles: {},
            type: 'user',
            meta: { user: '👍' },
        }], true);
        const channel = render([{
            content: '#👍',
            styles: {},
            type: 'channel',
            meta: { channel: '#👍' },
        }], true);

        expect(nick).toContain('kiwi-emoji');
        expect(channel).toContain('kiwi-emoji');
    });

    it('leaves unknown emoji unwrapped through the message HTML renderer', () => {
        const html = render([{
            content: 'Hi 👍🏽',
            styles: {},
            type: 'text',
        }], true);

        expect(html).toBe('Hi 👍🏽');
    });

    it('uses the same wrapping in the EmojiText component', () => {
        expect(EmojiText.options.computed.html.call({ text: 'Hi 👍' })).toBe(
            'Hi <span class="kiwi-emoji" title=":thumbsup:">👍</span>'
        );
    });

    it('does not wrap unknown emoji in the EmojiText component', () => {
        expect(EmojiText.options.computed.html.call({ text: '👍🏽' })).toBe('👍🏽');
    });
});
