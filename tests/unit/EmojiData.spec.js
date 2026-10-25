import { categories, emojiData, shortcodeToChar } from '@/res/emojis';
import {
    curatedEmojis,
    emojiMatches,
    emojiWithinVersion,
    filterEmojiData,
    getEmojiVersions,
    replaceShortcodes
} from '@/helpers/Emoji';
import { getEmojis } from '@/libs/EmojiProvider';

const allEmojis = Object.values(emojiData).flat();
const allNames = Object.keys(shortcodeToChar);

describe('JoyPixels emoji data', () => {
    it('uses the JoyPixels category set and labels', () => {
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
        expect(Object.keys(emojiData)).toEqual(categories.map((category) => category.id));
    });

    it('has the expected filtered entry counts', () => {
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
    });

    it('excludes skin-tone, hair, regional-indicator, and keycap components', () => {
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

    it('uses JoyPixels primary names and aliases', () => {
        expect(shortcodeToChar.thumbsup).toBe('👍');
        expect(shortcodeToChar['+1']).toBe('👍');
        expect(shortcodeToChar.poop).toBe('💩');
        expect(shortcodeToChar.hankey).toBe('💩');
        expect(shortcodeToChar.slight_smile).toBe('🙂');
        expect(shortcodeToChar.slightly_smiling_face).toBe('🙂');
        expect(shortcodeToChar.hugs).toBeUndefined();
        expect(shortcodeToChar.cowboy_hat_face).toBeUndefined();
        expect(shortcodeToChar.bald_man).toBeUndefined();
    });

    it('matches JoyPixels names that change meaning', () => {
        expect(shortcodeToChar.pouting_face).toBe('😡');
        expect(shortcodeToChar.ok_woman).toBe('🙆');
        expect(shortcodeToChar.guardsman).toBe('💂');
        expect(shortcodeToChar.man_with_turban).toBe('👳');
        expect(shortcodeToChar.beach_umbrella).toBe('⛱️');
        expect(shortcodeToChar.city_sunset).toBe('🌇');
        expect(shortcodeToChar.om).toBe('🇴🇲');
        expect(shortcodeToChar.om_symbol).toBe('🕉️');
    });

    it('uses JoyPixels variation selectors', () => {
        expect(shortcodeToChar.zap).toBe('⚡️');
        expect(shortcodeToChar.transgender_symbol).toBe('⚧');
        expect(shortcodeToChar.heart).toBe('❤️');
    });

    it('keeps Unicode versions for picker filtering', () => {
        const byShortcode = Object.fromEntries(allEmojis.map((emoji) => [
            emoji.shortcode,
            emoji,
        ]));

        expect(byShortcode.zap.version).toBe(4);
        expect(byShortcode.melting_face.version).toBe(14);
        expect(getEmojiVersions(emojiData)).toContain(13);
        expect(getEmojiVersions(emojiData)).toContain(13.1);
    });

    it('filters emoji by maximum Unicode version', () => {
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

    it('maps every primary and alias to its entry character', () => {
        allEmojis.forEach((emoji) => {
            expect(shortcodeToChar[emoji.shortcode]).toBe(emoji.char);
            (emoji.aliases || []).forEach((alias) => {
                expect(shortcodeToChar[alias]).toBe(emoji.char);
            });
        });
    });

    it('keeps curated shortcodes valid', () => {
        curatedEmojis.forEach((emoji) => {
            expect(shortcodeToChar[emoji.shortcode]).toBe(emoji.char);
        });
    });

    it('matches primary shortcodes, names, and aliases in picker search', () => {
        const thumbsup = emojiData.people.find((emoji) => emoji.shortcode === 'thumbsup');
        const poop = emojiData.people.find((emoji) => emoji.shortcode === 'poop');

        expect(emojiMatches(thumbsup, 'thumbsup')).toBe(true);
        expect(emojiMatches(thumbsup, '+1')).toBe(true);
        expect(emojiMatches(thumbsup, 'thumbs up')).toBe(true);
        expect(emojiMatches(poop, 'hankey')).toBe(true);
        expect(emojiMatches(thumbsup, 'not-an-emoji')).toBe(false);
    });

    it('replaces JoyPixels shortcodes and leaves removed names literal', () => {
        expect(replaceShortcodes(':thumbsup: :poop: :slight_smile:'))
            .toBe('👍 💩 🙂');
        expect(replaceShortcodes(':hugs:'))
            .toBe(':hugs:');
    });
});
