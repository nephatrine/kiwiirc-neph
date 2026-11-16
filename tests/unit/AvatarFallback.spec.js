import {
    AVATAR_FALLBACK_STYLES,
    CUSTOM_AVATAR_STYLE,
    DICEBEAR_FALLBACK_URLS,
    LOCAL_IDENTICON,
    LOCAL_INITIALS,
    avatarFallbackStyleFromUrl,
    getAvatarFallbackUrl,
    getConfiguredAvatarFallbackUrl,
    getLocalIdenticon,
    getLocalInitials,
    isDiceBearFallbackStyle
} from '@/helpers/AvatarFallback';

describe('avatar fallback styles', () => {
    test('offers local fallbacks and DiceBear presets', () => {
        expect(AVATAR_FALLBACK_STYLES.map((style) => style.value)).toEqual([
            LOCAL_INITIALS,
            LOCAL_IDENTICON,
            'dicebear-identicon',
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
        expect(avatarFallbackStyleFromUrl(
            'https://api.dicebear.com/10.x/rings/svg?seed=Alice'
        )).toBe(CUSTOM_AVATAR_STYLE);
        expect(DICEBEAR_FALLBACK_URLS['dicebear-rings']).toBeUndefined();
        expect(getAvatarFallbackUrl(LOCAL_IDENTICON)).toBe('');
        expect(getAvatarFallbackUrl(LOCAL_INITIALS)).toBe('');
        expect(isDiceBearFallbackStyle(LOCAL_INITIALS)).toBe(false);
        expect(isDiceBearFallbackStyle(CUSTOM_AVATAR_STYLE)).toBe(false);
    });

    test('builds the configured fallback URL for a nick', () => {
        const state = (settings) => ({
            setting: (key) => settings[key],
        });

        expect(getConfiguredAvatarFallbackUrl('Alice Smith', state({
            'avatars.fallback_style': CUSTOM_AVATAR_STYLE,
            'avatars.fallback_avatar_url': 'https://example.com/{nickname}.png',
        }))).toBe('https://example.com/alice%20smith.png');

        expect(getConfiguredAvatarFallbackUrl('Alice', state({
            'avatars.fallback_style': LOCAL_INITIALS,
            'avatars.fallback_avatar_url': 'https://example.com/{nickname}.png',
        }))).toBe('');

        expect(getConfiguredAvatarFallbackUrl('Alice', state({
            'avatars.fallback_style': CUSTOM_AVATAR_STYLE,
            'avatars.fallback_avatar_url': '',
        }))).toBe('');
    });

    test('generates local initials from the nickname', () => {
        expect(getLocalInitials('alice')).toBe('A');
        expect(getLocalInitials('alice', 2)).toBe('AL');
        expect(getLocalInitials('alice', 0)).toBe('A');
        expect(getLocalInitials('alice', 3)).toBe('AL');
        expect(getLocalInitials('  Alice  ')).toBe('A');
        expect(getLocalInitials('')).toBe('U');
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
