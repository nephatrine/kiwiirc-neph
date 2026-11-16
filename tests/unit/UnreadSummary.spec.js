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
    it('sums unread messages and counts highlights and errors', () => {
        const state = makeState(true, [
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
    });

    it('returns no unread badges when globally disabled and buffers use Default', () => {
        const state = makeState(false, [
            buffer({ unread: 2, highlight: true }),
            buffer({ unread: 3 }),
        ]);

        expect(unreadSummary(state)).toEqual({
            unread: 0,
            highlights: 0,
            errors: 0,
        });
    });

    it('includes buffers explicitly set to Show', () => {
        const state = makeState(false, [
            buffer({ unread: 2, highlight: true }),
            buffer({ unread: 3, unreadBadge: 'show' }),
        ]);

        expect(unreadSummary(state)).toEqual({
            unread: 3,
            highlights: 0,
            errors: 0,
        });
    });

    it('excludes buffers explicitly set to Hide', () => {
        const state = makeState(true, [
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
