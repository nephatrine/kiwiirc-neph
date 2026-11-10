import {
    AVATAR_FALLBACK_STYLES,
    CUSTOM_AVATAR_STYLE,
    DICEBEAR_FALLBACK_URLS,
    LOCAL_IDENTICON,
    avatarFallbackStyleFromUrl,
    getAvatarFallbackUrl,
    getLocalIdenticon,
    isDiceBearFallbackStyle
} from '@/helpers/AvatarFallback';

describe('avatar fallback styles', () => {
    test('offers the local identicon and DiceBear presets', () => {
        expect(AVATAR_FALLBACK_STYLES.map((style) => style.value)).toEqual([
            LOCAL_IDENTICON,
            'dicebear-identicon',
            'dicebear-rings',
            'dicebear-bottts',
            'dicebear-cameo',
            'dicebear-gaze',
            CUSTOM_AVATAR_STYLE,
        ]);
    });

    test('builds DiceBear 10.x URLs with a nickname seed', () => {
        Object.values(DICEBEAR_FALLBACK_URLS).forEach((url) => {
            expect(url).toContain('https://api.dicebear.com/10.x/');
            expect(url).toContain('seed={nickname}');
        });
        expect(DICEBEAR_FALLBACK_URLS['dicebear-gaze'])
            .toContain('animationVariant=medium');
    });

    test('resolves preset URLs back to their styles', () => {
        Object.keys(DICEBEAR_FALLBACK_URLS).forEach((style) => {
            expect(avatarFallbackStyleFromUrl(DICEBEAR_FALLBACK_URLS[style]))
                .toBe(style);
            expect(getAvatarFallbackUrl(style))
                .toBe(DICEBEAR_FALLBACK_URLS[style]);
            expect(isDiceBearFallbackStyle(style)).toBe(true);
        });

        expect(avatarFallbackStyleFromUrl('')).toBe(LOCAL_IDENTICON);
        expect(avatarFallbackStyleFromUrl('https://example.com/avatar.png'))
            .toBe(CUSTOM_AVATAR_STYLE);
        expect(getAvatarFallbackUrl(LOCAL_IDENTICON)).toBe('');
        expect(isDiceBearFallbackStyle(CUSTOM_AVATAR_STYLE)).toBe(false);
    });

    test('generates deterministic identicon cells', () => {
        const first = getLocalIdenticon('Alice');
        const second = getLocalIdenticon('alice');

        expect(first).toEqual(second);
        expect(first.length).toBeGreaterThan(0);
        expect(getLocalIdenticon('Bob')).not.toEqual(first);
    });

    test('keeps identicon cells inside the avatar view box', () => {
        getLocalIdenticon('somebody').forEach((cell) => {
            expect(cell.x).toBeGreaterThanOrEqual(0);
            expect(cell.y).toBeGreaterThanOrEqual(0);
            expect(cell.x + cell.width).toBeLessThanOrEqual(100);
            expect(cell.y + cell.height).toBeLessThanOrEqual(100);
        });
    });

    test('centers identicon cells within the avatar view box', () => {
        const cells = getLocalIdenticon('somebody');
        const left = Math.min(...cells.map((cell) => cell.x));
        const right = Math.max(...cells.map((cell) => cell.x + cell.width));

        expect(left + right).toBe(100);

        cells.forEach((cell) => {
            expect((cell.x - 16) % 14).toBe(0);
            expect((cell.y - 16) % 14).toBe(0);
            expect(cell.x).toBeGreaterThanOrEqual(16);
            expect(cell.y).toBeGreaterThanOrEqual(16);
            expect(cell.x + cell.width).toBeLessThanOrEqual(84);
            expect(cell.y + cell.height).toBeLessThanOrEqual(84);
        });
    });
});
