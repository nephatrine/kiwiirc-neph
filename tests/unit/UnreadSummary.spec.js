import { unreadSummary } from '@/helpers/UnreadSummary';

function buffer({ name = '#chan', unread = 0, highlight = false, error = false, hidden = false } = {}) {
    return {
        flags: {
            unread,
            highlight,
            error,
        },
        isSpecial: () => name.startsWith('*'),
        setting: (key) => {
            if (key === 'hide_message_counts') {
                return hidden;
            }
            return undefined;
        },
    };
}

describe('unread summary', () => {
    it('sums unread messages and counts highlights and errors', () => {
        const state = {
            networks: [{
                buffers: [
                    buffer({ unread: 2, highlight: true }),
                    buffer({ unread: 3 }),
                    buffer({ name: '*server', unread: 5 }),
                    buffer({ unread: 4, hidden: true }),
                    buffer({ unread: 1, error: true }),
                ],
            }],
        };

        expect(unreadSummary(state)).toEqual({
            unread: 6,
            highlights: 1,
            errors: 1,
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
