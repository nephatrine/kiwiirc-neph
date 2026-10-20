import Vue from 'vue';
import { TextEncoder } from 'util';
import state from '@/libs/state';
// Side-effect global registration, mirroring src/main.js (unknown otherwise)
import '@/components/utils/InputText';
import Welcome from '@/components/startups/Welcome';
// jsdom lacks TextEncoder, which the length checks use during render
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

    it('keeps account credentials when switching tabs', async() => {
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'secret';
        comp.activeTab = 'account';
        await comp.$nextTick();

        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        comp.activeTab = 'account';
        await comp.$nextTick();

        expect(comp.tabs.account.account).toBe('TestAccount');
        expect(comp.tabs.account.password).toBe('secret');
        expect(comp.tabs.anonymous.nick).toBe('AnonNick');
    });

    it('keeps the remembered password checkbox per tab', async() => {
        comp.tabs.account.rememberPasswords = true;
        comp.activeTab = 'account';
        await comp.$nextTick();

        // Anonymous is its own identity and starts unchecked
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        expect(comp.tabs.anonymous.rememberPasswords).toBe(false);

        comp.activeTab = 'account';
        await comp.$nextTick();
        expect(comp.tabs.account.rememberPasswords).toBe(true);
    });

    it('does not let another tab clear a checked Remember Password', async() => {
        comp.tabs.account.rememberPasswords = true;
        comp.tabs.account.account = 'TestAccount';
        comp.tabs.account.password = 'secret';
        comp.activeTab = 'account';
        await comp.$nextTick();
        expect(comp.layoutRememberPasswords).toBe(true);

        // Visiting the anonymous tab used to reset the shared checkbox.
        comp.activeTab = 'anonymous';
        await comp.$nextTick();
        expect(comp.layoutRememberPasswords).toBe(false);

        comp.activeTab = 'account';
        await comp.$nextTick();
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

    it('only shows the password strength meter on the register tab', async() => {
        comp.tabs.register.password = 'secret123';
        comp.tabs.account.password = 'secret123';
        comp.serverInfo = REG_INFO;

        comp.activeTab = 'register';
        await comp.$nextTick();
        expect(comp.$el.querySelector('.kiwi-welcome-password-strength')).not.toBe(null);
        expect(comp.passwordStrength).toBeGreaterThan(0);

        comp.activeTab = 'account';
        await comp.$nextTick();
        expect(comp.$el.querySelector('.kiwi-welcome-password-strength')).toBe(null);
    });

    it('scores stronger passwords higher', () => {
        comp.activeTab = 'register';
        comp.tabs.register.password = 'aaaaaaaa';
        const weak = comp.passwordStrength;
        comp.tabs.register.password = 'Correct-Horse-42!';
        const strong = comp.passwordStrength;
        expect(strong).toBeGreaterThan(weak);
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
        comp.serverInfo = REG_INFO;
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
