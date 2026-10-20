import Vue from 'vue';
import { TextEncoder } from 'util';
import state from '@/libs/state';
import '@/components/utils/InputText';
import '@/components/utils/TransitionExpand';
import NetworkSettings from '@/components/NetworkSettings';

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

describe('NetworkSettings server details', () => {
    let s;
    let network;
    let vm;

    beforeEach(() => {
        s = state.create();
        s.settings.restricted = false;
        Vue.prototype.$state = s;

        network = s.addNetwork('TestNet', 'nick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        network.connection.nick = 'nick';
        network.username = 'ident';
        network.gecos = 'Real Name';
    });

    afterEach(() => {
        if (vm) {
            vm.$destroy();
            if (vm.$el.parentNode) {
                vm.$el.parentNode.removeChild(vm.$el);
            }
        }
        delete Vue.prototype.$state;
    });

    function mount() {
        const mountEl = document.createElement('div');
        document.body.appendChild(mountEl);
        vm = new Vue({
            el: mountEl,
            render: (h) => h(NetworkSettings, {
                props: {
                    network: network,
                },
            }),
        });
        return vm.$children[0];
    }

    function fieldByLabel(comp, label) {
        const fields = Array.from(comp.$el.querySelectorAll('.u-input-text'));
        const field = fields.find((el) => el.textContent.indexOf(label) !== -1);
        return field ?
            field.querySelector('input, select, textarea') :
            null;
    }

    it('locks only network details in restricted mode', async() => {
        s.settings.restricted = true;
        network.connection.account = 'account';
        network.password = 'sasl-pass';
        const comp = mount();

        expect(fieldByLabel(comp, 'network_name').disabled).toBe(true);
        expect(comp.$el.querySelector('#kiwi_server_proto').disabled).toBe(true);
        expect(fieldByLabel(comp, 'nick_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'user_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'real_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'server_password').disabled).toBe(false);
        expect(fieldByLabel(comp, 'sasl_user').disabled).toBe(false);

        comp.show_advanced = true;
        await Vue.nextTick();
        expect(fieldByLabel(comp, 'settings_encoding').disabled).toBe(true);

        network.state = 'connected';
        network.enabled_caps = ['setname'];
        await Vue.nextTick();

        expect(fieldByLabel(comp, 'network_name').disabled).toBe(true);
        expect(fieldByLabel(comp, 'nick_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'real_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'user_name').disabled).toBe(true);
        expect(fieldByLabel(comp, 'server_password').disabled).toBe(true);
        expect(fieldByLabel(comp, 'sasl_user').disabled).toBe(true);
        expect(fieldByLabel(comp, 'settings_encoding').disabled).toBe(true);
    });

    it('orders advanced settings and reveals conditional inputs', async() => {
        const comp = mount();
        comp.show_advanced = true;
        await Vue.nextTick();

        const autorun = fieldByLabel(comp, 'settings_autorun');
        const checkboxes = comp.$el.querySelectorAll(
            '.kiwi-networksettings-advanced .kiwi-networksettings-option input[type="checkbox"]'
        );
        const showRaw = checkboxes[0];
        const webSocket = checkboxes[1];
        const encoding = fieldByLabel(comp, 'settings_encoding');
        const sasl = fieldByLabel(comp, 'settings_sasl_mechanism');

        expect(comp.$el.querySelector('.kiwi-networksettings-raw-scrollback')).toBeNull();
        expect(comp.$el.querySelector('.kiwi-networksettings-websocket-url')).toBeNull();
        expect(comp.$el.textContent).not.toContain('settings_raw_scrollback');

        expect(autorun.compareDocumentPosition(showRaw))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(showRaw.compareDocumentPosition(webSocket))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(webSocket.compareDocumentPosition(encoding))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(encoding.compareDocumentPosition(sasl))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);

        comp.settingShowRaw = true;
        network.connection.direct = true;
        await Vue.nextTick();

        const rawScrollback = comp.$el.querySelector(
            '.kiwi-networksettings-raw-scrollback input'
        );
        const websocketUrl = comp.$el.querySelector(
            '.kiwi-networksettings-websocket-url input'
        );
        expect(rawScrollback).not.toBeNull();
        expect(rawScrollback.type).toBe('number');
        expect(rawScrollback.title).toBe('settings_raw_scrollback');
        expect(websocketUrl).not.toBeNull();
    });

    it('keeps disconnected details editable and hides SASL once connected without it', async() => {
        const comp = mount();

        expect(fieldByLabel(comp, 'nick_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'user_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'real_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'server_password').disabled).toBe(false);
        expect(fieldByLabel(comp, 'sasl_user').disabled).toBe(false);

        network.state = 'connected';
        network.enabled_caps = [];
        await Vue.nextTick();

        expect(fieldByLabel(comp, 'sasl_user')).toBeNull();
        expect(fieldByLabel(comp, 'nick_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'real_name').disabled).toBe(true);
        expect(fieldByLabel(comp, 'user_name').disabled).toBe(true);
        expect(fieldByLabel(comp, 'server_password').disabled).toBe(true);

        network.enabled_caps = ['setname'];
        await Vue.nextTick();

        expect(fieldByLabel(comp, 'real_name').disabled).toBe(false);
    });

    it('uses one color variant per action button', async() => {
        const comp = mount();
        let button = comp.$el.querySelector('.kiwi-connect-to-newnetwork');

        expect(button.classList.contains('u-button-online')).toBe(true);
        expect(button.classList.contains('u-button-primary')).toBe(false);
        expect(button.classList.contains('u-button-warning')).toBe(false);

        network.state = 'connected';
        await Vue.nextTick();

        button = comp.$el.querySelector('.kiwi-connect-to-newnetwork');
        expect(button.classList.contains('u-button-warning')).toBe(true);
        expect(button.classList.contains('u-button-primary')).toBe(false);
        expect(button.classList.contains('u-button-online')).toBe(false);
    });

    it('keeps bouncer-managed details editable and limits protocols to IRC', () => {
        network.connection.bncnetid = '1';
        network.state = 'connected';
        network.connection.account = 'account';
        network.password = 'sasl-pass';
        const comp = mount();

        expect(fieldByLabel(comp, 'network_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'nick_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'user_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'real_name').disabled).toBe(false);
        expect(fieldByLabel(comp, 'server_password').disabled).toBe(false);
        expect(fieldByLabel(comp, 'sasl_user').disabled).toBe(false);
        expect(fieldByLabel(comp, 'sasl_user').value).toBe('account');

        const options = Array.from(
            comp.$el.querySelectorAll('#kiwi_server_proto option')
        ).map((option) => option.value);
        expect(options).toEqual(['irc', 'ircs']);
        const save = comp.$el.querySelector('.kiwi-networksettings-save');
        const connect = comp.$el.querySelector('.kiwi-connect-to-newnetwork');
        expect(save).not.toBeNull();
        expect(save.classList.contains('u-button-primary')).toBe(true);
        expect(save.classList.contains('u-button-online')).toBe(false);
        expect(save.classList.contains('u-button-warning')).toBe(false);
        expect(connect.classList.contains('u-button-online')).toBe(true);
        expect(connect.classList.contains('u-button-primary')).toBe(false);
        expect(connect.classList.contains('u-button-warning')).toBe(false);
        expect(
            comp.$el.querySelector('.kiwi-networksettings-bouncer-sasl-warning')
        ).not.toBeNull();
    });

    it('applies nick and real name on blur for connected normal networks', () => {
        network.state = 'connected';
        network.enabled_caps = ['setname', 'labeled-response'];
        network.connection.nick = 'newnick';
        network.gecos = 'New Name';
        network.currentUser = () => ({ nick: 'oldnick' });

        const changeNick = jest.fn();
        const raw = jest.fn();
        network.ircClient.changeNick = changeNick;
        network.ircClient.raw = raw;

        const comp = mount();
        comp.applyNick();
        comp.applyRealName();

        expect(changeNick).toHaveBeenCalledWith('newnick');
        expect(raw).toHaveBeenCalledTimes(1);
        expect(raw.mock.calls[0][0].command).toBe('SETNAME');
        expect(raw.mock.calls[0][0].params).toContain('New Name');
    });

    it('marks an invalid nick', () => {
        network.connection.nick = 'bad nick';
        const comp = mount();
        const input = fieldByLabel(comp, 'nick_name');

        expect(
            input.closest('.u-input-text').classList.contains('kiwi-networksettings-invalid')
        ).toBe(true);
    });
});
