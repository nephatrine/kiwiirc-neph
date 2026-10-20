import Vue from 'vue';
import { TextEncoder } from 'util';
import state from '@/libs/state';
// Side-effect global registrations, mirroring src/main.js
import '@/components/utils/InputText';
import '@/components/utils/TransitionExpand';
import CustomServer from '@/components/startups/CustomServer';
import { probeServerCaps, createProbeTransport } from '@/libs/ServerProbe';

if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}

jest.mock('@/libs/ServerProbe', () => ({
    probeServerCaps: jest.fn(),
    createProbeTransport: jest.fn(() => ({})),
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

// The real TabbedView uses runtime template strings, which the runtime-only
// Vue build in Jest cannot compile. These light stand-ins only render the tab
// matching the bound value, which is the behaviour the tests need.
Vue.component('tabbed-tab', {
    props: {
        header: String,
        focus: Boolean,
        name: String,
    },
    render(h) {
        return h('div', this.$slots.default);
    },
});

Vue.component('tabbed-view', {
    props: {
        value: String,
        showTabs: {
            type: Boolean,
            default: true,
        },
    },
    render(h) {
        const active = (this.$slots.default || []).find((vnode) => (
            vnode.componentOptions &&
            vnode.componentOptions.propsData &&
            vnode.componentOptions.propsData.name === this.value
        ));
        return h('div', active ? [active] : []);
    },
});

Vue.mixin({
    computed: {
        $t() {
            return (key) => key;
        },
    },
});

const PRESETS = [
    {
        name: 'Alpha',
        server: 'alpha.example.com',
        port: 6667,
        tls: false,
        direct: false,
        type: 'irc',
        channels: '#alpha',
    },
    {
        name: 'Beta',
        server: 'beta.example.com',
        port: 6667,
        tls: false,
        direct: false,
        type: 'irc',
        channels: '#beta',
    },
    {
        name: 'Bouncer',
        server: 'bnc.example.com',
        port: 6697,
        tls: true,
        direct: false,
        type: 'bnc',
    },
];

describe('CustomServer identity tabs', () => {
    let s;
    let comp;
    let vm;

    beforeEach(() => {
        jest.clearAllMocks();
        probeServerCaps.mockResolvedValue({
            caps: { sasl: 'PLAIN' },
            isupport: {},
        });

        s = state.create();
        s.settings.startupOptions = {
            server: 'custom.example.com',
            port: 6667,
            tls: false,
            nick: 'TestNick',
            channel: '#testchan',
            probeServerCaps: true,
        };
        s.settings.presetNetworks = PRESETS;
        s.persistence = {
            watchStateForChanges: jest.fn(),
        };
        Vue.prototype.$state = s;

        const mountEl = document.createElement('div');
        document.body.appendChild(mountEl);
        vm = new Vue({
            el: mountEl,
            render: (h) => h(CustomServer),
        });
        comp = vm.$children[0];
    });

    afterEach(() => {
        vm.$destroy();
        if (vm.$el.parentNode) {
            vm.$el.parentNode.removeChild(vm.$el);
        }
        delete Vue.prototype.$state;
    });

    function inputByLabel(label) {
        const stack = [...comp.$children];
        while (stack.length) {
            const child = stack.shift();
            if (child.label === label) {
                return child;
            }
            stack.push(...child.$children);
        }
        return undefined;
    }

    async function selectPreset(index) {
        comp.presetSelected = String(index);
        Object.assign(comp.connection, PRESETS[index]);
        await comp.$nextTick();
        await Promise.resolve();
        await comp.$nextTick();
    }

    it('labels the preset dropdown as a network', () => {
        const label = comp.$el.querySelector('label[for="kiwi_preset_server"]');
        expect(label).not.toBeNull();
        expect(label.textContent.trim()).toBe('network');
    });

    it('shows anonymous and account tabs but never register', () => {
        expect(comp.showAnonymousTab).toBe(true);
        expect(comp.showAccountTab).toBe(true);
        expect(comp.showRegisterTab).toBeUndefined();
        expect(comp.$el.textContent).toContain('anonymous_tab');
        expect(comp.$el.textContent).toContain('account_tab');
        expect(comp.$el.textContent).not.toContain('register_tab');
    });

    it('does not probe a custom endpoint', async() => {
        comp.presetSelected = 'custom';
        comp.onPresetChanged();
        await comp.$nextTick();
        expect(probeServerCaps).not.toHaveBeenCalled();
        expect(comp.serverInfo).toBe(null);
        expect(comp.showAnonymousTab).toBe(true);
        expect(comp.showAccountTab).toBe(true);
    });

    it('probes each preset once and reuses the result when switching back', async() => {
        await selectPreset(0);
        expect(probeServerCaps).toHaveBeenCalledTimes(1);
        expect(comp.serverInfo.caps.sasl).toBe('PLAIN');
        expect(comp.tabs.anonymous.channel).toBe('#alpha');

        await selectPreset(1);
        expect(probeServerCaps).toHaveBeenCalledTimes(2);
        expect(comp.tabs.anonymous.channel).toBe('#beta');

        await selectPreset(0);
        expect(probeServerCaps).toHaveBeenCalledTimes(2);
        expect(comp.serverInfo.caps.sasl).toBe('PLAIN');
    });

    it('probes the endpoint shown in the form after protocol normalisation', async() => {
        await selectPreset(0);

        comp.connection.direct = true;
        comp.connection.port = 8067;
        comp.onPresetChanged();
        await comp.$nextTick();
        await Promise.resolve();
        await comp.$nextTick();

        const probeOptions = probeServerCaps.mock.calls[probeServerCaps.mock.calls.length - 1][0];
        probeOptions.createTransport();

        expect(createProbeTransport).toHaveBeenLastCalledWith(expect.objectContaining({
            host: 'alpha.example.com',
            port: 8067,
            direct: true,
            tls: false,
        }));
    });

    it('probes a bouncer preset and shows both tabs until the probe completes', async() => {
        await selectPreset(2);
        expect(probeServerCaps).toHaveBeenCalledTimes(1);
        expect(comp.serverInfo.caps.sasl).toBe('PLAIN');
        expect(comp.showBouncerBncTab).toBe(true);
        expect(comp.showBouncerAccountTab).toBe(true);
        expect(comp.probePending).toBe(false);
        expect(comp.$el.textContent).toContain('bouncer_tab');
        expect(comp.$el.textContent).toContain('account_tab');
        expect(comp.$el.textContent).not.toContain('register_tab');
    });

    it('hides the account tab when a preset lacks sasl', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: { 'draft/account-registration': '' },
            isupport: {},
        });
        await selectPreset(0);
        expect(comp.showAccountTab).toBe(false);
        expect(comp.showAnonymousTab).toBe(true);
        expect(comp.activeTab).toBe('anonymous');
    });

    it('hides the anonymous tab on draft/ACCOUNTREQUIRED', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: { sasl: 'PLAIN' },
            isupport: { 'DRAFT/ACCOUNTREQUIRED': '' },
        });
        await selectPreset(0);
        expect(comp.showAccountTab).toBe(true);
        expect(comp.showAnonymousTab).toBe(false);
        expect(comp.activeTab).toBe('account');
    });

    it('restores both tabs when switching from a preset to custom', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: {},
            isupport: {},
        });
        await selectPreset(0);
        expect(comp.showAccountTab).toBe(false);

        comp.presetSelected = 'custom';
        await comp.$nextTick();
        expect(comp.serverInfo).toBe(null);
        expect(comp.showAnonymousTab).toBe(true);
        expect(comp.showAccountTab).toBe(true);
        expect(comp.tabs.anonymous.channel).toBe('#testchan');
        expect(comp.tabs.account.channel).toBe('#testchan');
    });

    it('applies probe lengths and server-password validation', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: { sasl: 'PLAIN' },
            isupport: {
                NICKLEN: '8',
                USERLEN: '5',
                NAMELEN: '6',
            },
        });
        await selectPreset(0);
        comp.activeTab = 'anonymous';

        comp.tabs.anonymous.nick = 'LongNickName';
        expect(comp.isNickLengthValid).toBe(false);
        expect(comp.formReady).toBe(false);

        comp.tabs.anonymous.nick = 'Short';
        comp.tabs.anonymous.username = 'toolong';
        expect(comp.isUsernameValid).toBe(false);
        expect(comp.formReady).toBe(false);

        comp.tabs.anonymous.username = 'user';
        comp.tabs.anonymous.gecos = 'too-long';
        expect(comp.isGecosValid).toBe(false);
        expect(comp.formReady).toBe(false);

        comp.tabs.anonymous.gecos = 'Name';
        comp.tabs.anonymous.serverPassword = 'bad pass';
        expect(comp.isServerPasswordValid).toBe(false);
        expect(comp.formReady).toBe(false);

        comp.tabs.anonymous.serverPassword = 'good';
        expect(comp.formReady).toBe(true);
    });

    it('validates channels when they are required', () => {
        comp.connectWithoutChannel = false;
        comp.activeTab = 'anonymous';
        comp.tabs.anonymous.nick = 'TestNick';
        comp.tabs.anonymous.channel = '';
        expect(comp.formReady).toBe(false);

        comp.tabs.anonymous.channel = 'badchan';
        expect(comp.channelReady).toBe(false);

        comp.tabs.anonymous.channel = '#good';
        expect(comp.channelReady).toBe(true);
        expect(comp.formReady).toBe(true);
    });

    it('derives the account nick by stripping a suffix', () => {
        comp.activeTab = 'account';
        comp.tabs.account.account = 'USER@CLIENT';
        expect(comp.accountNickSuggestion).toBe('USER');
        expect(comp.effectiveNick).toBe('USER');
    });

    it('starts anonymously without SASL credentials', () => {
        comp.activeTab = 'anonymous';
        comp.tabs.anonymous.nick = 'TestNick';
        comp.tabs.anonymous.serverPassword = 'server-pass';
        comp.startUp();

        const net = comp.network;
        expect(net.connection.nick).toBe('TestNick');
        expect(net.connection.account).toBe('');
        expect(net.password).toBe('');
        expect(net.connection.password).toBe('server-pass');
        expect(net.ircClient.connect).toHaveBeenCalledTimes(1);
    });

    it('starts the account tab with SASL credentials', () => {
        comp.activeTab = 'account';
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'sasl-secret';
        comp.tabs.account.serverPassword = 'server-pass';
        comp.startUp();

        const net = comp.network;
        expect(net.connection.nick).toBe('TestAccount');
        expect(net.connection.account).toBe('TestAccount');
        expect(net.password).toBe('sasl-secret');
        expect(net.connection.password).toBe('server-pass');
    });

    it('sends the advanced username and real name', () => {
        comp.activeTab = 'anonymous';
        comp.tabs.anonymous.nick = 'TestNick';
        comp.tabs.anonymous.username = 'ident';
        comp.tabs.anonymous.gecos = 'Real Name';
        comp.startUp();

        expect(comp.network.username).toBe('ident');
        expect(comp.network.gecos).toBe('Real Name');
    });

    it('hides identity tabs while the bouncer form is active', async() => {
        comp.connection.type = 'bnc';
        await comp.$nextTick();
        expect(comp.$el.querySelector('.kiwi-customserver-identity-tabs')).toBe(null);
        expect(inputByLabel('username')).not.toBeUndefined();
    });

    it('hides BNC when a bouncer preset advertises SASL', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: {
                'sasl': 'PLAIN',
                'draft/bouncer-networks': '',
            },
            isupport: {},
            capsComplete: true,
        });
        await selectPreset(2);

        expect(comp.bouncerUnsupported).toBe(false);
        expect(comp.showBouncerBncTab).toBe(false);
        expect(comp.showBouncerAccountTab).toBe(true);
        expect(comp.bouncerActiveTab).toBe('account');
    });

    it('hides Account and selects BNC without SASL', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: {
                'soju.im/bouncer-networks': '',
            },
            isupport: {},
            capsComplete: true,
        });
        await selectPreset(2);

        expect(comp.showBouncerBncTab).toBe(true);
        expect(comp.showBouncerAccountTab).toBe(false);
        expect(comp.bouncerActiveTab).toBe('bnc');
    });

    it('rejects a complete bouncer probe without bouncer-networks', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: { sasl: 'PLAIN' },
            isupport: {},
            capsComplete: true,
        });
        await selectPreset(2);

        expect(comp.bouncerUnsupported).toBe(true);
        expect(comp.formReady).toBe(false);
        expect(comp.$el.textContent).toContain('bouncer_networks_required');
        expect(comp.$el.querySelectorAll('.kiwi-customserver-tabs input')).toHaveLength(0);
    });

    it('never offers Register on a bouncer preset', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: {
                'sasl': 'PLAIN',
                'draft/bouncer-networks': '',
                'draft/account-registration': 'before-connect',
            },
            isupport: {},
            capsComplete: true,
        });
        await selectPreset(2);

        expect(comp.showBouncerAccountTab).toBe(true);
        expect(comp.showRegisterTab).toBeUndefined();
        expect(comp.$el.textContent).not.toContain('register_tab');
    });

    it('validates the BNC user and derived nick', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: { 'draft/bouncer-networks': '' },
            isupport: {
                NICKLEN: '8',
                USERLEN: '5',
            },
            capsComplete: true,
        });
        await selectPreset(2);

        comp.bouncerTabs.bnc.user = 'BncUser@client';
        comp.bouncerTabs.bnc.password = 'bnc-pass';
        expect(comp.bouncerUserLengthValid).toBe(false);
        expect(comp.formReady).toBe(false);

        comp.bouncerTabs.bnc.user = 'LongNickName';
        expect(comp.bouncerNickLengthValid).toBe(false);
        expect(comp.formReady).toBe(false);

        comp.bouncerTabs.bnc.user = 'Bad Nick';
        expect(comp.bouncerNickValid).toBe(false);
        expect(comp.formReady).toBe(false);

        comp.bouncerTabs.bnc.user = 'Bnc';
        expect(comp.bouncerNickValid).toBe(true);
        expect(comp.bouncerNickLengthValid).toBe(true);
        expect(comp.bouncerUserLengthValid).toBe(true);
        expect(comp.formReady).toBe(true);
    });

    it('validates the Account password and derived nick, not USERLEN', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: {
                'sasl': 'PLAIN',
                'draft/bouncer-networks': '',
            },
            isupport: {
                NICKLEN: '8',
                USERLEN: '1',
            },
            capsComplete: true,
        });
        await selectPreset(2);

        comp.bouncerTabs.account.user = 'Account@client';
        comp.bouncerTabs.account.password = 'sasl-secret';
        expect(comp.formReady).toBe(true);

        comp.bouncerTabs.account.password = '';
        expect(comp.formReady).toBe(false);

        comp.bouncerTabs.account.password = 'sasl-secret';
        comp.bouncerTabs.account.serverPassword = 'bad pass';
        expect(comp.bouncerServerPasswordValid).toBe(false);
        expect(comp.formReady).toBe(false);

        comp.bouncerTabs.account.serverPassword = '';
        comp.bouncerTabs.account.user = 'LongAccountName';
        expect(comp.bouncerNickLengthValid).toBe(false);
        expect(comp.formReady).toBe(false);
    });

    it('keeps BNC and Account bouncer fields independent', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: {
                'sasl': 'PLAIN',
                'draft/bouncer-networks': '',
            },
            isupport: {},
            capsComplete: true,
        });
        await selectPreset(2);

        comp.bouncerTabs.account.user = 'account-user';
        comp.bouncerTabs.account.password = 'account-pass';
        comp.bouncerActiveTab = 'bnc';
        comp.bouncerTabs.bnc.user = 'bnc-user';
        comp.bouncerTabs.bnc.password = 'bnc-pass';
        expect(comp.bouncerFields.user).toBe('bnc-user');
        expect(comp.bouncerFields.password).toBe('bnc-pass');

        comp.bouncerActiveTab = 'account';
        expect(comp.bouncerFields.user).toBe('account-user');
        expect(comp.bouncerFields.password).toBe('account-pass');
    });

    it('starts a BNC bouncer preset with the stripped nick and server PASS', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: { 'draft/bouncer-networks': '' },
            isupport: {},
            capsComplete: true,
        });
        await selectPreset(2);

        comp.bouncerTabs.bnc.user = 'BncUser@client';
        comp.bouncerTabs.bnc.password = 'bnc-pass';
        comp.startUp();

        const net = comp.network;
        expect(net.username).toBe('BncUser@client');
        expect(net.connection.nick).toBe('BncUser');
        expect(net.connection.account).toBe('');
        expect(net.connection.password).toBe('bnc-pass');
        expect(net.password).toBe('');
        expect(net.ircClient.connect).toHaveBeenCalledTimes(1);
    });

    it('starts an Account bouncer preset with SASL and server PASS', async() => {
        probeServerCaps.mockResolvedValueOnce({
            caps: {
                'sasl': 'PLAIN',
                'draft/bouncer-networks': '',
            },
            isupport: {},
            capsComplete: true,
        });
        await selectPreset(2);

        comp.bouncerTabs.account.user = 'Account@client';
        comp.bouncerTabs.account.password = 'sasl-secret';
        comp.bouncerTabs.account.serverPassword = 'server-pass';
        comp.startUp();

        const net = comp.network;
        expect(net.connection.account).toBe('Account@client');
        expect(net.connection.nick).toBe('Account');
        expect(net.password).toBe('sasl-secret');
        expect(net.connection.password).toBe('server-pass');
        expect(net.username).toBe('');
        expect(net.ircClient.connect).toHaveBeenCalledTimes(1);
    });
});
