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
    test('resolves default, Hide, Show, and legacy settings', () => {
        const buffer = makeBuffer();
        expect(unreadBadgePolicy(buffer)).toBe('default');
        expect(unreadBadgesEnabled(buffer, makeState(true))).toBe(true);
        expect(unreadBadgesEnabled(buffer, makeState(false))).toBe(false);

        const hidden = makeBuffer({ unread_badge: 'hide' });
        const shown = makeBuffer({ unread_badge: 'show' });
        expect(unreadBadgePolicy(hidden)).toBe('hide');
        expect(unreadBadgesDisabled(hidden)).toBe(true);
        expect(unreadBadgesEnabled(hidden, makeState(true))).toBe(false);
        expect(unreadBadgePolicy(shown)).toBe('show');
        expect(unreadBadgesDisabled(shown)).toBe(false);
        expect(unreadBadgesEnabled(shown, makeState(false))).toBe(true);

        const legacy = makeBuffer({
            alert_on: 'never',
            hide_message_counts: true,
        });
        expect(unreadBadgePolicy(legacy)).toBe('default');
        expect(unreadBadgesDisabled(legacy)).toBe(false);
        expect(unreadBadgesEnabled(legacy, makeState(false))).toBe(false);
        expect(isBufferMuted(legacy)).toBe(false);
    });
});

describe('buffer muted state', () => {
    test('requires Never, Hide, and non-favorite independent of globals', () => {
        expect(isBufferMuted(makeBuffer({
            alert_on: 'never',
            unread_badge: 'hide',
            favorite: false,
        }))).toBe(true);
        expect(isBufferMuted(makeBuffer({
            alert_on: 'never',
            unread_badge: 'hide',
            favorite: true,
        }))).toBe(false);
        expect(isBufferMuted(makeBuffer({
            alert_on: 'never',
            unread_badge: 'show',
        }))).toBe(false);
        expect(isBufferMuted(makeBuffer({
            alert_on: 'message',
            unread_badge: 'hide',
        }))).toBe(false);

        const defaulted = makeBuffer({
            alert_on: 'never',
            unread_badge: 'default',
        });
        expect(isBufferMuted(defaulted)).toBe(false);
        expect(unreadBadgesEnabled(defaulted, makeState(false))).toBe(false);
    });
});
