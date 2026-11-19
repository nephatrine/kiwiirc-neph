import Vue from 'vue';
import { TextEncoder } from 'util';
import state from '@/libs/state';
// Side-effect global registration, mirroring src/main.js (unknown otherwise)
import '@/components/utils/InputText';
import Welcome from '@/components/startups/Welcome';
// jsdom lacks TextEncoder, which readyToRegister uses during render
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}

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

const REG_INFO = {
    caps: { 'sasl': 'PLAIN', 'draft/account-registration': 'before-connect' },
    isupport: {},
};

const CUSTOM_REG_INFO = {
    caps: {
        'sasl': 'PLAIN',
        'draft/account-registration': 'before-connect,custom-account-name',
    },
    isupport: {},
};

describe('Welcome account tabs', () => {
    let s;
    let comp;
    let vm;

    beforeEach(() => {
        s = state.create();
        s.settings.startupOptions = {};
        Vue.prototype.$state = s;

        // Attached to the document so element.focus() moves activeElement
        const mountEl = document.createElement('div');
        document.body.appendChild(mountEl);
        vm = new Vue({
            el: mountEl,
            render: (h) => h(Welcome),
        });
        comp = vm.$children[0];

        comp.tabs.anonymous.nick = 'TestNick';
        comp.tabs.anonymous.channel = '#testchan';
        comp.tabs.account.channel = '#testchan';
        comp.tabs.register.channel = '#testchan';
    });

    afterEach(() => {
        vm.$destroy();
        if (vm.$el.parentNode) {
            vm.$el.parentNode.removeChild(vm.$el);
        }
        delete Vue.prototype.$state;
    });

    function inputByLabel(label) {
        // Inputs render inside startup-layout slots, so walk the tree
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

    it('derives tab visibility from the probe', () => {
        const cases = [
            {
                name: 'no probe',
                info: null,
                anonymous: true,
                account: true,
                register: false,
            },
            {
                name: 'sasl offered',
                info: { caps: { sasl: 'PLAIN' }, isupport: {} },
                anonymous: true,
                account: true,
                register: false,
            },
            {
                name: 'valueless sasl',
                info: { caps: { sasl: '' }, isupport: {} },
                anonymous: true,
                account: true,
                register: false,
            },
            {
                name: 'sasl absent',
                info: { caps: { 'draft/account-registration': '' }, isupport: {} },
                anonymous: true,
                account: false,
                register: false,
            },
            {
                name: 'account required',
                info: {
                    caps: { sasl: 'PLAIN' },
                    isupport: { 'DRAFT/ACCOUNTREQUIRED': '' },
                },
                anonymous: false,
                account: true,
                register: false,
            },
            {
                name: 'account required with registration only',
                info: {
                    caps: { 'draft/account-registration': '' },
                    isupport: { 'DRAFT/ACCOUNTREQUIRED': '' },
                },
                anonymous: false,
                account: true,
                register: false,
            },
        ];

        cases.forEach((testCase) => {
            comp.serverInfo = testCase.info;
            expect({
                anonymous: comp.showAnonymousTab,
                account: comp.showAccountTab,
                register: comp.showRegisterTab,
            }).toEqual({
                anonymous: testCase.anonymous,
                account: testCase.account,
                register: testCase.register,
            });
        });
    });

    it('defaults new users to the account tab when available', () => {
        expect(comp.activeTab).toBe('account');
    });

    it('moves to an offered tab when the probe hides the current one', async() => {
        comp.activeTab = 'account';
        comp.applyServerInfo({ caps: {}, isupport: {} });
        await comp.$nextTick();
        expect(comp.showAccountTab).toBe(false);
        expect(comp.activeTab).toBe('anonymous');
    });

    it('picks register only when it is the sole offered tab', async() => {
        comp.serverInfo = CUSTOM_REG_INFO;
        comp.activeTab = 'account';
        comp.applyServerInfo({
            caps: { 'draft/account-registration': 'before-connect' },
            isupport: { 'DRAFT/ACCOUNTREQUIRED': '' },
        });
        await comp.$nextTick();
        expect(comp.showAccountTab).toBe(false);
        expect(comp.showAnonymousTab).toBe(false);
        expect(comp.showRegisterTab).toBe(true);
        expect(comp.activeTab).toBe('register');
    });

    it('derives the account nick suggestion by stripping suffixes', () => {
        const cases = [
            ['USER@TAG', 'USER'],
            ['USER/NETWORK', 'USER'],
            ['USER/NETWORK@CLIENT', 'USER'],
            ['USER@CLIENT/NETWORK', 'USER'],
        ];

        cases.forEach(([account, expected]) => {
            comp.tabs.account.account = account;
            expect(comp.accountNickSuggestion).toBe(expected);
        });

        // The suggestion is only a placeholder, not an override.
        expect(comp.tabs.account.nick).toBe('');
    });

    it('lets an empty override fall back to the account name', () => {
        comp.activeTab = 'account';
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'secret';
        expect(comp.effectiveNick).toBe('TestAccount');
        expect(comp.isNickValid).toBeTruthy();
        expect(comp.readyAccount).toBe(true);
        expect(comp.formReady).toBe(true);
    });

    it('still requires a valid nick when the account name is not nick-safe', () => {
        comp.activeTab = 'account';
        comp.tabs.account.account = '123bad';
        comp.tabs.account.password = 'secret';
        expect(comp.formReady).toBe(false);
    });

    it('starts anonymously with no account identity', () => {
        comp.startUp('anonymous');
        const net = comp.network;
        expect(net.connection.account).toBe('');
        expect(net.password).toBe('');
        expect(net.connection.password).toBe('');
        expect(net.ircClient.connect).toHaveBeenCalledTimes(1);
    });

    it('updates a reused network with the current transport settings', () => {
        const existing = s.addNetwork('Network', 'OldNick', {
            server: 'irc.example',
            port: 6697,
            tls: true,
            direct: false,
        });

        s.settings.startupOptions = {
            websocket: 'https://irc.example/webirc',
            probeServerCaps: false,
        };

        comp.startUp('anonymous');

        expect(comp.network).toBe(existing);
        expect(existing.connection.server).toBe('irc.example');
        expect(existing.connection.port).toBe(443);
        expect(existing.connection.tls).toBe(true);
        expect(existing.connection.direct).toBe(true);
        expect(existing.connection.path).toBe('/webirc');
    });

    it('starts the account tab with SASL credentials', () => {
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'secret';
        comp.startUp('account');
        const net = comp.network;
        expect(net.connection.account).toBe('TestAccount');
        expect(net.password).toBe('secret');
        expect(net.connection.password).toBe('');
    });

    it('sends the tab server password as PASS, not as the SASL secret', () => {
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'sasl-secret';
        comp.tabs.account.serverPassword = 'server-pass';
        comp.startUp('account');
        const net = comp.network;
        expect(net.connection.password).toBe('server-pass');
        expect(net.password).toBe('sasl-secret');
    });

    it('connects with the tab username and real name', () => {
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'secret';
        comp.tabs.account.username = 'ident';
        comp.tabs.account.gecos = 'Real Name';
        comp.startUp('account');
        expect(comp.network.username).toBe('ident');
        expect(comp.network.gecos).toBe('Real Name');
    });

    it('connects an empty override with the account-derived name', () => {
        comp.activeTab = 'account';
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'secret';
        comp.startUp('account');
        expect(comp.tabs.account.nick).toBe('');
        expect(comp.network.connection.nick).toBe('TestAccount');
        expect(comp.network.connection.account).toBe('TestAccount');
    });

    it('carries no password-manager tokens on the anonymous tab', async() => {
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        expect(inputByLabel('nick_name').autocomplete).not.toBe('username');
        const tokens = [...comp.$el.querySelectorAll('input')]
            .map((el) => el.getAttribute('autocomplete'));
        expect(tokens).not.toContain('username');
        expect(tokens).not.toContain('current-password');
        expect(tokens).not.toContain('new-password');
    });

    it('shows the anonymous warning only while accounts are offered', async() => {
        comp.serverInfo = null;
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        expect(comp.$el.querySelector('.kiwi-welcome-anonymous-warning')).not.toBe(null);

        comp.serverInfo = { caps: {}, isupport: {} };
        await comp.$nextTick();
        expect(comp.$el.querySelector('.kiwi-welcome-anonymous-warning')).toBe(null);
    });

    it('validates each tab on its own fields', () => {
        comp.activeTab = 'anonymous';
        expect(comp.formReady).toBe(true);

        comp.activeTab = 'account';
        expect(comp.formReady).toBe(false);
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'secret';
        expect(comp.formReady).toBe(true);
    });

    it('shows the account-derived nick as the override placeholder', async() => {
        comp.activeTab = 'account';
        comp.showAdvanced = true;
        comp.tabs.account.account = 'ankle@phone';
        await comp.$nextTick();
        expect(inputByLabel('nick_name').placeholder).toBe('ankle');
    });

    it('focuses the account input when switching to the account tab', async() => {
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        await comp.$nextTick();
        comp.tabs.account.account = 'TestAccount';
        comp.activeTab = 'account';
        await comp.$nextTick();
        await comp.$nextTick();
        const accountInput = inputByLabel('account_name').$el.querySelector('input');
        expect(document.activeElement).toBe(accountInput);
    });

    it('focuses the nick input when switching to the anonymous tab', async() => {
        comp.activeTab = 'account';
        await comp.$nextTick();
        await comp.$nextTick();
        comp.tabs.anonymous.nick = '';
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        await comp.$nextTick();
        const nickInput = inputByLabel('nick_name').$el.querySelector('input');
        expect(document.activeElement).toBe(nickInput);
    });

    it('always shows an account field on the register tab', async() => {
        comp.serverInfo = REG_INFO;
        comp.activeTab = 'register';
        await comp.$nextTick();
        expect(comp.showRegisterTab).toBe(true);
        expect(inputByLabel('account_name')).not.toBeUndefined();
        expect(comp.$el.textContent).not.toContain('register_as');
        expect(inputByLabel('nick_name')).toBeUndefined();
        expect(inputByLabel('account_name').autocomplete).toBe('username');
        expect(inputByLabel('account_name').placeholder).toBeUndefined();
    });

    it('focuses the account input on the register tab', async() => {
        const expectFocus = async(info) => {
            comp.serverInfo = info;
            comp.activeTab = 'register';
            await comp.$nextTick();
            await comp.$nextTick();
            const nameInput = inputByLabel('account_name').$el.querySelector('input');
            expect(document.activeElement).toBe(nameInput);
        };

        await expectFocus(REG_INFO);
        await expectFocus(CUSTOM_REG_INFO);
    });

    it('collapses the advanced fields behind a toggle', async() => {
        comp.activeTab = 'account';
        comp.showAdvanced = false;
        await comp.$nextTick();
        expect(comp.$el.querySelector('.kiwi-welcome-advanced-toggle')).not.toBe(null);
        expect(inputByLabel('nick_name')).toBeUndefined();
        expect(inputByLabel('user_name')).toBeUndefined();
        expect(inputByLabel('channel_list')).toBeUndefined();
        expect(comp.$el.textContent).not.toContain('remember_password');
        // Remember Me itself always stays visible
        expect(comp.$el.textContent).toContain('remember_settings');
        comp.showAdvanced = true;
        await comp.$nextTick();
        expect(inputByLabel('nick_name')).not.toBeUndefined();
        expect(inputByLabel('user_name')).not.toBeUndefined();
        expect(inputByLabel('channel_list')).not.toBeUndefined();
        expect(comp.$el.textContent).toContain('remember_password');
    });

    it('puts Advanced below Remember Me with its settings in the box', async() => {
        comp.activeTab = 'account';
        comp.showAdvanced = true;
        await comp.$nextTick();
        const html = comp.$el.innerHTML;
        const rememberPos = html.indexOf('remember_settings');
        const togglePos = html.indexOf('kiwi-welcome-advanced-toggle');
        const boxPos = html.indexOf('kiwi-welcome-advanced-box');
        expect(rememberPos).toBeGreaterThan(-1);
        expect(togglePos).toBeGreaterThan(rememberPos);
        expect(boxPos).toBeGreaterThan(togglePos);
        const box = comp.$el.querySelector('.kiwi-welcome-advanced-box');
        expect(box.textContent).toContain('remember_password');
        // Nick override, user name, real name, server password, channel
        // and the checkbox all live in the box
        expect(box.querySelectorAll('input').length).toBe(6);
    });

    describe('per-tab restore', () => {
        function mountWithOptions(startupOptions) {
            s.settings.startupOptions = startupOptions;
            const mountEl = document.createElement('div');
            document.body.appendChild(mountEl);
            return new Vue({
                el: mountEl,
                render: (h) => h(Welcome),
            });
        }

        function destroyVm(freshVm) {
            freshVm.$destroy();
            if (freshVm.$el.parentNode) {
                freshVm.$el.parentNode.removeChild(freshVm.$el);
            }
        }

        it('restores only the account tab for an account user', async() => {
            const freshVm = mountWithOptions({ nick: 'kiwi_?', account: 'ankle' });
            try {
                const freshComp = freshVm.$children[0];
                await freshComp.$nextTick();
                expect(freshComp.tabs.account.account).toBe('ankle');
                expect(freshComp.tabs.anonymous.nick).toMatch(/^kiwi_\d+$/);
                expect(freshComp.tabs.account.nick).toBe('');
                expect(freshComp.accountNickSuggestion).toBe('ankle');
                expect(freshComp.tabs.register.account).toBe('');
            } finally {
                destroyVm(freshVm);
            }
        });

        it('restores only the anonymous tab for an anonymous user', async() => {
            const freshVm = mountWithOptions({ nick: 'AnonNick' });
            try {
                const freshComp = freshVm.$children[0];
                await freshComp.$nextTick();
                expect(freshComp.tabs.anonymous.nick).toBe('AnonNick');
                expect(freshComp.tabs.account.account).toBe('');
                expect(freshComp.tabs.account.nick).toBe('');
                // One-time prefill so reserving the nick is one click away
                expect(freshComp.tabs.register.account).toBe('AnonNick');
            } finally {
                destroyVm(freshVm);
            }
        });

        it('starts a remembered anonymous network on the anonymous tab', async() => {
            s.addNetwork('SavedNetwork', 'SavedNick', { server: 'default' });
            const freshVm = mountWithOptions({});
            try {
                const freshComp = freshVm.$children[0];
                await freshComp.$nextTick();
                expect(freshComp.activeTab).toBe('anonymous');
                expect(freshComp.tabs.anonymous.nick).toBe('SavedNick');
            } finally {
                destroyVm(freshVm);
            }
        });

        it('starts a remembered account network on the account tab', async() => {
            s.addNetwork('SavedNetwork', 'SavedNick', {
                server: 'default',
                account: 'ankle',
            });
            const freshVm = mountWithOptions({});
            try {
                const freshComp = freshVm.$children[0];
                await freshComp.$nextTick();
                expect(freshComp.activeTab).toBe('account');
                expect(freshComp.tabs.account.account).toBe('ankle');
            } finally {
                destroyVm(freshVm);
            }
        });

        it('registers a fresh name from a blank register tab', async() => {
            const freshVm = mountWithOptions({ nick: 'kiwi_?', account: 'ankle' });
            try {
                const freshComp = freshVm.$children[0];
                await freshComp.$nextTick();
                freshComp.serverInfo = REG_INFO;
                freshComp.tabs.register.channel = '#testchan';
                freshComp.activeTab = 'register';
                freshComp.tabs.register.account = 'BrandNew';
                freshComp.tabs.register.email = 'new@example.com';
                freshComp.tabs.register.password = 'secret123';
                freshComp.startUp('register');
                expect(freshComp.network.connection.nick).toBe('BrandNew');
                expect(freshComp.network.registration.account).toBe('BrandNew');
                // No tab leaked into another: the anonymous nick is still
                // the configured default.
                expect(freshComp.tabs.anonymous.nick).toMatch(/^kiwi_\d+$/);
            } finally {
                destroyVm(freshVm);
            }
        });
    });

    it('shows the register nick only with custom names under Advanced', async() => {
        comp.serverInfo = CUSTOM_REG_INFO;
        comp.activeTab = 'register';
        comp.showAdvanced = false;
        await comp.$nextTick();
        expect(inputByLabel('nick_name')).toBeUndefined();
        comp.showAdvanced = true;
        await comp.$nextTick();
        expect(inputByLabel('nick_name')).not.toBeUndefined();
    });

    it('requires the register account field, never the nick', async() => {
        comp.serverInfo = REG_INFO;
        comp.activeTab = 'register';
        comp.tabs.register.account = '';
        comp.tabs.register.password = 'secret123';
        await comp.$nextTick();
        expect(comp.readyToRegister).toBe(false);
        comp.tabs.register.account = 'TestNick';
        expect(comp.readyToRegister).toBe(true);
        expect(comp.formReady).toBe(true);
    });

    it('uses the register account verbatim as the nick fallback', async() => {
        comp.serverInfo = REG_INFO;
        comp.activeTab = 'register';
        comp.tabs.anonymous.nick = '';
        comp.tabs.register.account = 'SomeAccount';
        await comp.$nextTick();
        // No @suffix strip here: without custom-account-name the
        // account IS the nick.
        expect(comp.effectiveNick).toBe('SomeAccount');
    });

    it('prefers the register account over a stale nick without custom names', async() => {
        comp.serverInfo = REG_INFO;
        comp.activeTab = 'register';
        comp.tabs.anonymous.nick = 'StaleNick';
        comp.tabs.register.account = 'FreshAccount';
        await comp.$nextTick();
        expect(comp.effectiveNick).toBe('FreshAccount');
        expect(comp.isNickValid).toBeTruthy();
    });

    it('registers the register account even when a stale nick exists', () => {
        comp.serverInfo = REG_INFO;
        comp.activeTab = 'register';
        comp.tabs.anonymous.nick = 'StaleNick';
        comp.tabs.register.account = 'FreshAccount';
        comp.tabs.register.email = 'fresh@example.com';
        comp.tabs.register.password = 'secret123';
        comp.startUp('register');
        // The stale anonymous nick is ignored, not overwritten: NICK and
        // the armed REGISTER both target the account the user typed.
        expect(comp.tabs.anonymous.nick).toBe('StaleNick');
        expect(comp.network.connection.nick).toBe('FreshAccount');
        expect(comp.network.registration.account).toBe('FreshAccount');
    });

    it('keeps an explicit nick with custom-account-name on register', () => {
        comp.serverInfo = CUSTOM_REG_INFO;
        comp.activeTab = 'register';
        comp.showAdvanced = true;
        comp.tabs.register.nick = 'CustomNick';
        comp.tabs.register.account = 'OtherAccount';
        comp.tabs.register.email = 'other@example.com';
        comp.tabs.register.password = 'secret123';
        comp.startUp('register');
        expect(comp.tabs.register.nick).toBe('CustomNick');
        expect(comp.network.connection.nick).toBe('CustomNick');
    });

    it('derives the custom register nick from the authcid when empty', () => {
        comp.serverInfo = CUSTOM_REG_INFO;
        comp.activeTab = 'register';
        comp.tabs.register.nick = '';
        comp.tabs.register.account = 'user/network@client';
        expect(comp.registerNickSuggestion).toBe('user');
        expect(comp.effectiveNick).toBe('user');
    });

    it('keeps a configured greeting and probe icon', async() => {
        s.settings.startupOptions = { greetingText: 'NephIRC' };
        comp.serverInfo = { isupport: { NETWORK: 'Libera.Chat' } };
        await comp.$nextTick();
        expect(comp.greetingText).toBe('NephIRC');

        comp.serverInfo = {
            isupport: {
                'DRAFT/ICON': 'https://example.com/icon-{size}.png',
            },
        };
        await comp.$nextTick();
        expect(comp.greetingText).toBe('NephIRC');
        expect(comp.serverIcon).toBe('https://example.com/icon-64.png');
    });

    it('falls back to the network name when no greeting is configured', async() => {
        s.settings.startupOptions = {};
        comp.serverInfo = { isupport: { NETWORK: 'Libera.Chat' } };
        await comp.$nextTick();
        expect(comp.greetingText).toBe('welcome_to_network');
    });
});
