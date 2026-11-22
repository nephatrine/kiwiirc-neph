import appStateModule from '@/libs/state';
import { getAvatarTransform } from '@/components/UserAvatarCommon';
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
    test('offers local and DiceBear presets with reversible URLs', () => {
        expect(AVATAR_FALLBACK_STYLES.map((style) => style.value)).toEqual([
            LOCAL_INITIALS,
            LOCAL_IDENTICON,
            'dicebear-identicon',
            'dicebear-bottts',
            'dicebear-cameo',
            'dicebear-gaze',
            CUSTOM_AVATAR_STYLE,
        ]);
        Object.values(DICEBEAR_FALLBACK_URLS).forEach((url) => {
            expect(url).toContain('https://api.dicebear.com/10.x/');
            expect(url).toContain('seed={nickname}');
        });
        expect(DICEBEAR_FALLBACK_URLS['dicebear-gaze'])
            .toContain('animationVariant=medium');

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

    test('generates deterministic, bounded, centered identicon cells', () => {
        const first = getLocalIdenticon('Alice');
        const second = getLocalIdenticon('alice');
        expect(first).toEqual(second);
        expect(first.length).toBeGreaterThan(0);
        expect(getLocalIdenticon('Bob')).not.toEqual(first);

        getLocalIdenticon('somebody').forEach((cell) => {
            expect(cell.x).toBeGreaterThanOrEqual(0);
            expect(cell.y).toBeGreaterThanOrEqual(0);
            expect(cell.x + cell.width).toBeLessThanOrEqual(100);
            expect(cell.y + cell.height).toBeLessThanOrEqual(100);
        });

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

describe('user fallback avatars', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('caches fallback URLs so failed images can fall back locally', () => {
        const s = appStateModule.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const user = s.addUser(network.id, { nick: 'Alice' });
        s.setting('avatars.fallback_avatar_url', 'https://example.com/{nickname}.svg');

        const first = user.avatar;
        expect(first.small).toBe('https://example.com/alice.svg');
        expect(first.large).toBe('https://example.com/alice.svg');
        expect(user.avatar).toBe(first);

        first.small = '';
        first.large = '';

        expect(user.avatar.small).toBe('');
        expect(user.avatar.large).toBe('');

        s.$destroy();
    });

    test('caches metadata avatars and can fall back after an image failure', () => {
        const s = appStateModule.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const user = s.addUser(network.id, { nick: 'Alice' });
        user.metadata.avatar = 'https://example.com/avatar-{size}.png';

        const first = user.avatar;
        expect(first.small).toBe('https://example.com/avatar-256.png');
        expect(first.large).toBe('https://example.com/avatar-256.png');
        expect(user.avatar).toBe(first);

        first.small = '';
        first.large = '';

        expect(user.avatar.small).toBe('');
        expect(user.avatar.large).toBe('');

        s.$destroy();
    });

    test('ignores remote fallback URLs for local initials', () => {
        const s = appStateModule.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const user = s.addUser(network.id, { nick: 'Alice' });
        s.setting('avatars.fallback_style', LOCAL_INITIALS);
        s.setting('avatars.fallback_avatar_url', 'https://example.com/{nickname}.svg');

        expect(user.avatar.small).toBe('');
        expect(user.avatar.large).toBe('');

        s.$destroy();
    });

    test('drops the cached fallback URL when the setting is cleared', () => {
        const s = appStateModule.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const user = s.addUser(network.id, { nick: 'Alice' });
        s.setting('avatars.fallback_avatar_url', 'https://example.com/{nickname}.svg');

        const first = user.avatar;
        expect(first.small).toBe('https://example.com/alice.svg');

        s.setting('avatars.fallback_avatar_url', '');

        const second = user.avatar;
        expect(second).not.toBe(first);
        expect(second.small).toBe('');
        expect(second.large).toBe('');

        s.$destroy();
    });
});

describe('avatar away status transform', () => {
    const appState = appStateModule();

    afterEach(() => {
        appState.setting('avatars.away_status_position', 2);
    });

    it('uses the configured corner and defaults to bottom-right', () => {
        appState.setting('avatars.away_status_position', 2);
        expect(appState.setting('avatars.away_status_position')).toBe(2);
        expect(getAvatarTransform()).toBe('rotate(135 50 50)');

        appState.setting('avatars.away_status_position', 1);

        expect(getAvatarTransform()).toBe('rotate(45 50 50)');

        appState.setting('avatars.away_status_position', 4);

        expect(getAvatarTransform()).toBe('rotate(315 50 50)');
    });
});
