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

    test('matches custom tokens before unicode shortcodes', () => {
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

    test('falls back to unicode when no custom emoji is configured', () => {
        expect(matchEmoji(':thumbsup:')[0].meta.emoji).toBe('👍');
        expect(reactionDisplay(':thumbsup:').text).toBe('👍');
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

        const blocks = parseMessage('hello :kiwi:');
        const emoji = blocks.find((block) => block.type === 'emoji');

        expect(emoji.content).toBe(':kiwi:');
        expect(emoji.meta.customEmojiUrl).toBe(customEmoji);
    });

    test('matches custom tokens after punctuation', () => {
        setCustomEmojis({ kiwi: customEmoji });

        const match = matchEmoji('ten-:kiwi:')[0];
        expect(match).toMatchObject({
            index: 4,
            match: ':kiwi:',
            meta: {
                customEmojiUrl: customEmoji,
                shortcode: 'kiwi',
            },
        });

        const blocks = parseMessage('ten-:kiwi:');
        const emoji = blocks.find((block) => block.type === 'emoji');

        expect(emoji).toBeDefined();
        expect(emoji.meta.customEmojiUrl).toBe(customEmoji);
    });

    test('leaves punctuation around converted shortcodes in place', () => {
        expect(replaceShortcodes('ten-:smile:')).toBe('ten-😄');
        expect(replaceShortcodes('ten:joy:')).toBe('ten😂');
    });

    test('leaves shortcodes literal inside monospace blocks', () => {
        setCustomEmojis({ kiwi: customEmoji });

        const backtickBlocks = parseMessage('`:smile: :kiwi:`', { extras: true });
        const ircBlocks = parseMessage('\x11:smile: :kiwi:\x11');

        expect(backtickBlocks.some((block) => block.type === 'emoji')).toBe(false);
        expect(ircBlocks.some((block) => block.type === 'emoji')).toBe(false);
        expect(backtickBlocks.map((block) => block.content).join(''))
            .toContain(':smile: :kiwi:');
        expect(ircBlocks.map((block) => block.content).join(''))
            .toContain(':smile: :kiwi:');
    });

    test('still renders literal unicode emoji inside monospace blocks', () => {
        const blocks = parseMessage('\x11😀\x11');
        const html = render(blocks, true);

        expect(html).toContain('kiwi-emoji');
        expect(html).toContain('😀');
    });

    test('still matches shortcodes in normal text', () => {
        setCustomEmojis({ kiwi: customEmoji });

        const blocks = parseMessage(':smile: :kiwi:');
        const emoji = blocks.filter((block) => block.type === 'emoji');

        expect(emoji).toHaveLength(2);
    });

    test('does not convert custom tokens while sending', () => {
        setCustomEmojis({ thumbsup: customEmoji });

        expect(replaceShortcodes(':thumbsup:')).toBe(':thumbsup:');
        expect(replaceShortcodes(':joy:')).toBe('😂');
    });

    test('does not offer a unicode replacement for custom tokens', () => {
        setCustomEmojis({ thumbsup: customEmoji });

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
    test('builds autocomplete items for custom and unicode shortnames', () => {
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
    });

    test('does not duplicate custom tokens with unicode shortnames', () => {
        setCustomEmojis({ thumbsup: '/static/emotes/thumbsup.png' });

        const items = getEmojiAutocompleteItems(':thumbsup');
        const matches = items.filter((item) => item.text === ':thumbsup:');

        expect(matches).toHaveLength(1);
        expect(matches[0].url).toContain('/static/emotes/thumbsup.png');
    });
});
