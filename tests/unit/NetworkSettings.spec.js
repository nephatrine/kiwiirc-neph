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
        window.Notification = { permission: 'granted' };

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
        delete window.Notification;
        delete window.confirm;
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

    it('shows network preferences only with multiple connected networks', async() => {
        const comp = mount();
        network.state = 'connected';
        await Vue.nextTick();

        expect(comp.$el.querySelector('.kiwi-networksettings-preferences')).toBeNull();

        s.addNetwork('OtherNet', 'other', {
            server: 'other.example.com',
        });
        await Vue.nextTick();

        expect(comp.$el.querySelector('.kiwi-networksettings-preferences')).not.toBeNull();

        network.state = 'disconnected';
        await Vue.nextTick();

        expect(comp.$el.querySelector('.kiwi-networksettings-preferences')).toBeNull();
    });

    it('renders per-network controls for the current network', async() => {
        s.addNetwork('OtherNet', 'other', {
            server: 'other.example.com',
        });
        network.state = 'connected';
        network.sasl_account = 'account';
        network.enabled_caps = [
            'draft/persistence',
            'message-tags',
            'draft/message-redaction',
            'draft/webpush',
        ];
        network.isupport.VAPID = 'key';
        network.isupport.BOT = 'B';
        network.persistence_status = { client: 'ON', effective: 'ON' };
        network.webpush_error = 'Nope';

        const comp = mount();
        const block = comp.$el.querySelector('.kiwi-networksettings-preferences');
        expect(block).not.toBeNull();
        expect(block.textContent).toContain('settings_persistence');
        expect(block.textContent).toContain('settings_share_typing');
        expect(block.textContent).toContain('settings_lenient_rerouting');
        expect(block.textContent).toContain('settings_ignore_bots');
        expect(block.textContent).toContain('settings_show_redactions');
        expect(block.textContent).toContain('settings_fileupload_service');
        expect(block.textContent).toContain('settings_show_notifications');
        expect(block.textContent).toContain('settings_webpush');
        expect(block.textContent).toContain('webpush_failed');
    });

    it('offers a per-network browser push reset', async() => {
        s.addNetwork('OtherNet', 'other', {
            server: 'other.example.com',
        });
        network.state = 'connected';
        network.sasl_account = 'account';
        network.enabled_caps = [
            'draft/persistence',
            'draft/webpush',
        ];
        network.isupport.VAPID = 'key';
        network.persistence_status = { client: 'ON', effective: 'ON' };
        network.webpush_error = 'Nope';
        network.resetWebpush = jest.fn();
        window.confirm = jest.fn(() => true);

        const comp = mount();
        const button = comp.$el.querySelector('.kiwi-appsettings-webpush-reset');
        expect(button).not.toBeNull();
        expect(button.textContent).toContain('webpush_reset');

        button.click();
        expect(network.resetWebpush).toHaveBeenCalled();

        delete window.confirm;
    });

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

    it('orders advanced settings and reveals raw inputs', async() => {
        const comp = mount();
        comp.show_advanced = true;
        await Vue.nextTick();

        const autorun = fieldByLabel(comp, 'settings_autorun');
        const checkboxes = comp.$el.querySelectorAll(
            '.kiwi-networksettings-advanced .kiwi-networksettings-option input[type="checkbox"]'
        );
        const showRaw = checkboxes[0];
        const encoding = fieldByLabel(comp, 'settings_encoding');
        const sasl = fieldByLabel(comp, 'settings_sasl_mechanism');

        expect(checkboxes).toHaveLength(1);
        expect(comp.$el.querySelector('.kiwi-networksettings-raw-scrollback')).toBeNull();
        expect(comp.$el.querySelector('.kiwi-networksettings-websocket-url')).toBeNull();
        expect(comp.$el.textContent).not.toContain('settings_raw_scrollback');

        expect(autorun.compareDocumentPosition(showRaw))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(showRaw.compareDocumentPosition(encoding))
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
        expect(websocketUrl).toBeNull();
    });

    it('shows the websocket path in the top server field', () => {
        network.connection.direct = true;
        network.connection.path = '/webirc';

        const comp = mount();
        const input = comp.$el.querySelector(
            '.kiwi-serverselector-connection-address input'
        );

        expect(input.value).toBe('irc.example.com/webirc');
    });

    it('updates the server path from the top server field', async() => {
        network.connection.direct = true;
        network.connection.path = '/webirc';

        const comp = mount();
        const input = comp.$el.querySelector(
            '.kiwi-serverselector-connection-address input'
        );

        input.value = 'irc.example.com/other';
        input.dispatchEvent(new Event('input'));
        await Vue.nextTick();

        expect(network.connection.server).toBe('irc.example.com');
        expect(network.connection.path).toBe('/other');
    });

    it('keeps the websocket path hidden for gateway connections', () => {
        network.connection.direct = false;
        network.connection.path = '/webirc';

        const comp = mount();
        const input = comp.$el.querySelector(
            '.kiwi-serverselector-connection-address input'
        );

        expect(input.value).toBe('irc.example.com');
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
