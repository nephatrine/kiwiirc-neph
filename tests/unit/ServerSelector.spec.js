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
        s.settings.kiwiServer = '/webirc/kiwiirc/';
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
        const reactiveConnection = Vue.observable(connection);
        vm = new Vue({
            el,
            render: (h) => h(ServerSelector, {
                props: Object.assign({
                    connection: reactiveConnection,
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

    it('supports a custom label for the preset picker', () => {
        s.settings.presetNetworks = [{
            name: 'Alpha',
            server: 'alpha.example.com',
            port: 6667,
            tls: false,
            direct: false,
            type: 'irc',
        }];
        const connection = {
            server: 'custom.example.com',
            port: 6667,
            tls: false,
            direct: false,
            path: '',
        };
        const comp = mount(connection, {
            usePreset: true,
            presetLabel: 'network',
        });

        const label = comp.$el.querySelector('label[for="kiwi_preset_server"]');
        expect(label).not.toBeNull();
        expect(label.textContent.trim()).toBe('network');
    });

    it('keeps gateway protocols available when a gateway is configured', () => {
        const connection = {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
            direct: false,
            path: '',
        };
        const comp = mount(connection);

        const options = Array.from(comp.$el.querySelectorAll('#kiwi_server_proto option'))
            .map((option) => option.value);
        expect(options).toEqual(['irc', 'ircs', 'ws', 'wss']);
        expect(comp.protocol).toBe('ircs');
        expect(connection.direct).toBe(false);
        expect(comp.$el.querySelector('.kiwi-serverselector-connection-tls')).not.toBeNull();
    });

    it('switches to a direct websocket when no gateway is configured', () => {
        s.settings.kiwiServer = '';
        const connection = {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
            direct: false,
            path: '',
        };
        const comp = mount(connection);

        const options = Array.from(comp.$el.querySelectorAll('#kiwi_server_proto option'))
            .map((option) => option.value);
        expect(options).toEqual(['ws', 'wss']);
        expect(comp.protocol).toBe('wss');
        expect(connection.direct).toBe(true);
        expect(connection.port).toBe(8097);
    });

    it('keeps IRC protocols for bouncer-managed connections without a gateway', () => {
        s.settings.kiwiServer = '';
        const connection = {
            server: 'bnc.example.com',
            port: 6697,
            tls: true,
            direct: false,
            path: '',
        };
        const comp = mount(connection, { ircOnly: true });

        const options = Array.from(comp.$el.querySelectorAll('#kiwi_server_proto option'))
            .map((option) => option.value);
        expect(options).toEqual(['irc', 'ircs']);
        expect(comp.protocol).toBe('ircs');
        expect(connection.direct).toBe(false);
    });

    it('normalises a pasted gateway URI without a gateway', () => {
        s.settings.kiwiServer = '';
        const connection = {
            server: '',
            port: 6667,
            tls: false,
            direct: false,
            path: '',
        };
        const comp = mount(connection);

        comp.onServerPaste({
            preventDefault: jest.fn(),
            clipboardData: {
                getData: () => 'irc://irc.example.com:6667',
            },
        });

        expect(connection.server).toBe('irc.example.com');
        expect(comp.protocol).toBe('ws');
        expect(connection.direct).toBe(true);
        expect(connection.port).toBe(8067);
    });

    it('normalises a gateway preset when no gateway is configured', () => {
        s.settings.kiwiServer = '';
        s.settings.presetNetworks = ['Gateway|irc://gateway.example.com:6667'];
        const connection = {
            server: '',
            port: 6667,
            tls: false,
            direct: false,
            path: '',
        };
        const comp = mount(connection, { usePreset: true });

        comp.presetServer = '0';

        expect(connection.server).toBe('gateway.example.com');
        expect(comp.protocol).toBe('ws');
        expect(connection.direct).toBe(true);
        expect(connection.port).toBe(8067);
    });
});
