import Vue from 'vue';

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
