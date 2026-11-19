import { messageHostName, shouldShowHostName } from '@/helpers/MessageAuthor';
import { shouldDisplayAvatar } from '@/helpers/MessageAvatar';

function makeBuffer(settings = {}) {
    return {
        setting: (name) => settings[name],
    };
}

function makeMessage(user) {
    return { user };
}

describe('message author host names', () => {
    test('formats ident@host from either field set', () => {
        expect(messageHostName(makeMessage({
            username: 'ident',
            host: 'example.com',
        }))).toBe('ident@example.com');

        expect(messageHostName(makeMessage({
            ident: 'ident',
            hostname: 'example.com',
        }))).toBe('ident@example.com');
    });

    test('requires both ident and host', () => {
        expect(messageHostName(makeMessage({ username: 'ident' }))).toBe('');
        expect(messageHostName(makeMessage({ host: 'example.com' }))).toBe('');
        expect(messageHostName(makeMessage(null))).toBe('');

        expect(shouldShowHostName(makeMessage(null), makeBuffer({
            show_hostnames: true,
            show_realnames: false,
        }))).toBe(false);

        expect(shouldShowHostName(makeMessage({ username: 'ident' }), makeBuffer({
            show_hostnames: true,
            show_realnames: false,
        }))).toBe(false);
    });

    test('shows only when enabled, and accepts cached settings', () => {
        const message = makeMessage({
            username: 'ident',
            host: 'example.com',
        });

        expect(shouldShowHostName(message, makeBuffer({
            show_hostnames: true,
            show_realnames: false,
        }))).toBe(true);

        expect(shouldShowHostName(message, makeBuffer({
            show_hostnames: true,
            show_realnames: true,
        }))).toBe(false);

        expect(shouldShowHostName(message, makeBuffer({
            show_hostnames: false,
            show_realnames: false,
        }))).toBe(false);

        const buffer = {
            setting: jest.fn(() => {
                throw new Error('buffer setting should not be read');
            }),
        };

        expect(shouldShowHostName(message, buffer, {
            showRealNames: false,
            showHostNames: true,
        })).toBe(true);
        expect(buffer.setting).not.toHaveBeenCalled();
    });
});

describe('message avatars', () => {
    function makeAvatarBuffer(options = {}) {
        return {
            isServer: () => options.server === true,
            isSpecial: () => options.special === true,
        };
    }

    function makeAvatarMessage(options = {}) {
        return {
            type: options.type || 'privmsg',
            nick: options.nick,
            user: options.user || null,
        };
    }

    test('shows avatars when a nick exists and the setting allows it', () => {
        let message = makeAvatarMessage({
            type: 'notice',
            nick: '',
            user: null,
        });
        expect(shouldDisplayAvatar(message, makeAvatarBuffer(), {
            showWithoutUser: true,
        })).toBe(false);

        message = makeAvatarMessage({
            nick: 'Alice',
            user: null,
        });
        expect(shouldDisplayAvatar(message, makeAvatarBuffer(), {
            showWithoutUser: true,
        })).toBe(true);
        expect(shouldDisplayAvatar(message, makeAvatarBuffer(), {
            showWithoutUser: false,
        })).toBe(false);

        message = makeAvatarMessage({
            nick: 'Alice',
            user: { nick: 'Alice' },
        });
        expect(shouldDisplayAvatar(message, makeAvatarBuffer(), {
            showWithoutUser: false,
        })).toBe(true);
    });

    test('hides avatars for non-message types, special buffers, and repeats', () => {
        let message = makeAvatarMessage({
            type: 'traffic',
            nick: 'Alice',
            user: { nick: 'Alice' },
        });
        expect(shouldDisplayAvatar(message, makeAvatarBuffer())).toBe(false);

        message = makeAvatarMessage({
            nick: 'Alice',
            user: { nick: 'Alice' },
        });
        expect(shouldDisplayAvatar(message, makeAvatarBuffer({ server: true }))).toBe(false);
        expect(shouldDisplayAvatar(message, makeAvatarBuffer({ special: true }))).toBe(false);
        expect(shouldDisplayAvatar(message, makeAvatarBuffer(), {
            repeat: true,
        })).toBe(false);
    });
});
