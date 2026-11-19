import state from '@/libs/state';
import { LOCAL_INITIALS } from '@/helpers/AvatarFallback';
import { getAvatarTransform } from '@/components/UserAvatarCommon';

describe('user fallback avatars', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('caches fallback URLs so failed images can fall back locally', () => {
        const s = state.create();
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
        const s = state.create();
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
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const user = s.addUser(network.id, { nick: 'Alice' });
        s.setting('avatars.fallback_style', LOCAL_INITIALS);
        s.setting('avatars.fallback_avatar_url', 'https://example.com/{nickname}.svg');

        expect(user.avatar.small).toBe('');
        expect(user.avatar.large).toBe('');

        s.$destroy();
    });

    test('drops the cached fallback URL when the setting is cleared', () => {
        const s = state.create();
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
    const appState = state();

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
