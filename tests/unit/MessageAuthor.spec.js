import { messageHostName, shouldShowHostName } from '@/helpers/MessageAuthor';

function makeBuffer(settings = {}) {
    return {
        setting: (name) => settings[name],
    };
}

function makeMessage(user) {
    return { user };
}

describe('message author host names', () => {
    test('formats ident@host', () => {
        expect(messageHostName(makeMessage({
            username: 'ident',
            host: 'example.com',
        }))).toBe('ident@example.com');
    });

    test('supports alternate user field names', () => {
        expect(messageHostName(makeMessage({
            ident: 'ident',
            hostname: 'example.com',
        }))).toBe('ident@example.com');
    });

    test('requires both ident and host', () => {
        expect(messageHostName(makeMessage({ username: 'ident' }))).toBe('');
        expect(messageHostName(makeMessage({ host: 'example.com' }))).toBe('');
        expect(messageHostName(makeMessage(null))).toBe('');
    });

    test('shows only when host names are enabled and real names are off', () => {
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
    });

    test('does not show without a user host', () => {
        expect(shouldShowHostName(makeMessage(null), makeBuffer({
            show_hostnames: true,
            show_realnames: false,
        }))).toBe(false);

        expect(shouldShowHostName(makeMessage({ username: 'ident' }), makeBuffer({
            show_hostnames: true,
            show_realnames: false,
        }))).toBe(false);
    });
});
