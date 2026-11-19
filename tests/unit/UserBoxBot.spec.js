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

describe('UserBox bot badge', () => {
    let s;

    beforeEach(() => {
        s = state.create();
        Vue.prototype.$state = s;
        ThemeManager.instance(s);
    });

    afterEach(() => {
        delete Vue.prototype.$state;
    });

    function createBot(metadata) {
        const network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        network.state = 'connected';
        network.nick = 'TestNick';
        const user = s.addUser(network, { nick: 'BotUser', is_bot: true });
        if (metadata) {
            Vue.set(user.metadata, 'bot', metadata);
        }
        return { network, user };
    }

    it('shows the floppy icon with bot metadata or the generic label', async() => {
        let { network, user } = createBot('Sopel 8.0');
        let vm = mountUserBox(network, user);
        await Vue.nextTick();

        let bot = vm.$children[0].$el.querySelector('.kiwi-userbox-bot');
        expect(bot.querySelector('.bx-save')).toBeTruthy();
        expect(bot.textContent).toContain('Sopel 8.0');
        expect(bot.getAttribute('title')).toBeNull();

        vm.$destroy();
        vm.$el.remove();

        ({ network, user } = createBot('   '));
        vm = mountUserBox(network, user);
        await Vue.nextTick();

        bot = vm.$children[0].$el.querySelector('.kiwi-userbox-bot');
        expect(bot.querySelector('.bx-save')).toBeTruthy();
        expect(bot.textContent).toContain('bot_user');
        expect(bot.getAttribute('title')).toBeNull();

        vm.$destroy();
        vm.$el.remove();
    });

    it('fetches bot metadata when the user box opens', async() => {
        const { network, user } = createBot();
        network.enabled_caps = ['draft/metadata-3'];
        network.getMetadata = jest.fn();

        const vm = mountUserBox(network, user);
        await Vue.nextTick();

        expect(network.getMetadata).toHaveBeenCalled();
        expect(network.getMetadata.mock.calls[0][1]).toContain('bot');

        vm.$destroy();
        vm.$el.remove();
    });
});
