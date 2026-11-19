import { unreadSummary } from '@/helpers/UnreadSummary';

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

describe('unread summary', () => {
    it('sums unread messages and applies the per-buffer badge policy', () => {
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

    it('handles an empty state', () => {
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
