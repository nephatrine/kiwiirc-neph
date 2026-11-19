import getState from '@/libs/state';
import parseMessage from '@/libs/MessageParser';
import { blockToHtml, getEmojis, matchEmoji } from '@/libs/EmojiProvider';
import render from '@/libs/renderers/Html';
import { getEmojiAutocompleteItems, reactionDisplay, replaceShortcodes } from '@/helpers/Emoji';

const customEmoji = 'https://cdn.example.com/emoji/kiwi.png';

function setCustomEmojis(map) {
    getState().setting('customEmojis', map);
}

describe('Custom emoji', () => {
    beforeEach(() => {
        getState().setting('buffers.emoji_convert_incoming', true);
        setCustomEmojis({});
    });

    afterEach(() => {
        getState().setting('buffers.emoji_convert_incoming', true);
        setCustomEmojis({});
    });

    test('matches custom tokens before unicode and falls back when unconfigured', () => {
        setCustomEmojis({
            kiwi: customEmoji,
            thumbsup: customEmoji,
        });

        const match = matchEmoji(':kiwi:')[0];
        expect(match.type).toBe('emoji');
        expect(match.meta.customEmojiUrl).toBe(customEmoji);
        expect(match.meta.shortcode).toBe('kiwi');

        const collision = matchEmoji(':thumbsup:')[0];
        expect(collision.meta.customEmojiUrl).toBe(customEmoji);

        setCustomEmojis({});
        expect(matchEmoji(':thumbsup:')[0].meta.emoji).toBe('👍');
        expect(reactionDisplay(':thumbsup:').text).toBe('👍');
    });

    test('renders a custom image with escaped attributes', () => {
        const url = 'https://cdn.example.com/emoji/a&b.png';
        const html = blockToHtml({
            content: ':kiwi:',
            meta: {
                customEmojiUrl: url,
                shortcode: 'kiwi',
            },
        });

        expect(html).toContain('class="kiwi-emoji kiwi-custom-emoji"');
        expect(html).toContain('src="https://cdn.example.com/emoji/a&amp;b.png"');
        expect(html).toContain('alt=":kiwi:"');
        expect(html).toContain('title=":kiwi:"');
    });

    test('leaves custom tokens literal when conversion is disabled', () => {
        setCustomEmojis({ kiwi: customEmoji });
        getState().setting('buffers.emoji_convert_incoming', false);

        expect(matchEmoji(':kiwi:')).toBe(false);
        expect(matchEmoji(':thumbsup:')).toBe(false);

        const blocks = parseMessage('hello :kiwi:');
        expect(blocks.some((block) => block.type === 'emoji')).toBe(false);
        expect(blocks.map((block) => block.content).join('')).toContain(':kiwi:');
    });

    test('parses custom tokens into emoji blocks', () => {
        setCustomEmojis({ kiwi: customEmoji });

        let blocks = parseMessage('hello :kiwi:');
        let emoji = blocks.find((block) => block.type === 'emoji');

        expect(emoji.content).toBe(':kiwi:');
        expect(emoji.meta.customEmojiUrl).toBe(customEmoji);

        const match = matchEmoji('ten-:kiwi:')[0];
        expect(match).toMatchObject({
            index: 4,
            match: ':kiwi:',
            meta: {
                customEmojiUrl: customEmoji,
                shortcode: 'kiwi',
            },
        });

        blocks = parseMessage('ten-:kiwi:');
        emoji = blocks.find((block) => block.type === 'emoji');
        expect(emoji).toBeDefined();
        expect(emoji.meta.customEmojiUrl).toBe(customEmoji);

        blocks = parseMessage(':smile: :kiwi:');
        expect(blocks.filter((block) => block.type === 'emoji')).toHaveLength(2);
    });

    test('leaves punctuation around converted shortcodes in place', () => {
        expect(replaceShortcodes('ten-:smile:')).toBe('ten-😄');
        expect(replaceShortcodes('ten:joy:')).toBe('ten😂');
    });

    test('keeps shortcodes literal but renders unicode inside monospace blocks', () => {
        setCustomEmojis({ kiwi: customEmoji });

        const backtickBlocks = parseMessage('`:smile: :kiwi:`', { extras: true });
        const ircBlocks = parseMessage('\x11:smile: :kiwi:\x11');

        expect(backtickBlocks.some((block) => block.type === 'emoji')).toBe(false);
        expect(ircBlocks.some((block) => block.type === 'emoji')).toBe(false);
        expect(backtickBlocks.map((block) => block.content).join(''))
            .toContain(':smile: :kiwi:');
        expect(ircBlocks.map((block) => block.content).join(''))
            .toContain(':smile: :kiwi:');

        const html = render(parseMessage('\x11😀\x11'), true);
        expect(html).toContain('kiwi-emoji');
        expect(html).toContain('😀');
    });

    test('does not convert or offer unicode replacements for custom tokens', () => {
        setCustomEmojis({ thumbsup: customEmoji });

        expect(replaceShortcodes(':thumbsup:')).toBe(':thumbsup:');
        expect(replaceShortcodes(':joy:')).toBe('😂');
        expect(getEmojis(':thumbsup:')).toEqual([]);
        expect(getEmojis(':joy:')[0].char).toBe('😂');
    });

    test('rejects non-http custom emoji urls', () => {
        setCustomEmojis({
            bad: ['javascript', 'alert(1)'].join(':'),
            bare: 'kiwi.png',
            ftp: 'ftp://example.com/kiwi.png',
            protocol: '//evil.example/kiwi.png',
        });

        expect(matchEmoji(':bad:')).toEqual([]);
        expect(matchEmoji(':bare:')).toEqual([]);
        expect(matchEmoji(':ftp:')).toEqual([]);
        expect(matchEmoji(':protocol:')).toEqual([]);
    });

    test('renders reaction shortnames and passes other reactions through', () => {
        setCustomEmojis({ kiwi: customEmoji });

        expect(reactionDisplay(':kiwi:')).toEqual({
            text: ':kiwi:',
            label: ':kiwi:',
            url: customEmoji,
            alt: '',
        });
        expect(reactionDisplay(':thumbsup:').text).toBe('👍');
        expect(reactionDisplay('👍').text).toBe('👍');
        expect(reactionDisplay('lol').text).toBe('lol');
        expect(reactionDisplay(':-)').text).toBe(':-)');
        expect(reactionDisplay(':unknown:').text).toBe(':unknown:');
    });
    test('accepts root-relative local paths', () => {
        setCustomEmojis({ kiwi: '/static/emotes/kiwi.png' });

        const match = matchEmoji(':kiwi:')[0];
        expect(match.meta.customEmojiUrl)
            .toBe(new URL('/static/emotes/kiwi.png', window.location.href).href);
        expect(match.meta.customEmojiUrl.startsWith(window.location.origin)).toBe(true);
    });
    test('builds autocomplete items and does not duplicate custom tokens', () => {
        setCustomEmojis({ kiwi: '/static/emotes/kiwi.png' });

        const items = getEmojiAutocompleteItems(':ki');
        const custom = items.find((item) => item.text === ':kiwi:');
        const unicode = items.find((item) => item.text === ':kiss:');

        expect(custom).toMatchObject({
            type: 'emoji',
            name: ':kiwi:',
            sourceType: 'local',
            url: new URL('/static/emotes/kiwi.png', window.location.href).href,
        });
        expect(unicode).toMatchObject({
            type: 'emoji',
            char: '💋',
            sourceType: 'unicode',
        });

        setCustomEmojis({ thumbsup: '/static/emotes/thumbsup.png' });

        const matches = getEmojiAutocompleteItems(':thumbsup')
            .filter((item) => item.text === ':thumbsup:');

        expect(matches).toHaveLength(1);
        expect(matches[0].url).toContain('/static/emotes/thumbsup.png');
    });
});
