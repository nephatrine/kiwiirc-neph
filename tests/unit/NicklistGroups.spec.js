import {
    buildNicklistGroups,
    nicklistGroupForUser
} from '@/helpers/NicklistGroups';

const PREFIXES = [
    { symbol: '~', mode: 'q' },
    { symbol: '&', mode: 'a' },
    { symbol: '@', mode: 'o' },
    { symbol: '%', mode: 'h' },
    { symbol: '+', mode: 'v' },
];

function makeBuffer(prefixes = PREFIXES) {
    return {
        userMode: (user) => user.mode || '',
        userPrefixes: () => prefixes,
    };
}

function makeUser(nick, mode, away) {
    return {
        id: nick,
        nick,
        mode,
        away: away ? 'away' : '',
    };
}

describe('nicklist groups', () => {
    it('maps known channel modes to privilege groups', () => {
        const buffer = makeBuffer();

        expect(nicklistGroupForUser(buffer, makeUser('Owner', 'q'), true))
            .toBe('owner');
        expect(nicklistGroupForUser(buffer, makeUser('Admin', 'a'), true))
            .toBe('operator');
        expect(nicklistGroupForUser(buffer, makeUser('Op', 'o'), true))
            .toBe('operator');
        expect(nicklistGroupForUser(buffer, makeUser('HalfOp', 'h'), true))
            .toBe('halfop');
        expect(nicklistGroupForUser(buffer, makeUser('Voiced', 'v'), true))
            .toBe('voiced');
    });

    it('falls back to prefix rank for unknown modes', () => {
        const buffer = makeBuffer([
            { symbol: '!', mode: 'Y' },
            { symbol: '@', mode: 'y' },
            { symbol: '%', mode: 'X' },
            { symbol: '+', mode: 'Z' },
        ]);

        expect(nicklistGroupForUser(buffer, makeUser('First', 'Y'), true))
            .toBe('owner');
        expect(nicklistGroupForUser(buffer, makeUser('Second', 'y'), true))
            .toBe('operator');
        expect(nicklistGroupForUser(buffer, makeUser('Third', 'X'), true))
            .toBe('halfop');
        expect(nicklistGroupForUser(buffer, makeUser('Fourth', 'Z'), true))
            .toBe('voiced');
    });

    it('separates unprivileged away users only when away sorting is enabled', () => {
        const buffer = makeBuffer();
        const online = makeUser('Online');
        const away = makeUser('Away', '', true);

        expect(nicklistGroupForUser(buffer, online, true)).toBe('users');
        expect(nicklistGroupForUser(buffer, away, true)).toBe('offline');
        expect(nicklistGroupForUser(buffer, away, false)).toBe('users');
    });

    it('keeps away privileged users in their privilege group', () => {
        const buffer = makeBuffer();

        expect(nicklistGroupForUser(buffer, makeUser('AwayOp', 'o', true), true))
            .toBe('operator');
    });

    it('builds ordered headings and omits empty groups', () => {
        const buffer = makeBuffer();
        const users = [
            makeUser('Owner', 'q'),
            makeUser('Online'),
            makeUser('Away', '', true),
        ];

        const items = buildNicklistGroups(buffer, users, true);

        expect(items.map((item) => item.id)).toEqual([
            'group-owner',
            'user-Owner',
            'group-online',
            'user-Online',
            'group-offline',
            'user-Away',
        ]);
        expect(items.filter((item) => item.type === 'heading').map((item) => item.labelKey))
            .toEqual([
                'nicklist_group_owner',
                'nicklist_group_online',
                'nicklist_group_offline',
            ]);
    });

    it('uses the Users heading and no Offline group when away sorting is off', () => {
        const buffer = makeBuffer();
        const users = [
            makeUser('Online'),
            makeUser('Away', '', true),
        ];

        const items = buildNicklistGroups(buffer, users, false);

        expect(items.map((item) => item.id)).toEqual([
            'group-users',
            'user-Online',
            'user-Away',
        ]);
        expect(items[0].labelKey).toBe('nicklist_group_users');
    });

    it('returns no items for an empty nicklist', () => {
        expect(buildNicklistGroups(makeBuffer(), [], true)).toEqual([]);
    });
});
