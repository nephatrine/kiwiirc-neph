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
    it('maps modes by name or prefix rank and sorts away users by privilege', () => {
        let buffer = makeBuffer();

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

        buffer = makeBuffer([
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

        buffer = makeBuffer();
        const online = makeUser('Online');
        const away = makeUser('Away', '', true);

        expect(nicklistGroupForUser(buffer, online, true)).toBe('users');
        expect(nicklistGroupForUser(buffer, away, true)).toBe('offline');
        expect(nicklistGroupForUser(buffer, away, false)).toBe('users');
        expect(nicklistGroupForUser(buffer, makeUser('AwayOp', 'o', true), true))
            .toBe('operator');
    });

    it('builds ordered headings and handles unsorted or empty lists', () => {
        let buffer = makeBuffer();
        let users = [
            makeUser('Owner', 'q'),
            makeUser('Online'),
            makeUser('Away', '', true),
        ];

        let items = buildNicklistGroups(buffer, users, true);

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

        users = [
            makeUser('Online'),
            makeUser('Away', '', true),
        ];
        items = buildNicklistGroups(buffer, users, false);

        expect(items.map((item) => item.id)).toEqual([
            'group-users',
            'user-Online',
            'user-Away',
        ]);
        expect(items[0].labelKey).toBe('nicklist_group_users');

        expect(buildNicklistGroups(buffer, [], true)).toEqual([]);
    });
});
