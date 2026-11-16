import { shouldDisplayAvatar } from '@/helpers/MessageAvatar';

function makeBuffer(options = {}) {
    return {
        isServer: () => options.server === true,
        isSpecial: () => options.special === true,
    };
}

function makeMessage(options = {}) {
    return {
        type: options.type || 'privmsg',
        nick: options.nick,
        user: options.user || null,
    };
}

describe('message avatars', () => {
    test('does not generate an avatar for a server notice without a nick', () => {
        const message = makeMessage({
            type: 'notice',
            nick: '',
            user: null,
        });

        expect(shouldDisplayAvatar(message, makeBuffer(), {
            showWithoutUser: true,
        })).toBe(false);
    });

    test('shows an unknown-user avatar when a nick exists', () => {
        const message = makeMessage({
            nick: 'Alice',
            user: null,
        });

        expect(shouldDisplayAvatar(message, makeBuffer(), {
            showWithoutUser: true,
        })).toBe(true);
    });

    test('hides unknown-user avatars when the setting is off', () => {
        const message = makeMessage({
            nick: 'Alice',
            user: null,
        });

        expect(shouldDisplayAvatar(message, makeBuffer(), {
            showWithoutUser: false,
        })).toBe(false);
    });

    test('shows known-user avatars', () => {
        const message = makeMessage({
            nick: 'Alice',
            user: { nick: 'Alice' },
        });

        expect(shouldDisplayAvatar(message, makeBuffer(), {
            showWithoutUser: false,
        })).toBe(true);
    });

    test('does not show avatars for non-message types', () => {
        const message = makeMessage({
            type: 'traffic',
            nick: 'Alice',
            user: { nick: 'Alice' },
        });

        expect(shouldDisplayAvatar(message, makeBuffer())).toBe(false);
    });

    test('does not show avatars in server or special buffers', () => {
        const message = makeMessage({
            nick: 'Alice',
            user: { nick: 'Alice' },
        });

        expect(shouldDisplayAvatar(message, makeBuffer({ server: true }))).toBe(false);
        expect(shouldDisplayAvatar(message, makeBuffer({ special: true }))).toBe(false);
    });

    test('does not show avatars on repeated author rows', () => {
        const message = makeMessage({
            nick: 'Alice',
            user: { nick: 'Alice' },
        });

        expect(shouldDisplayAvatar(message, makeBuffer(), {
            repeat: true,
        })).toBe(false);
    });
});
