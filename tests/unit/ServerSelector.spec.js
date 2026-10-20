import Vue from 'vue';
import state from '@/libs/state';
import '@/components/utils/InputText';
import '@/components/utils/TransitionExpand';
import ServerSelector from '@/components/ServerSelector';

Vue.mixin({
    computed: {
        $t() {
            return (key) => key;
        },
    },
});

describe('ServerSelector', () => {
    let s;
    let vm;

    beforeEach(() => {
        s = state.create();
        s.settings.presetNetworks = [];
        Vue.prototype.$state = s;
    });

    afterEach(() => {
        if (vm) {
            vm.$destroy();
            if (vm.$el.parentNode) {
                vm.$el.parentNode.removeChild(vm.$el);
            }
            vm = null;
        }
        delete Vue.prototype.$state;
    });

    function mount(connection, props = {}) {
        const el = document.createElement('div');
        document.body.appendChild(el);
        vm = new Vue({
            el,
            render: (h) => h(ServerSelector, {
                props: Object.assign({
                    connection,
                    usePreset: false,
                }, props),
            }),
        });
        return vm.$children[0];
    }

    it('limits bouncer-managed connections to the IRC protocols', () => {
        const connection = {
            server: 'irc.example.com',
            port: 6667,
            tls: false,
            direct: true,
            path: '',
        };
        const comp = mount(connection, { ircOnly: true });

        const options = Array.from(comp.$el.querySelectorAll('#kiwi_server_proto option'))
            .map((option) => option.value);
        expect(options).toEqual(['irc', 'ircs']);
        expect(comp.$el.querySelector('.kiwi-serverselector-connection-tls')).toBeNull();

        comp.protocol = 'ircs';

        expect(connection.tls).toBe(true);
        expect(connection.direct).toBe(true);
        expect(connection.port).toBe(6697);
    });

    it('defaults an unset bouncer port from the TLS setting', () => {
        const connection = {
            server: 'irc.example.com',
            port: 0,
            tls: true,
            direct: false,
            path: '',
        };
        const comp = mount(connection, { ircOnly: true });

        expect(comp.protocol).toBe('ircs');
        expect(connection.port).toBe(6697);
    });

    it('keeps the websocket protocols available outside bouncer mode', () => {
        const connection = {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
            direct: true,
            path: '',
        };
        const comp = mount(connection);

        const options = Array.from(comp.$el.querySelectorAll('#kiwi_server_proto option'))
            .map((option) => option.value);
        expect(options).toEqual(['irc', 'ircs', 'ws', 'wss']);
        expect(comp.$el.querySelector('.kiwi-serverselector-connection-tls')).not.toBeNull();
    });
});
