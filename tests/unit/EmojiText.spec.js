import { blockToHtml, wrapEmojiText } from '@/libs/EmojiProvider';
import render from '@/libs/renderers/Html';
import EmojiText from '@/components/utils/EmojiText';

describe('Emoji text wrapping', () => {
    it('wraps known native emoji and escapes surrounding text', () => {
        expect(wrapEmojiText('👍')).toBe(
            '<span class="kiwi-emoji" title=":thumbsup:">👍</span>'
        );
        expect(wrapEmojiText('⚡️')).toBe(
            '<span class="kiwi-emoji" title=":zap:">⚡️</span>'
        );
        expect(wrapEmojiText('👨‍👩‍👦')).toBe(
            '<span class="kiwi-emoji" title=":family_man_woman_boy:">👨‍👩‍👦</span>'
        );
        expect(wrapEmojiText('👍🏽')).toBe('👍🏽');
        expect(wrapEmojiText('❤')).toBe('❤');
        expect(wrapEmojiText('⚡')).toBe('⚡');
        expect(wrapEmojiText('<👍>')).toBe(
            '&lt;<span class="kiwi-emoji" title=":thumbsup:">👍</span>&gt;'
        );
        expect(wrapEmojiText('👍🏽')).not.toContain('kiwi-emoji');
    });

    it('wraps converted and rendered native emoji', () => {
        expect(blockToHtml({
            content: ':+1:',
            meta: {
                emoji: '👍',
                shortcode: '+1',
            },
        })).toBe('<span class="kiwi-emoji" title=":+1:">👍</span>');

        expect(render([{
            content: 'Hi 👍',
            styles: {},
            type: 'text',
        }], true)).toBe(
            'Hi <span class="kiwi-emoji" title=":thumbsup:">👍</span>'
        );
        expect(render([{
            content: 'Hi 👍🏽',
            styles: {},
            type: 'text',
        }], true)).toBe('Hi 👍🏽');
    });

    it('wraps emoji in nick and channel links', () => {
        expect(render([{
            content: '👍',
            styles: {},
            type: 'user',
            meta: { user: '👍' },
        }], true)).toContain('kiwi-emoji');
        expect(render([{
            content: '#👍',
            styles: {},
            type: 'channel',
            meta: { channel: '#👍' },
        }], true)).toContain('kiwi-emoji');
    });

    it('uses the same wrapping in the EmojiText component', () => {
        expect(EmojiText.options.computed.html.call({ text: 'Hi 👍' })).toBe(
            'Hi <span class="kiwi-emoji" title=":thumbsup:">👍</span>'
        );
        expect(EmojiText.options.computed.html.call({ text: '👍🏽' })).toBe('👍🏽');
    });
});
