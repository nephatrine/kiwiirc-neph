import {
    isBufferMuted,
    unreadBadgePolicy,
    unreadBadgesDisabled,
    unreadBadgesEnabled
} from '@/helpers/UnreadBadge';

function makeBuffer(settings = {}) {
    return { settings };
}

function makeState(unreadBadges = true) {
    return {
        setting: (key) => (key === 'unreadBadges' ? unreadBadges : undefined),
    };
}

describe('per-buffer unread badges', () => {
    test('defaults to the global unread badge setting', () => {
        const buffer = makeBuffer();

        expect(unreadBadgePolicy(buffer)).toBe('default');
        expect(unreadBadgesEnabled(buffer, makeState(true))).toBe(true);
        expect(unreadBadgesEnabled(buffer, makeState(false))).toBe(false);
    });

    test('supports explicit Hide and Show overrides', () => {
        const hidden = makeBuffer({ unread_badge: 'hide' });
        const shown = makeBuffer({ unread_badge: 'show' });

        expect(unreadBadgePolicy(hidden)).toBe('hide');
        expect(unreadBadgesDisabled(hidden)).toBe(true);
        expect(unreadBadgesEnabled(hidden, makeState(true))).toBe(false);

        expect(unreadBadgePolicy(shown)).toBe('show');
        expect(unreadBadgesDisabled(shown)).toBe(false);
        expect(unreadBadgesEnabled(shown, makeState(false))).toBe(true);
    });

    test('does not use legacy hide_message_counts', () => {
        const buffer = makeBuffer({
            alert_on: 'never',
            hide_message_counts: true,
        });

        expect(unreadBadgePolicy(buffer)).toBe('default');
        expect(unreadBadgesDisabled(buffer)).toBe(false);
        expect(unreadBadgesEnabled(buffer, makeState(false))).toBe(false);
        expect(isBufferMuted(buffer)).toBe(false);
    });
});

describe('buffer muted state', () => {
    test('requires Never, Hide, and not favorite', () => {
        const muted = makeBuffer({
            alert_on: 'never',
            unread_badge: 'hide',
            favorite: false,
        });

        expect(isBufferMuted(muted)).toBe(true);
    });

    test('is not muted when favorited', () => {
        const buffer = makeBuffer({
            alert_on: 'never',
            unread_badge: 'hide',
            favorite: true,
        });

        expect(isBufferMuted(buffer)).toBe(false);
    });

    test('is not muted when badges are shown', () => {
        const buffer = makeBuffer({
            alert_on: 'never',
            unread_badge: 'show',
        });

        expect(isBufferMuted(buffer)).toBe(false);
    });

    test('is not muted without Never', () => {
        const buffer = makeBuffer({
            alert_on: 'message',
            unread_badge: 'hide',
        });

        expect(isBufferMuted(buffer)).toBe(false);
    });

    test('does not depend on the global unread badge setting', () => {
        const buffer = makeBuffer({
            alert_on: 'never',
            unread_badge: 'default',
        });

        expect(isBufferMuted(buffer)).toBe(false);
        expect(unreadBadgesEnabled(buffer, makeState(false))).toBe(false);
    });
});
