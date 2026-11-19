import Vue from 'vue';
import {
    buildNicklistGroups,
    nicklistGroupForUser
} from '@/helpers/NicklistGroups';
import Nicklist from '@/components/Nicklist.vue';

jest.mock('@/components/UserAvatar', () => ({
    render: (h) => h('div'),
}));
jest.mock('@/components/AwayStatusIndicator', () => ({
    render: (h) => h('div'),
}));
jest.mock('@/components/TypingStatusIndicator', () => ({
    render: (h) => h('div'),
}));

import NicklistUser from '@/components/NicklistUser';

Vue.prototype.$t = (key) => key;

describe('nicklist groups', () => {
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
        const buffer = makeBuffer();
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

describe('nicklist settings', () => {
    function makeContext({ hideIgnored = true, showColors = true } = {}) {
        const users = {
            ALICE: {
                nick: 'Alice',
                ignore: false,
                away: '',
                buffers: { 1: { buffer: {} } },
            },
            BOB: {
                nick: 'Bob',
                ignore: true,
                away: '',
                buffers: { 1: { buffer: {} } },
            },
        };
        const buffer = {
            id: 1,
            users,
            userPrefixes: () => [],
            userModes: () => [],
            userMode: () => '',
        };
        return {
            buffer,
            userFilter: '',
            $state: {
                setting: (key) => {
                    if (key === 'hideIgnored') {
                        return hideIgnored;
                    }
                    if (key === 'showColors') {
                        return showColors;
                    }
                    return false;
                },
            },
        };
    }

    it('hides ignored users by default and shows them when disabled', () => {
        let context = makeContext();

        expect(Nicklist.computed.sortedUsers.call(context).map((user) => user.nick))
            .toEqual(['Alice']);
        expect(Nicklist.computed.allUsersCount.call(context)).toBe(1);

        context = makeContext({ hideIgnored: false });

        expect(Nicklist.computed.sortedUsers.call(context).map((user) => user.nick))
            .toEqual(['Alice', 'Bob']);
        expect(Nicklist.computed.allUsersCount.call(context)).toBe(2);
    });

    it('uses the global showColors setting for nick colours', () => {
        expect(Nicklist.computed.useColouredNicks.call(makeContext()))
            .toBe(true);
        expect(Nicklist.computed.useColouredNicks.call(makeContext({ showColors: false })))
            .toBe(false);
    });
});

describe('nicklist user prefix colour', () => {
    afterAll(() => {
        delete Vue.prototype.$t;
    });

    function mountEl({ coloured, prefix }) {
        const user = {
            nick: 'Ankle',
            account: 'ankle',
            is_bot: false,
            ignore: false,
            isAway: () => false,
            isOffline: () => false,
            displayName: () => 'Ankle',
            displayTooltip: () => '',
            statusMessage: () => '',
            typingStatus: () => ({ status: '' }),
            getColour: () => 'rgb(1, 2, 3)',
        };
        const nicklist = {
            useColouredNicks: coloured,
            shouldShowAvatars: false,
            avatarProps: {},
            buffer: {
                name: '#chan',
                userMode: () => 'o',
                userModePrefix: () => prefix,
            },
            openQuery: () => {},
            openUserbox: () => {},
        };
        const vm = new Vue({
            el: document.createElement('div'),
            render: (h) => h(NicklistUser, {
                props: { network: {}, user, nicklist },
            }),
        });
        const el = vm.$children[0].$el;
        vm.$destroy();
        return el;
    }

    it('colours the mode prefix with the nick, or leaves both plain when off', () => {
        let el = mountEl({ coloured: true, prefix: '@' });
        let prefixEl = el.querySelector('.kiwi-nicklist-user-prefix');
        let nickEl = el.querySelector('.kiwi-nicklist-user-nick');
        expect(prefixEl.textContent).toBe('@');
        expect(prefixEl.style.color).toBe('rgb(1, 2, 3)');
        expect(prefixEl.style.color).toBe(nickEl.style.color);

        el = mountEl({ coloured: false, prefix: '@' });
        prefixEl = el.querySelector('.kiwi-nicklist-user-prefix');
        nickEl = el.querySelector('.kiwi-nicklist-user-nick');
        expect(prefixEl.style.color).toBe('');
        expect(nickEl.style.color).toBe('');
    });
});
