import state from '@/libs/state';

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
