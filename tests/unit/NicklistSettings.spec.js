import Nicklist from '@/components/Nicklist.vue';

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

describe('nicklist settings', () => {
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
