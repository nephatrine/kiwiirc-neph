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
    test('shows avatars when a nick exists and the setting allows it', () => {
        let message = makeMessage({
            type: 'notice',
            nick: '',
            user: null,
        });
        expect(shouldDisplayAvatar(message, makeBuffer(), {
            showWithoutUser: true,
        })).toBe(false);

        message = makeMessage({
            nick: 'Alice',
            user: null,
        });
        expect(shouldDisplayAvatar(message, makeBuffer(), {
            showWithoutUser: true,
        })).toBe(true);
        expect(shouldDisplayAvatar(message, makeBuffer(), {
            showWithoutUser: false,
        })).toBe(false);

        message = makeMessage({
            nick: 'Alice',
            user: { nick: 'Alice' },
        });
        expect(shouldDisplayAvatar(message, makeBuffer(), {
            showWithoutUser: false,
        })).toBe(true);
    });

    test('hides avatars for non-message types, special buffers, and repeats', () => {
        let message = makeMessage({
            type: 'traffic',
            nick: 'Alice',
            user: { nick: 'Alice' },
        });
        expect(shouldDisplayAvatar(message, makeBuffer())).toBe(false);

        message = makeMessage({
            nick: 'Alice',
            user: { nick: 'Alice' },
        });
        expect(shouldDisplayAvatar(message, makeBuffer({ server: true }))).toBe(false);
        expect(shouldDisplayAvatar(message, makeBuffer({ special: true }))).toBe(false);
        expect(shouldDisplayAvatar(message, makeBuffer(), {
            repeat: true,
        })).toBe(false);
    });
});
