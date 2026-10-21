/* eslint-disable no-underscore-dangle */
import Vue from 'vue';
import { TextEncoder } from 'util';
import state from '@/libs/state';
import ThemeManager from '@/libs/ThemeManager';
import UserBox from '@/components/UserBox';

global.__VERSION__ = 'test';
global.__COMMITHASH__ = 'test';

if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}

Vue.mixin({
    computed: {
        $t() {
            return (key) => key;
        },
    },
});

function mountUserBox(network, user) {
    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);

    const vm = new Vue({
        el: mountEl,
        render: (h) => h(UserBox, {
            props: {
                network,
                buffer: network.buffers[0],
                user,
                sidebarState: {},
            },
        }),
    });

    return vm;
}

describe('UserBox WHOIS action', () => {
    let s;

    beforeEach(() => {
        s = state.create();
        Vue.prototype.$state = s;
        ThemeManager.instance(s);
    });

    afterEach(() => {
        delete Vue.prototype.$state;
    });

    it('hides Show Details on Twitch networks', async() => {
        const network = s.addNetwork('Twitch', 'TestNick', {
            server: 'irc.chat.twitch.tv',
            port: 6697,
            tls: true,
        });
        network.state = 'connected';
        network.nick = 'TestNick';
        const user = s.addUser(network, { nick: 'Other' });

        const vm = mountUserBox(network, user);
        await Vue.nextTick();

        const comp = vm.$children[0];
        const actions = Array.from(comp.$el.querySelectorAll('.kiwi-userbox-action'));

        expect(comp.showWhoisButton).toBe(false);
        expect(actions.some((action) => action.textContent.includes('more_information')))
            .toBe(false);

        vm.$destroy();
        vm.$el.remove();
    });

    it('shows Show Details on non-Twitch networks', async() => {
        const network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        network.state = 'connected';
        network.nick = 'TestNick';
        const user = s.addUser(network, { nick: 'Other' });

        const vm = mountUserBox(network, user);
        await Vue.nextTick();

        const comp = vm.$children[0];
        const actions = Array.from(comp.$el.querySelectorAll('.kiwi-userbox-action'));

        expect(comp.showWhoisButton).toBe(true);
        expect(actions.some((action) => action.textContent.includes('more_information')))
            .toBe(true);

        vm.$destroy();
        vm.$el.remove();
    });

    it('does not send WHOIS from the profile action on Twitch', () => {
        const whois = jest.fn();
        const context = {
            network: {
                isTwitch: () => true,
                ircClient: { whois },
            },
            user: { nick: 'Other' },
            whoisRequested: false,
            whoisLoading: false,
        };

        UserBox.methods.updateWhoisData.call(context);

        expect(whois).not.toHaveBeenCalled();
        expect(context.whoisRequested).toBe(false);
    });
});
