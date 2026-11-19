import {
    blockToHtml,
    getEmojis,
    isEmojiOnlyBlocks,
    isEmojiOnlyText,
    wrapEmojiText
} from '@/libs/EmojiProvider';
import render from '@/libs/renderers/Html';
import EmojiText from '@/components/utils/EmojiText';
import MessageList from '@/components/MessageList';
import getState from '@/libs/state';
import parseMessage from '@/libs/MessageParser';
import { categories, emojiVersions, shortcodeToChar } from '@/res/emojiLookup';
import { emojiData } from '@/res/emojiData';
import {
    curatedEmojis,
    emojiMatches,
    emojiWithinVersion,
    filterEmojiData,
    getEmojiVersions,
    replaceShortcodes
} from '@/helpers/Emoji';

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

describe('Emoji-only detection', () => {
    function textBlock(content) {
        return {
            type: 'text',
            content,
            styles: {},
            meta: {},
        };
    }

    function emojiBlock(meta = {}) {
        return {
            type: 'emoji',
            content: '',
            styles: {},
            meta,
        };
    }

    test('detects literal emoji-only text', () => {
        expect(isEmojiOnlyText('😀')).toBe(true);
        expect(isEmojiOnlyText(' 😀 😃 ')).toBe(true);
        expect(isEmojiOnlyText('😀  😃\n😄')).toBe(true);
        expect(isEmojiOnlyText('👨‍👩‍👦')).toBe(true);
        expect(isEmojiOnlyText('👍🏽')).toBe(true);
        expect(isEmojiOnlyText('🇺🇸')).toBe(true);
        expect(isEmojiOnlyText('1️⃣')).toBe(true);
        expect(isEmojiOnlyText('')).toBe(false);
        expect(isEmojiOnlyText('   ')).toBe(false);
        expect(isEmojiOnlyText('😀 hello')).toBe(false);
        expect(isEmojiOnlyText('hello 😀')).toBe(false);
        expect(isEmojiOnlyText('123')).toBe(false);
        expect(isEmojiOnlyText(':wave:')).toBe(false);
    });

    test('accepts parsed emoji blocks and whitespace-separated emoji', () => {
        expect(isEmojiOnlyBlocks([
            textBlock('😀'),
            emojiBlock({ emoji: '😃', shortcode: 'smile' }),
            textBlock(' '),
        ])).toBe(true);
        expect(isEmojiOnlyBlocks([textBlock('😀 😃')])).toBe(true);
        expect(isEmojiOnlyBlocks([
            emojiBlock({ emoji: '😀', shortcode: 'smile' }),
            textBlock(' '),
            emojiBlock({
                customEmojiUrl: 'https://example.com/wave.png',
                shortcode: 'wave',
            }),
        ])).toBe(true);
        expect(isEmojiOnlyBlocks([
            emojiBlock({
                customEmojiUrl: 'https://example.com/wave.png',
                shortcode: 'wave',
            }),
        ])).toBe(true);

        const state = getState();
        state.setting('buffers.emoji_convert_incoming', true);
        state.setting('customEmojis', {
            doom: 'https://example.com/doom.png',
        });

        try {
            const spaced = parseMessage(':doom: :doom:');
            const adjacent = parseMessage(':doom::doom:');
            expect(isEmojiOnlyBlocks(spaced)).toBe(true);
            expect(isEmojiOnlyBlocks(adjacent)).toBe(true);
        } finally {
            state.setting('customEmojis', {});
        }
    });

    test('rejects mixed blocks and non-text blocks', () => {
        expect(isEmojiOnlyBlocks([])).toBe(false);
        expect(isEmojiOnlyBlocks([textBlock('   ')])).toBe(false);
        expect(isEmojiOnlyBlocks([
            textBlock('😀'),
            textBlock(' hello'),
        ])).toBe(false);
        expect(isEmojiOnlyBlocks([
            textBlock('😀'),
            {
                type: 'url',
                content: 'https://example.com',
                styles: {},
                meta: { url: 'https://example.com' },
            },
        ])).toBe(false);
        expect(isEmojiOnlyBlocks(null)).toBe(false);
    });
});

describe('MessageList emoji-only messages', () => {
    const context = {
        buffer: {
            isSpecial: () => false,
        },
        useExtraFormatting: true,
    };

    function textBlock(content) {
        return {
            type: 'text',
            content,
            styles: {},
            meta: {},
        };
    }

    function emojiBlock(meta = {}) {
        return {
            type: 'emoji',
            content: '',
            styles: {},
            meta,
        };
    }

    function makeMessage(overrides = {}) {
        return Object.assign({
            type: 'privmsg',
            is_redacted: false,
            bodyTemplate: null,
            embed: { payload: null },
            toBlocks: jest.fn(() => [textBlock('😀')]),
        }, overrides);
    }

    function isEmojiOnly(message) {
        return MessageList.methods.isEmojiOnlyMessage.call(context, message);
    }

    test('accepts normal, whitespace-separated, and uppercase chat messages', () => {
        let message = makeMessage();
        expect(isEmojiOnly(message)).toBe(true);
        expect(message.toBlocks).toHaveBeenCalledWith(context.buffer, true);

        message = makeMessage({
            toBlocks: () => [
                textBlock('😀'),
                textBlock(' '),
                emojiBlock({ emoji: '😃', shortcode: 'smile' }),
                textBlock('  '),
                textBlock('😄'),
            ],
        });
        expect(isEmojiOnly(message)).toBe(true);

        expect(isEmojiOnly(makeMessage({ type: 'PRIVMSG' }))).toBe(true);
    });

    test('rejects special buffers and unsupported message types', () => {
        const specialContext = Object.assign({}, context, {
            buffer: { isSpecial: () => true },
        });

        expect(MessageList.methods.isEmojiOnlyMessage.call(
            specialContext,
            makeMessage()
        )).toBe(false);
        expect(isEmojiOnly(makeMessage({ type: 'traffic' }))).toBe(false);
        expect(isEmojiOnly(makeMessage({ type: 'join' }))).toBe(false);
    });

    test('rejects ineligible or non-emoji message content', () => {
        expect(isEmojiOnly(makeMessage({ is_redacted: true }))).toBe(false);
        expect(isEmojiOnly(makeMessage({ bodyTemplate: {} }))).toBe(false);
        expect(isEmojiOnly(makeMessage({
            embed: { payload: 'https://example.com' },
        }))).toBe(false);
        expect(isEmojiOnly(makeMessage({
            toBlocks: () => [textBlock('😀 hello')],
        }))).toBe(false);
    });
});

describe('JoyPixels emoji data', () => {
    const allEmojis = Object.values(emojiData).flat();
    const allNames = Object.keys(shortcodeToChar);

    it('uses the expected categories, counts, and exclusions', () => {
        expect(categories.map((category) => category.id)).toEqual([
            'people',
            'nature',
            'food',
            'activity',
            'travel',
            'objects',
            'symbols',
            'flags',
        ]);
        expect(categories.map((category) => category.label)).toEqual([
            'Smileys & People',
            'Animals & Nature',
            'Food & Drink',
            'Activity',
            'Travel & Places',
            'Objects',
            'Symbols',
            'Flags',
        ]);
        expect(categories.map((category) => category.icon)).toEqual([
            'bx-smile',
            'bx-leaf',
            'bx-dish',
            'bx-football',
            'bxs-plane',
            'bx-bulb',
            'bx-heart',
            'bx-flag',
        ]);
        expect(Object.keys(emojiData)).toEqual(categories.map((category) => category.id));
        expect(allEmojis).toHaveLength(1899);
        expect(Object.fromEntries(
            Object.entries(emojiData).map(([id, list]) => [id, list.length])
        )).toEqual({
            people: 498,
            nature: 218,
            food: 130,
            activity: 123,
            travel: 131,
            objects: 227,
            symbols: 302,
            flags: 270,
        });
        expect(allNames).toHaveLength(2566);
        expect(allNames.some((name) => name.includes('_tone'))).toBe(false);
        expect(allNames).not.toContain('tone1');
        expect(allNames).not.toContain('regional_indicator_a');
        expect(allNames).not.toContain('digit_zero');
        expect(allNames).not.toContain('red_haired');
        expect(allNames).not.toContain('curly_haired');
        expect(allNames).not.toContain('white_haired');
        expect(allNames).not.toContain('bald');
        expect(allNames).not.toContain('man_red_haired');
        expect(allNames).not.toContain('person_bald');
        expect(allNames).not.toContain('blond_haired_person');
        expect(shortcodeToChar.family_man_woman_boy).toBe('👨‍👩‍👦');
    });

    it('uses JoyPixels names, aliases, and variation selectors', () => {
        expect(shortcodeToChar.thumbsup).toBe('👍');
        expect(shortcodeToChar['+1']).toBe('👍');
        expect(shortcodeToChar.poop).toBe('💩');
        expect(shortcodeToChar.hankey).toBe('💩');
        expect(shortcodeToChar.slight_smile).toBe('🙂');
        expect(shortcodeToChar.slightly_smiling_face).toBe('🙂');
        expect(shortcodeToChar.hugs).toBeUndefined();
        expect(shortcodeToChar.cowboy_hat_face).toBeUndefined();
        expect(shortcodeToChar.bald_man).toBeUndefined();
        expect(shortcodeToChar.pouting_face).toBe('😡');
        expect(shortcodeToChar.ok_woman).toBe('🙆');
        expect(shortcodeToChar.guardsman).toBe('💂');
        expect(shortcodeToChar.man_with_turban).toBe('👳');
        expect(shortcodeToChar.beach_umbrella).toBe('⛱️');
        expect(shortcodeToChar.city_sunset).toBe('🌇');
        expect(shortcodeToChar.om).toBe('🇴🇲');
        expect(shortcodeToChar.om_symbol).toBe('🕉️');
        expect(shortcodeToChar.zap).toBe('⚡️');
        expect(shortcodeToChar.transgender_symbol).toBe('⚧');
        expect(shortcodeToChar.heart).toBe('❤️');
    });

    it('tracks and filters Unicode versions', () => {
        const byShortcode = Object.fromEntries(allEmojis.map((emoji) => [
            emoji.shortcode,
            emoji,
        ]));
        expect(byShortcode.zap.version).toBe(4);
        expect(byShortcode.melting_face.version).toBe(14);
        expect(getEmojiVersions(emojiData)).toContain(13);
        expect(getEmojiVersions(emojiData)).toContain(13.1);
        expect(emojiVersions).toEqual(getEmojiVersions(emojiData));

        const sample = {
            people: [
                { shortcode: 'old', version: 13 },
                { shortcode: 'new', version: 13.1 },
                { shortcode: 'newer', version: 14 },
            ],
        };
        expect(emojiWithinVersion({ version: 13 }, 13)).toBe(true);
        expect(emojiWithinVersion({ version: 13.1 }, 13)).toBe(false);
        expect(emojiWithinVersion({ version: 17 }, 0)).toBe(true);
        expect(filterEmojiData(sample, 0)).toBe(sample);
        expect(filterEmojiData(sample, 13).people.map((emoji) => emoji.shortcode))
            .toEqual(['old']);
    });

    it('supports the non-ASCII JoyPixels piñata shortcode', () => {
        expect(allNames.every((name) => /^[\p{L}\p{N}_+-]+$/u.test(name))).toBe(true);
        expect(shortcodeToChar['piñata']).toBe('🪅');
        expect(replaceShortcodes(':piñata:')).toBe('🪅');
        expect(getEmojis(':piñata:')[0].char).toBe('🪅');
    });

    it('reports the matched shortcode position after punctuation', () => {
        expect(getEmojis('ten-:smile:')[0]).toMatchObject({
            shortcode: 'smile',
            char: '😄',
            index: 4,
            match: ':smile:',
        });
        expect(getEmojis('ten:joy:')[0]).toMatchObject({
            shortcode: 'joy',
            char: '😂',
            index: 3,
            match: ':joy:',
        });
    });

    it('maps shortcodes, validates curated entries, and powers search/replacement', () => {
        allEmojis.forEach((emoji) => {
            expect(shortcodeToChar[emoji.shortcode]).toBe(emoji.char);
            (emoji.aliases || []).forEach((alias) => {
                expect(shortcodeToChar[alias]).toBe(emoji.char);
            });
        });
        curatedEmojis.forEach((emoji) => {
            expect(shortcodeToChar[emoji.shortcode]).toBe(emoji.char);
        });

        const thumbsup = emojiData.people.find((emoji) => emoji.shortcode === 'thumbsup');
        const poop = emojiData.people.find((emoji) => emoji.shortcode === 'poop');
        expect(emojiMatches(thumbsup, 'thumbsup')).toBe(true);
        expect(emojiMatches(thumbsup, '+1')).toBe(true);
        expect(emojiMatches(thumbsup, 'thumbs up')).toBe(true);
        expect(emojiMatches(poop, 'hankey')).toBe(true);
        expect(emojiMatches(thumbsup, 'not-an-emoji')).toBe(false);

        expect(replaceShortcodes(':thumbsup: :poop: :slight_smile:'))
            .toBe('👍 💩 🙂');
        expect(replaceShortcodes(':hugs:')).toBe(':hugs:');
    });
});
