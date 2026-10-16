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

        comp.nick = 'TestNick';
        comp.channel = '#testchan';
    });

    afterEach(() => {
        delete Vue.prototype.$state;
        vm.$destroy();
        if (vm.$el.parentNode) {
            vm.$el.parentNode.removeChild(vm.$el);
        }
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

    it('shows anonymous and account until a probe says otherwise', () => {
        comp.serverInfo = null;
        expect(comp.showAnonymousTab).toBe(true);
        expect(comp.showAccountTab).toBe(true);
        expect(comp.showRegisterTab).toBe(false);
    });

    it('keeps both tabs when the probe saw sasl', () => {
        comp.serverInfo = { caps: { sasl: 'PLAIN' }, isupport: {} };
        expect(comp.showAnonymousTab).toBe(true);
        expect(comp.showAccountTab).toBe(true);
    });

    it('hides the account tab when the probe affirmatively lacks sasl', () => {
        comp.serverInfo = { caps: { 'draft/account-registration': '' }, isupport: {} };
        expect(comp.showAnonymousTab).toBe(true);
        expect(comp.showAccountTab).toBe(false);
    });

    it('hides the anonymous tab on draft/ACCOUNTREQUIRED', () => {
        comp.serverInfo = {
            caps: { sasl: 'PLAIN' },
            isupport: { 'DRAFT/ACCOUNTREQUIRED': '' },
        };
        expect(comp.showAnonymousTab).toBe(false);
        expect(comp.showAccountTab).toBe(true);
    });

    it('falls back to the account tab when nothing else is offered', () => {
        comp.serverInfo = {
            caps: { 'draft/account-registration': '' },
            isupport: { 'DRAFT/ACCOUNTREQUIRED': '' },
        };
        expect(comp.showAnonymousTab).toBe(false);
        expect(comp.showRegisterTab).toBe(false);
        expect(comp.showAccountTab).toBe(true);
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
        comp.serverInfo = {
            caps: {
                'sasl': 'PLAIN',
                'draft/account-registration': 'before-connect',
            },
            isupport: { 'DRAFT/ACCOUNTREQUIRED': '' },
        };
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

    it('defaults the account override from the account, stripping a @suffix', async() => {
        comp.accountNick = '';
        comp.account = 'USER@TAG';
        await comp.$nextTick();
        expect(comp.accountNick).toBe('USER');
        // The Anonymous tab's own nick is untouched by account typing
        expect(comp.nick).toBe('TestNick');
    });

    it('defaults the account override from a plain account name', async() => {
        comp.accountNick = '';
        comp.account = 'SomeUser';
        await comp.$nextTick();
        expect(comp.accountNick).toBe('SomeUser');
    });

    it('never clobbers an override the user took over', async() => {
        comp.accountNick = 'Custom';
        comp.accountNickTouched = true;
        comp.account = 'USER@TAG';
        await comp.$nextTick();
        expect(comp.accountNick).toBe('Custom');
    });

    it('starts anonymously with no account identity', () => {
        comp.startUp('anonymous');
        const net = comp.network;
        expect(net.connection.account).toBe('');
        expect(net.password).toBe('');
        expect(net.connection.password).toBe('');
        expect(net.ircClient.connect).toHaveBeenCalledTimes(1);
    });

    it('starts the account tab with SASL credentials', () => {
        comp.account = 'TestAccount';
        comp.password = 'secret';
        comp.startUp('account');
        const net = comp.network;
        expect(net.connection.account).toBe('TestAccount');
        expect(net.password).toBe('secret');
        expect(net.connection.password).toBe('');
    });

    it('carries no password-manager tokens on the anonymous tab', async() => {
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        expect(inputByLabel('nick').autocomplete).not.toBe('username');
        const tokens = [...comp.$el.querySelectorAll('input')]
            .map((el) => el.getAttribute('autocomplete'));
        expect(tokens).not.toContain('username');
        expect(tokens).not.toContain('current-password');
        expect(tokens).not.toContain('new-password');
    });

    it('warns about anonymous limits while accounts are offered', async() => {
        comp.serverInfo = null;
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        expect(comp.$el.querySelector('.kiwi-welcome-anonymous-warning')).not.toBe(null);
    });

    it('hides the anonymous warning once accounts are gone', async() => {
        comp.serverInfo = { caps: {}, isupport: {} };
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        expect(comp.$el.querySelector('.kiwi-welcome-anonymous-warning')).toBe(null);
    });

    it('validates each tab on its own fields', () => {
        comp.nick = 'TestNick';
        comp.channel = '#testchan';

        comp.activeTab = 'anonymous';
        expect(comp.formReady).toBe(true);

        comp.activeTab = 'account';
        expect(comp.formReady).toBe(false);
        comp.account = 'TestAccount';
        comp.password = 'secret';
        expect(comp.formReady).toBe(true);
    });

    it('shows the account-derived nick as the override placeholder', async() => {
        comp.activeTab = 'account';
        comp.showAdvanced = true;
        comp.accountNickTouched = true;
        comp.accountNick = '';
        comp.account = 'ankle@phone';
        await comp.$nextTick();
        expect(comp.accountNickSuggestion).toBe('ankle');
        expect(inputByLabel('nick').placeholder).toBe('ankle');
    });

    it('lets an empty override fall back to the account name', () => {
        comp.activeTab = 'account';
        comp.accountNickTouched = true;
        comp.accountNick = '';
        comp.account = 'TestAccount';
        comp.password = 'secret';
        expect(comp.effectiveNick).toBe('TestAccount');
        expect(comp.isNickValid).toBeTruthy();
        expect(comp.readyAccount).toBe(true);
        expect(comp.formReady).toBe(true);
    });

    it('still requires a valid nick when the account name is not nick-safe', () => {
        comp.activeTab = 'account';
        comp.accountNickTouched = true;
        comp.accountNick = '';
        comp.account = '123bad';
        comp.password = 'secret';
        expect(comp.formReady).toBe(false);
    });

    it('connects an empty override with the account-derived name', () => {
        comp.activeTab = 'account';
        comp.accountNickTouched = true;
        comp.accountNick = '';
        comp.account = 'TestAccount';
        comp.password = 'secret';
        comp.startUp('account');
        // The tabs keep their own fields: nothing is written back into
        // the shared nick, the derived name goes out on the connection.
        expect(comp.accountNick).toBe('');
        expect(comp.network.connection.nick).toBe('TestAccount');
        expect(comp.network.connection.account).toBe('TestAccount');
    });

    it('focuses the account input when switching to the account tab', async() => {
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        await comp.$nextTick();
        comp.account = 'TestAccount';
        comp.activeTab = 'account';
        await comp.$nextTick();
        await comp.$nextTick();
        const accountInput = inputByLabel('account').$el.querySelector('input');
        expect(document.activeElement).toBe(accountInput);
    });

    it('focuses the nick input when switching to the anonymous tab', async() => {
        comp.activeTab = 'account';
        await comp.$nextTick();
        await comp.$nextTick();
        comp.nick = '';
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        await comp.$nextTick();
        const nickInput = inputByLabel('nick').$el.querySelector('input');
        expect(document.activeElement).toBe(nickInput);
    });

    it('always shows an account field on the register tab', async() => {
        comp.serverInfo = {
            caps: { 'draft/account-registration': 'before-connect', 'sasl': 'PLAIN' },
            isupport: {},
        };
        comp.activeTab = 'register';
        comp.nick = 'TestNick';
        await comp.$nextTick();
        expect(comp.showRegisterTab).toBe(true);
        // The account IS the nick without custom-account-name, so the
        // old 'registering as' hint is gone and the field is always there.
        expect(inputByLabel('account')).not.toBeUndefined();
        expect(comp.$el.textContent).not.toContain('register_as');
        expect(inputByLabel('nick')).toBeUndefined();
        // The account field is authoritative: username token on it, no
        // nick-derived placeholder.
        expect(inputByLabel('account').autocomplete).toBe('username');
        expect(inputByLabel('account').placeholder).toBeUndefined();
    });

    it('focuses the account input on the register tab with custom names', async() => {
        comp.serverInfo = {
            caps: {
                'draft/account-registration': 'before-connect,custom-account-name',
                'sasl': 'PLAIN',
            },
            isupport: {},
        };
        comp.activeTab = 'register';
        await comp.$nextTick();
        await comp.$nextTick();
        const nameInput = inputByLabel('account').$el.querySelector('input');
        expect(document.activeElement).toBe(nameInput);
    });

    it('focuses the account input on the register tab without custom names', async() => {
        comp.serverInfo = {
            caps: { 'draft/account-registration': 'before-connect', 'sasl': 'PLAIN' },
            isupport: {},
        };
        comp.activeTab = 'register';
        await comp.$nextTick();
        await comp.$nextTick();
        const nameInput = inputByLabel('account')
            .$el.querySelector('input');
        expect(document.activeElement).toBe(nameInput);
    });

    it('collapses nick, channel, and remember password behind Advanced', async() => {
        comp.activeTab = 'account';
        comp.showAdvanced = false;
        await comp.$nextTick();
        expect(comp.$el.querySelector('.kiwi-welcome-advanced-toggle')).not.toBe(null);
        expect(inputByLabel('nick')).toBeUndefined();
        expect(inputByLabel('channel')).toBeUndefined();
        expect(comp.$el.textContent).not.toContain('remember_password');
        // Remember Me itself always stays visible
        expect(comp.$el.textContent).toContain('remember_settings');
        comp.showAdvanced = true;
        await comp.$nextTick();
        expect(inputByLabel('nick')).not.toBeUndefined();
        expect(inputByLabel('channel')).not.toBeUndefined();
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
        // Nick override, channel, and the checkbox all live in the box
        expect(box.querySelectorAll('input').length).toBe(3);
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
                // One tick settles the suspended account watcher, proving
                // the restore does not echo into the nick override.
                await freshComp.$nextTick();
                expect(freshComp.account).toBe('ankle');
                // Anonymous gets the configured default, not the account
                // nick; Register starts blank for the new account.
                expect(freshComp.nick).toMatch(/^kiwi_\d+$/);
                expect(freshComp.accountNick).toBe('');
                expect(freshComp.accountNickSuggestion).toBe('ankle');
                expect(freshComp.registerAccount).toBe('');
            } finally {
                destroyVm(freshVm);
            }
        });

        it('restores only the anonymous tab for an anonymous user', async() => {
            const freshVm = mountWithOptions({ nick: 'AnonNick' });
            try {
                const freshComp = freshVm.$children[0];
                await freshComp.$nextTick();
                expect(freshComp.nick).toBe('AnonNick');
                expect(freshComp.account).toBe('');
                expect(freshComp.accountNick).toBe('');
                // One-time copy so reserving the nick is one click away
                expect(freshComp.registerAccount).toBe('AnonNick');
            } finally {
                destroyVm(freshVm);
            }
        });

        it('registers a fresh name from a blank register tab', async() => {
            const freshVm = mountWithOptions({ nick: 'kiwi_?', account: 'ankle' });
            try {
                const freshComp = freshVm.$children[0];
                await freshComp.$nextTick();
                freshComp.serverInfo = {
                    caps: { 'draft/account-registration': 'before-connect', 'sasl': 'PLAIN' },
                    isupport: {},
                };
                freshComp.channel = '#testchan';
                freshComp.activeTab = 'register';
                freshComp.registerAccount = 'BrandNew';
                freshComp.registerEmail = 'new@example.com';
                freshComp.registerPassword = 'secret123';
                freshComp.startUp('register');
                expect(freshComp.network.connection.nick).toBe('BrandNew');
                expect(freshComp.network.registration.account).toBe('BrandNew');
                // No tab leaked into another: the anonymous nick is still
                // the configured default.
                expect(freshComp.nick).toMatch(/^kiwi_\d+$/);
            } finally {
                destroyVm(freshVm);
            }
        });
    });

    it('keeps the legacy form untouched in bouncer mode', async() => {
        s.settings.startupOptions = { bouncer: true };
        await comp.$nextTick();
        expect(comp.useTabs).toBe(false);
        expect(comp.$el.querySelector('.kiwi-welcome-advanced-toggle')).toBe(null);
        expect(inputByLabel('channel')).not.toBeUndefined();
    });

    it('shows the register nick only with custom names under Advanced', async() => {
        comp.serverInfo = {
            caps: {
                'draft/account-registration': 'before-connect,custom-account-name',
                'sasl': 'PLAIN',
            },
            isupport: {},
        };
        comp.activeTab = 'register';
        comp.showAdvanced = false;
        await comp.$nextTick();
        expect(inputByLabel('nick')).toBeUndefined();
        comp.showAdvanced = true;
        await comp.$nextTick();
        expect(inputByLabel('nick')).not.toBeUndefined();
    });

    it('requires the register account field, never the nick', async() => {
        comp.serverInfo = {
            caps: { 'draft/account-registration': 'before-connect', 'sasl': 'PLAIN' },
            isupport: {},
        };
        comp.activeTab = 'register';
        comp.nick = 'TestNick';
        comp.registerAccount = '';
        comp.registerPassword = 'secret123';
        await comp.$nextTick();
        expect(comp.readyToRegister).toBe(false);
        comp.registerAccount = 'TestNick';
        expect(comp.readyToRegister).toBe(true);
        expect(comp.formReady).toBe(true);
    });

    it('uses the register account verbatim as the nick fallback', async() => {
        comp.serverInfo = {
            caps: { 'draft/account-registration': 'before-connect', 'sasl': 'PLAIN' },
            isupport: {},
        };
        comp.activeTab = 'register';
        comp.nick = '';
        comp.registerAccount = 'SomeAccount';
        await comp.$nextTick();
        // No @suffix strip here: without custom-account-name the
        // account IS the nick.
        expect(comp.effectiveNick).toBe('SomeAccount');
    });

    it('prefers the register account over a stale nick without custom names', async() => {
        comp.serverInfo = {
            caps: { 'draft/account-registration': 'before-connect', 'sasl': 'PLAIN' },
            isupport: {},
        };
        comp.activeTab = 'register';
        // A stale anonymous nick must not win: the account IS the nick,
        // so validation follows the account field.
        comp.nick = 'StaleNick';
        comp.registerAccount = 'FreshAccount';
        await comp.$nextTick();
        expect(comp.effectiveNick).toBe('FreshAccount');
        expect(comp.isNickValid).toBeTruthy();
    });

    it('registers the register account even when a stale nick exists', () => {
        comp.serverInfo = {
            caps: { 'draft/account-registration': 'before-connect', 'sasl': 'PLAIN' },
            isupport: {},
        };
        comp.activeTab = 'register';
        comp.nick = 'StaleNick';
        comp.registerAccount = 'FreshAccount';
        comp.registerEmail = 'fresh@example.com';
        comp.registerPassword = 'secret123';
        comp.startUp('register');
        // The stale anonymous nick is ignored, not overwritten: NICK and
        // the armed REGISTER both target the account the user typed.
        expect(comp.nick).toBe('StaleNick');
        expect(comp.network.connection.nick).toBe('FreshAccount');
        expect(comp.network.registration.account).toBe('FreshAccount');
    });

    it('keeps an explicit nick with custom-account-name on register', () => {
        comp.serverInfo = {
            caps: {
                'draft/account-registration': 'before-connect,custom-account-name',
                'sasl': 'PLAIN',
            },
            isupport: {},
        };
        comp.activeTab = 'register';
        comp.showAdvanced = true;
        comp.registerNick = 'CustomNick';
        comp.registerAccount = 'OtherAccount';
        comp.registerEmail = 'other@example.com';
        comp.registerPassword = 'secret123';
        comp.startUp('register');
        expect(comp.registerNick).toBe('CustomNick');
        expect(comp.network.connection.nick).toBe('CustomNick');
    });
});
