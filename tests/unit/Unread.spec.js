import {
    isBufferMuted,
    unreadBadgePolicy,
    unreadBadgesDisabled,
    unreadBadgesEnabled
} from '@/helpers/UnreadBadge';
import { unreadSummary } from '@/helpers/UnreadSummary';

describe('per-buffer unread badges', () => {
    function makeBuffer(settings = {}) {
        return { settings };
    }

    function makeState(unreadBadges = true) {
        return {
            setting: (key) => (key === 'unreadBadges' ? unreadBadges : undefined),
        };
    }

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

describe('unread summary', () => {
    function buffer({
        name = '#chan',
        unread = 0,
        highlight = false,
        error = false,
        unreadBadge,
    } = {}) {
        return {
            settings: unreadBadge ? { unread_badge: unreadBadge } : {},
            flags: {
                unread,
                highlight,
                error,
            },
            isSpecial: () => name.startsWith('*'),
        };
    }

    function makeState(unreadBadges, buffers) {
        return {
            setting: (key) => (key === 'unreadBadges' ? unreadBadges : undefined),
            networks: [{ buffers }],
        };
    }

    test('sums unread messages and applies the per-buffer badge policy', () => {
        let state = makeState(true, [
            buffer({ unread: 2, highlight: true }),
            buffer({ unread: 3 }),
            buffer({ name: '*server', unread: 5 }),
            buffer({ unread: 4, unreadBadge: 'hide' }),
            buffer({ unread: 1, error: true }),
        ]);

        expect(unreadSummary(state)).toEqual({
            unread: 6,
            highlights: 1,
            errors: 1,
        });

        state = makeState(false, [
            buffer({ unread: 2, highlight: true }),
            buffer({ unread: 3 }),
        ]);

        expect(unreadSummary(state)).toEqual({
            unread: 0,
            highlights: 0,
            errors: 0,
        });

        state = makeState(false, [
            buffer({ unread: 2, highlight: true }),
            buffer({ unread: 3, unreadBadge: 'show' }),
        ]);

        expect(unreadSummary(state)).toEqual({
            unread: 3,
            highlights: 0,
            errors: 0,
        });

        state = makeState(true, [
            buffer({ unread: 2, unreadBadge: 'hide' }),
            buffer({ unread: 3 }),
        ]);

        expect(unreadSummary(state)).toEqual({
            unread: 3,
            highlights: 0,
            errors: 0,
        });
    });

    test('handles an empty state', () => {
        expect(unreadSummary(null)).toEqual({
            unread: 0,
            highlights: 0,
            errors: 0,
        });
        expect(unreadSummary({ networks: [] })).toEqual({
            unread: 0,
            highlights: 0,
            errors: 0,
        });
    });
});
