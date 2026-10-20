import Vue from 'vue';
import { TextEncoder } from 'util';
import state from '@/libs/state';
import '@/components/utils/InputText';
import Bouncer from '@/components/startups/Bouncer';
import { probeServerCaps } from '@/libs/ServerProbe';

if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}

jest.mock('@/libs/ServerProbe', () => ({
    probeServerCaps: jest.fn(),
    createProbeTransport: jest.fn(() => ({})),
}));

jest.mock('@/libs/BouncerProvider', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(function() {
        this.enable = jest.fn();
        this.bnc = {};
    }),
}));

jest.mock('@/libs/IrcClient', () => {
    const actual = jest.requireActual('@/libs/IrcClient');
    return {
        ...actual,
        create: (...args) => {
            const client = actual.create(...args);
            client.connect = jest.fn();
            return client;
        },
    };
});

Vue.mixin({
    computed: {
        $t() {
            return (key) => key;
        },
    },
});

function probeInfo(caps) {
    return {
        caps: caps,
        isupport: {},
        extendedIsupport: false,
        capsComplete: true,
    };
}

function flushPromises() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

describe('Bouncer startup tabs', () => {
    let s;
    let comp;
    let vm;

    beforeEach(() => {
        s = state.create();
        Vue.prototype.$state = s;
        probeServerCaps.mockReset();
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

    function fieldTitles() {
        return [...comp.$el.querySelectorAll('input[title]')].map((el) => el.title);
    }

    function mount(options) {
        s.settings.startupOptions = Object.assign(
            { server: 'bnc.example.com' },
            options || {}
        );
        const mountEl = document.createElement('div');
        document.body.appendChild(mountEl);
        vm = new Vue({
            el: mountEl,
            render: (h) => h(Bouncer),
        });
        comp = vm.$children[0];
    }

    it('shows BNC and Account when probing is disabled', () => {
        mount({});
        expect(comp.showBncTab).toBe(true);
        expect(comp.showAccountTab).toBe(true);
        expect(comp.showRegisterTab).toBe(false);
        expect(comp.activeTab).toBe('account');
        expect(probeServerCaps).not.toHaveBeenCalled();
    });

    it('shows both tabs when the probe cannot complete', async() => {
        probeServerCaps.mockResolvedValue({
            caps: {},
            isupport: {},
            extendedIsupport: false,
            capsComplete: false,
        });
        mount({ probeServerCaps: true });
        await flushPromises();

        expect(comp.probeComplete).toBe(false);
        expect(comp.showBncTab).toBe(true);
        expect(comp.showAccountTab).toBe(true);
        expect(comp.activeTab).toBe('account');
    });

    it('treats a valueless sasl cap as available and hides BNC', async() => {
        probeServerCaps.mockResolvedValue(probeInfo({
            'sasl': '',
            'draft/bouncer-networks': '',
        }));
        mount({ probeServerCaps: true });
        await flushPromises();

        expect(comp.hasSasl).toBe(true);
        expect(comp.showBncTab).toBe(false);
        expect(comp.showAccountTab).toBe(true);
        expect(comp.activeTab).toBe('account');
    });

    it('hides Account and selects BNC when the probe lacks sasl', async() => {
        probeServerCaps.mockResolvedValue(probeInfo({
            'draft/bouncer-networks': '',
        }));
        mount({ probeServerCaps: true });
        await flushPromises();

        expect(comp.showBncTab).toBe(true);
        expect(comp.showAccountTab).toBe(false);
        expect(comp.activeTab).toBe('bnc');
    });

    it('refuses a complete probe without a bouncer-networks cap', async() => {
        probeServerCaps.mockResolvedValue(probeInfo({ sasl: 'PLAIN' }));
        mount({ probeServerCaps: true });
        await flushPromises();

        expect(comp.bouncerUnsupported).toBe(true);
        expect(comp.$el.querySelectorAll('input')).toHaveLength(0);
        expect(comp.$el.textContent).toContain('bouncer_networks_required');
    });

    it('offers Register only with before-connect registration', async() => {
        probeServerCaps.mockResolvedValue(probeInfo({
            'sasl': 'PLAIN',
            'draft/bouncer-networks': '',
            'draft/account-registration': 'before-connect',
        }));
        mount({ probeServerCaps: true });
        await flushPromises();

        expect(comp.showRegisterTab).toBe(true);
        expect(comp.probeRegInfo.beforeConnect).toBe(true);
    });

    it('does not offer Register for a cap without before-connect', async() => {
        probeServerCaps.mockResolvedValue(probeInfo({
            'sasl': 'PLAIN',
            'draft/bouncer-networks': '',
            'draft/account-registration': 'custom-account-name',
        }));
        mount({ probeServerCaps: true });
        await flushPromises();

        expect(comp.showRegisterTab).toBe(false);
    });

    it('keeps each tab\'s fields independent', async() => {
        mount({});
        comp.tabs.bnc.user = 'bnc-user';
        comp.tabs.bnc.password = 'bnc-pass';
        comp.tabs.account.user = 'account-user';
        comp.tabs.account.password = 'account-pass';

        comp.activeTab = 'bnc';
        await comp.$nextTick();
        expect(comp.fields.user).toBe('bnc-user');
        expect(comp.fields.password).toBe('bnc-pass');

        comp.activeTab = 'account';
        await comp.$nextTick();
        expect(comp.fields.user).toBe('account-user');
        expect(comp.fields.password).toBe('account-pass');
    });

    it('labels the BNC and Account fields', async() => {
        mount({});
        comp.activeTab = 'bnc';
        await comp.$nextTick();
        expect(fieldTitles()).toEqual([
            'user_name',
            'server_password',
        ]);
        expect(comp.$el.querySelector('.u-input-text-plaintext').title)
            .toBe('server_password');

        comp.activeTab = 'account';
        await comp.$nextTick();
        expect(fieldTitles()).toEqual([
            'account_name',
            'account_password',
        ]);
    });

    it('labels the Register fields', async() => {
        probeServerCaps.mockResolvedValue(probeInfo({
            'sasl': 'PLAIN',
            'draft/bouncer-networks': '',
            'draft/account-registration': 'before-connect',
        }));
        mount({ probeServerCaps: true });
        await flushPromises();

        comp.activeTab = 'register';
        await comp.$nextTick();
        expect(fieldTitles()).toEqual([
            'account_name',
            'account_password',
        ]);
    });

    it('maps BNC credentials to USER and server PASS with a stripped nick', () => {
        mount({});
        comp.activeTab = 'bnc';
        comp.tabs.bnc.user = 'BncUser@example.com';
        comp.tabs.bnc.password = 'server-pass';

        expect(comp.formReady).toBe(true);
        comp.startUp();

        const net = s.networks[0];
        expect(net.username).toBe('BncUser@example.com');
        expect(net.connection.nick).toBe('BncUser');
        expect(net.connection.password).toBe('server-pass');
        expect(net.connection.account).toBe('');
        expect(net.password).toBe('');
        expect(net.ircClient.connect).toHaveBeenCalled();
    });

    it('maps Account credentials to SASL with an advanced server PASS', () => {
        mount({});
        comp.activeTab = 'account';
        comp.tabs.account.user = 'Account@example.com';
        comp.tabs.account.password = 'sasl-secret';
        comp.tabs.account.serverPassword = 'server-pass';

        expect(comp.formReady).toBe(true);
        comp.startUp();

        const net = s.networks[0];
        expect(net.connection.account).toBe('Account@example.com');
        expect(net.password).toBe('sasl-secret');
        expect(net.connection.password).toBe('server-pass');
        expect(net.username).toBe('');
        expect(net.connection.nick).toBe('Account');
    });

    it('arms registration before connecting and never stores its password', async() => {
        probeServerCaps.mockResolvedValue(probeInfo({
            'sasl': 'PLAIN',
            'draft/bouncer-networks': '',
            'draft/account-registration': 'before-connect',
        }));
        mount({ probeServerCaps: true });
        await flushPromises();

        comp.activeTab = 'register';
        comp.tabs.register.user = 'NewUser';
        comp.tabs.register.password = 'register-secret';
        comp.tabs.register.email = 'new@example.com';
        comp.tabs.register.serverPassword = 'server-pass';
        await comp.$nextTick();

        const existing = s.addNetwork('BNC', 'OldUser', {});
        existing.is_bnc = true;
        existing.connection.nick = 'OldUser';
        const ircClient = existing.ircClient;
        const arm = jest.spyOn(existing, 'armPreConnectRegistration');

        expect(comp.formReady).toBe(true);
        comp.startUp();

        expect(arm).toHaveBeenCalledWith('*', 'new@example.com', 'register-secret');
        expect(existing.connection.nick).toBe('NewUser');
        expect(existing.connection.account).toBe('');
        expect(existing.connection.password).toBe('server-pass');
        expect(existing.password).toBe('');
        expect(comp.tabs.register.password).toBe('');
        expect(ircClient.connect).toHaveBeenCalled();
    });

    it('uses the typed account for registration with custom-account-name', async() => {
        probeServerCaps.mockResolvedValue(probeInfo({
            'sasl': 'PLAIN',
            'draft/bouncer-networks': '',
            'draft/account-registration': 'before-connect,custom-account-name',
        }));
        mount({ probeServerCaps: true });
        await flushPromises();

        comp.activeTab = 'register';
        comp.tabs.register.user = 'custom-account';
        comp.tabs.register.password = 'register-secret';
        comp.tabs.register.email = 'new@example.com';
        await comp.$nextTick();

        const existing = s.addNetwork('BNC', 'OldUser', {});
        existing.is_bnc = true;
        existing.connection.nick = 'OldUser';
        const ircClient = existing.ircClient;
        const arm = jest.spyOn(existing, 'armPreConnectRegistration');

        comp.startUp();
        expect(arm).toHaveBeenCalledWith(
            'custom-account',
            'new@example.com',
            'register-secret'
        );
        expect(existing.connection.nick).toBe('custom-account');
        expect(ircClient.connect).toHaveBeenCalled();
    });

    it('disables Remember Password(s) on BNC until a password is entered', async() => {
        mount({});
        comp.activeTab = 'bnc';
        comp.tabs.bnc.rememberPasswords = true;
        await comp.$nextTick();
        expect(comp.rememberPasswordDisabled).toBe(true);
        expect(comp.layoutRememberPasswords).toBe(false);

        comp.tabs.bnc.password = 'server-pass';
        await comp.$nextTick();
        expect(comp.rememberPasswordDisabled).toBe(false);
        expect(comp.layoutRememberPasswords).toBe(true);

        comp.tabs.bnc.rememberSettings = false;
        await comp.$nextTick();
        expect(comp.layoutRememberPasswords).toBe(false);
    });

    it('restores remembered Account credentials from the control connection', () => {
        s.user_settings.remember_password = true;
        const controller = s.addNetwork('BNC', 'Nick', { account: 'SavedAccount' });
        controller.is_bnc = true;
        controller.password = 'saved-secret';

        mount({});

        expect(comp.activeTab).toBe('account');
        expect(comp.tabs.account.user).toBe('SavedAccount');
        expect(comp.tabs.account.password).toBe('saved-secret');
        expect(comp.tabs.account.rememberPasswords).toBe(true);
    });

    it('restores remembered BNC credentials from the control connection', () => {
        s.user_settings.remember_password = true;
        const controller = s.addNetwork('BNC', 'Nick', {});
        controller.is_bnc = true;
        controller.username = 'SavedUser';
        controller.connection.password = 'saved-server-pass';

        mount({});

        expect(comp.activeTab).toBe('bnc');
        expect(comp.tabs.bnc.user).toBe('SavedUser');
        expect(comp.tabs.bnc.password).toBe('saved-server-pass');
        expect(comp.tabs.bnc.rememberPasswords).toBe(true);
    });
});
