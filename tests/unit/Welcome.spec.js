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

const TAB_REG_INFO = {
    caps: { 'sasl': 'PLAIN', 'draft/account-registration': 'before-connect' },
    isupport: {},
};

describe('Welcome tab isolation', () => {
    let s;
    let comp;
    let vm;

    beforeEach(() => {
        s = state.create();
        s.settings.startupOptions = {};
        Vue.prototype.$state = s;

        const mountEl = document.createElement('div');
        document.body.appendChild(mountEl);
        vm = new Vue({
            el: mountEl,
            render: (h) => h(Welcome),
        });
        comp = vm.$children[0];

        comp.tabs.anonymous.nick = 'AnonNick';
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

    it('keeps credentials and Remember Password per tab', async() => {
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'secret';
        comp.tabs.account.rememberPasswords = true;
        comp.activeTab = 'account';
        await comp.$nextTick();
        expect(comp.layoutRememberPasswords).toBe(true);

        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        expect(comp.tabs.anonymous.rememberPasswords).toBe(false);
        expect(comp.layoutRememberPasswords).toBe(false);

        comp.activeTab = 'account';
        await comp.$nextTick();
        expect(comp.tabs.account.account).toBe('TestAccount');
        expect(comp.tabs.account.password).toBe('secret');
        expect(comp.tabs.anonymous.nick).toBe('AnonNick');
        expect(comp.tabs.account.rememberPasswords).toBe(true);
        expect(comp.layoutRememberPasswords).toBe(true);
    });

    it('shows Remember Me on every tab with its own value', async() => {
        comp.tabs.account.rememberSettings = false;
        comp.tabs.anonymous.rememberSettings = true;

        comp.activeTab = 'account';
        await comp.$nextTick();
        expect(comp.$el.textContent).toContain('remember_settings');
        expect(comp.layoutRememberSettings).toBe(false);

        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        expect(comp.$el.textContent).toContain('remember_settings');
        expect(comp.layoutRememberSettings).toBe(true);
    });

    it('disables anonymous Remember Password until a server password exists', async() => {
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        expect(comp.rememberPasswordDisabled).toBe(true);

        comp.tabs.anonymous.serverPassword = 'serverpass';
        await comp.$nextTick();
        expect(comp.rememberPasswordDisabled).toBe(false);

        comp.tabs.anonymous.rememberPasswords = true;
        expect(comp.layoutRememberPasswords).toBe(true);
    });

    it('keeps the register tab independent of the anonymous tab', async() => {
        comp.tabs.anonymous.nick = 'AnonNick';
        comp.tabs.anonymous.serverPassword = 'anonpass';
        comp.tabs.register.account = 'NewAccount';
        comp.tabs.register.password = 'newpass';
        comp.activeTab = 'register';
        await comp.$nextTick();

        expect(comp.tabs.register.nick).toBe('');
        expect(comp.effectiveNick).toBe('NewAccount');
        expect(comp.tabs.anonymous.serverPassword).toBe('anonpass');
        expect(comp.tabs.account.account).toBe('');
    });

    it('prefills the register account from a remembered anonymous nick', async() => {
        s.settings.startupOptions = { nick: 'RememberedNick' };
        const mountEl = document.createElement('div');
        const freshVm = new Vue({
            el: mountEl,
            render: (h) => h(Welcome),
        });
        try {
            const freshComp = freshVm.$children[0];
            await freshComp.$nextTick();
            expect(freshComp.tabs.anonymous.nick).toBe('RememberedNick');
            expect(freshComp.tabs.register.account).toBe('RememberedNick');
            expect(freshComp.registerNickSuggestion).toBe('RememberedNick');
        } finally {
            freshVm.$destroy();
        }
    });

    it('shows and scores the password strength meter on the register tab', async() => {
        comp.tabs.register.password = 'secret123';
        comp.tabs.account.password = 'secret123';
        comp.serverInfo = TAB_REG_INFO;

        comp.activeTab = 'register';
        await comp.$nextTick();
        expect(comp.$el.querySelector('.kiwi-welcome-password-strength')).not.toBe(null);
        expect(comp.passwordStrength).toBeGreaterThan(0);

        comp.activeTab = 'account';
        await comp.$nextTick();
        expect(comp.$el.querySelector('.kiwi-welcome-password-strength')).toBe(null);

        comp.activeTab = 'register';
        comp.tabs.register.password = 'aaaaaaaa';
        const weak = comp.passwordStrength;
        comp.tabs.register.password = 'Correct-Horse-42!';
        expect(comp.passwordStrength).toBeGreaterThan(weak);
    });

    it('applies NICKLEN from the probe', async() => {
        comp.serverInfo = { caps: {}, isupport: { NICKLEN: '5' } };
        comp.activeTab = 'anonymous';
        comp.tabs.anonymous.nick = 'TooLongNick';
        await comp.$nextTick();
        expect(comp.nickLen).toBe(5);
        expect(comp.isNickLengthValid).toBe(false);
        expect(comp.formReady).toBe(false);
        expect(inputByLabel('nick_name').maxlength).toBe(5);

        comp.tabs.anonymous.nick = 'Short';
        await comp.$nextTick();
        expect(comp.formReady).toBe(true);
    });

    it('applies USERLEN and NAMELEN from the probe', async() => {
        comp.serverInfo = { caps: { sasl: 'PLAIN' }, isupport: { USERLEN: '4', NAMELEN: '6' } };
        comp.activeTab = 'account';
        comp.showAdvanced = true;
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'secret';
        await comp.$nextTick();
        expect(comp.formReady).toBe(true);

        comp.tabs.account.username = 'toolong';
        await comp.$nextTick();
        expect(comp.isUsernameValid).toBe(false);
        expect(comp.formReady).toBe(false);
        expect(inputByLabel('user_name').maxlength).toBe(4);

        comp.tabs.account.username = 'ok';
        comp.tabs.account.gecos = 'too long';
        await comp.$nextTick();
        expect(comp.isGecosValid).toBe(false);
        expect(comp.formReady).toBe(false);
        expect(inputByLabel('real_name').maxlength).toBe(6);

        comp.tabs.account.gecos = 'short';
        await comp.$nextTick();
        expect(comp.formReady).toBe(true);
    });

    it('rejects whitespace in the server password', async() => {
        comp.activeTab = 'account';
        comp.showAdvanced = true;
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'secret';
        await comp.$nextTick();
        expect(comp.formReady).toBe(true);

        comp.tabs.account.serverPassword = 'has space';
        await comp.$nextTick();
        expect(comp.isServerPasswordValid).toBe(false);
        expect(comp.formReady).toBe(false);

        comp.tabs.account.serverPassword = 'nospace';
        await comp.$nextTick();
        expect(comp.formReady).toBe(true);
    });

    it('connects each tab with only its own credentials', () => {
        comp.serverInfo = TAB_REG_INFO;
        comp.tabs.anonymous.serverPassword = 'anonpass';
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'accpass';
        comp.tabs.register.account = 'NewAccount';
        comp.tabs.register.password = 'regpass';

        comp.startUp('anonymous');
        expect(comp.network.connection.account).toBe('');
        expect(comp.network.connection.password).toBe('anonpass');
        expect(comp.network.password).toBe('');

        comp.startUp('account');
        expect(comp.network.connection.account).toBe('TestAccount');
        expect(comp.network.password).toBe('accpass');
        expect(comp.network.connection.password).toBe('');

        comp.startUp('register');
        expect(comp.network.connection.account).toBe('');
        expect(comp.network.password).toBe('');
        // The registration password is armed, not stored as SASL
        expect(comp.network.registration.account).toBe('NewAccount');
    });
});

describe('Welcome register startup', () => {
    function driveRawLine(client, command, params) {
        return new Promise((resolve, reject) => {
            client.raw_middleware.handle(
                [command, { command, params, tags: {} }, '', client],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    function inputByLabel(comp, label) {
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

    function mountWelcome() {
        const s = state.create();
        s.settings.startupOptions = {};
        Vue.prototype.$state = s;

        const vm = new Vue({
            el: document.createElement('div'),
            render: (h) => h(Welcome),
        });
        const comp = vm.$children[0];

        comp.tabs.anonymous.nick = 'RegNick';
        comp.tabs.anonymous.channel = '#testchan';
        comp.tabs.register.channel = '#testchan';
        comp.tabs.register.account = 'RegNick';
        comp.serverInfo = {
            caps: {
                'draft/account-registration': 'before-connect,email-required',
            },
            isupport: {},
        };
        comp.activeTab = 'register';
        comp.tabs.register.email = 'reg@example.com';
        comp.tabs.register.password = 'secret123';

        return { s, vm, comp };
    }

    afterEach(() => {
        delete Vue.prototype.$state;
    });

    it('arms registration and connects with the register account', () => {
        // The register branch must work when startUp itself is the first code
        // to touch net.ircClient (production lazy-init ordering). This threw
        // `armPreConnectRegistration is not a function` before the ircClient
        // access was moved ahead of the arm call.
        let { vm, comp } = mountWelcome();
        expect(() => comp.startUp('register')).not.toThrow();

        const net = comp.network;
        expect(net.registration.account).toBe('RegNick');
        expect(net.password).toBe('');
        expect(net.connection.password).toBe('');
        expect(net.ircClient.connect).toHaveBeenCalledTimes(1);
        vm.$destroy();

        // Without custom-account-name the account IS the nick, and the
        // nick field is hidden: the typed account goes out directly and
        // no other tab's field is modified.
        let ctx = mountWelcome();
        comp = ctx.comp;
        vm = ctx.vm;
        comp.tabs.anonymous.nick = 'UnrelatedNick';
        comp.tabs.register.account = 'NewAccount';
        comp.startUp('register');

        expect(comp.tabs.anonymous.nick).toBe('UnrelatedNick');
        expect(comp.network.connection.nick).toBe('NewAccount');
        expect(comp.network.ircClient.connect).toHaveBeenCalledTimes(1);
        vm.$destroy();
    });

    it('sends REGISTER and holds CAP END once the cap is ACKed', async() => {
        jest.useFakeTimers();
        try {
            const { vm, comp } = mountWelcome();
            comp.startUp('register');
            const net = comp.network;
            net.state = 'connecting';
            net.ircClient.network.cap.negotiating = true;

            const rawSpy = jest.spyOn(net.ircClient, 'raw').mockImplementation(() => {});
            await driveRawLine(net.ircClient, 'CAP', ['*', 'ACK', 'draft/account-registration']);

            const registers = rawSpy.mock.calls.filter((call) => call[0] === 'REGISTER');
            expect(registers).toHaveLength(1);
            expect(registers[0][1]).toBe('*');
            expect(registers[0][2]).toBe('reg@example.com');
            expect(registers[0][3]).toBe('secret123');
            expect(net.registration.pending).toBe(true);
            expect(net.ircClient.network.cap.requested).toContain('kiwi-register-wait');
            const ends = rawSpy.mock.calls.filter((call) => (
                call[0] === 'CAP' && call[1] === 'END'
            ));
            expect(ends).toHaveLength(0);
            rawSpy.mockRestore();
            vm.$destroy();
        } finally {
            jest.useRealTimers();
        }
    });

    describe('username autofill token placement', () => {
        it('keeps the username token on the account field', async() => {
            let ctx = mountWelcome();
            let { vm, comp } = ctx;
            comp.serverInfo = null;
            comp.activeTab = 'account';
            comp.showAdvanced = true;
            await comp.$nextTick();

            expect(comp.nickIsLoginUsername).toBe(false);
            expect(inputByLabel(comp, 'nick_name').autocomplete).not.toBe('username');
            expect(inputByLabel(comp, 'account_name').autocomplete).toBe('username');
            vm.$destroy();

            ctx = mountWelcome();
            vm = ctx.vm;
            comp = ctx.comp;
            comp.serverInfo = {
                caps: {
                    'draft/account-registration': 'before-connect,email-required',
                },
                isupport: {},
            };
            comp.activeTab = 'register';
            await comp.$nextTick();

            expect(comp.nickIsLoginUsername).toBe(true);
            // The account field is authoritative: it always carries the
            // token and never a nick-derived placeholder, and no nick
            // field exists to carry it either.
            expect(inputByLabel(comp, 'account_name')).not.toBeUndefined();
            expect(inputByLabel(comp, 'account_name').autocomplete).toBe('username');
            expect(inputByLabel(comp, 'account_name').placeholder).toBeUndefined();
            expect(inputByLabel(comp, 'nick_name')).toBeUndefined();
            vm.$destroy();

            ctx = mountWelcome();
            vm = ctx.vm;
            comp = ctx.comp;
            comp.serverInfo = {
                caps: {
                    'sasl': 'PLAIN',
                    'draft/account-registration': 'before-connect,custom-account-name',
                },
                isupport: {},
            };
            comp.activeTab = 'account';
            comp.showAdvanced = true;
            await comp.$nextTick();

            expect(comp.nickIsLoginUsername).toBe(false);
            expect(inputByLabel(comp, 'nick_name').autocomplete).not.toBe('username');
            expect(inputByLabel(comp, 'account_name').autocomplete).toBe('username');
            vm.$destroy();
        });
    });
});
