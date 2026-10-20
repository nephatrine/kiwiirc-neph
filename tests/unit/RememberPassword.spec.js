import Vue from 'vue';
import { TextEncoder } from 'util';
import state from '@/libs/state';
import StatePersistence from '@/libs/StatePersistence';
// Side-effect global registration, mirroring src/main.js (unknown otherwise)
import '@/components/utils/InputText';
import Welcome from '@/components/startups/Welcome';

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

describe('Remember Password', () => {
    let s;

    beforeEach(() => {
        s = state.create();
        s.settings.startupOptions = {};
    });

    afterEach(() => {
        delete Vue.prototype.$state;
        jest.useRealTimers();
    });

    function addPasswordNetwork() {
        const net = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        net.password = 'sasl-secret';
        net.connection.password = 'server-secret';
        net.connection.account = 'TestAccount';
        return net;
    }

    it('exports passwords by default', () => {
        addPasswordNetwork();
        const exported = JSON.parse(s.exportState(true));
        expect(exported.networks[0].password).toBe('sasl-secret');
        expect(exported.networks[0].connection.password).toBe('server-secret');
    });

    it('strips both passwords but keeps the account when excluded', () => {
        addPasswordNetwork();
        const exported = JSON.parse(s.exportState(true, false));
        expect(exported.networks[0].password).toBe('');
        expect(exported.networks[0].connection.password).toBe('');
        expect(exported.networks[0].connection.account).toBe('TestAccount');
        expect(exported.networks[0].connection.nick).toBe('TestNick');
    });

    it('passes the persistence flag through to saved state', async() => {
        jest.useFakeTimers();
        addPasswordNetwork();
        const storage = { set: jest.fn(), get: jest.fn() };
        const persistence = new StatePersistence('test-key', s, storage);
        persistence.includePasswords = false;
        persistence.watchStateForChanges();
        s.networks[0].gecos = 'changed';
        await Vue.nextTick();
        jest.advanceTimersByTime(1000);
        expect(storage.set).toHaveBeenCalled();
        const saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks[0].password).toBe('');
        expect(saved.networks[0].connection.password).toBe('');
        persistence.stopWatchingState();
    });

    it('flushes synchronously on demand, bypassing the debounce', async() => {
        addPasswordNetwork();
        const storage = { set: jest.fn(), get: jest.fn() };
        const persistence = new StatePersistence('test-key', s, storage);
        persistence.includePasswords = false;
        await persistence.saveStateNow();
        expect(storage.set).toHaveBeenCalledTimes(1);
        const saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks[0].password).toBe('');
        expect(saved.networks[0].connection.password).toBe('');
        expect(saved.networks[0].connection.account).toBe('TestAccount');
    });

    it('saveStateNow keeps passwords when the flag allows them', async() => {
        addPasswordNetwork();
        const storage = { set: jest.fn(), get: jest.fn() };
        const persistence = new StatePersistence('test-key', s, storage);
        await persistence.saveStateNow();
        const saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks[0].password).toBe('sasl-secret');
        expect(saved.networks[0].connection.password).toBe('server-secret');
    });

    describe('welcome checkbox', () => {
        let comp;
        let vm;

        beforeEach(() => {
            Vue.prototype.$state = s;
            vm = new Vue({
                el: document.createElement('div'),
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
        });

        it('defaults to unchecked but enabled on the account tab', () => {
            expect(comp.activeTab).toBe('account');
            expect(comp.tabs.account.rememberPasswords).toBe(false);
            expect(comp.rememberPasswordDisabled).toBe(false);
        });

        it('is disabled on the anonymous tab and follows Remember Me', async() => {
            comp.activeTab = 'anonymous';
            await comp.$nextTick();
            expect(comp.rememberPasswordDisabled).toBe(true);

            comp.activeTab = 'account';
            comp.tabs.account.rememberPasswords = true;
            await comp.$nextTick();
            expect(comp.rememberPasswordDisabled).toBe(false);

            comp.tabs.account.rememberSettings = false;
            await comp.$nextTick();
            expect(comp.rememberPasswordDisabled).toBe(true);
            // Disabling never throws away the tab's own choice: turning
            // Remember Me back on restores the checkbox as it was.
            expect(comp.tabs.account.rememberPasswords).toBe(true);
            expect(comp.layoutRememberPasswords).toBe(false);
        });

        it('keeps the flat single-form rule outside tabbed mode', async() => {
            // Replacing the object: adding a bouncer key to the mounted
            // object would not be reactive under Vue 2.
            s.settings.startupOptions = { bouncer: true };
            await comp.$nextTick();
            expect(comp.useTabs).toBe(false);
            comp.showPass = true;
            comp.toggablePass = false;
            await comp.$nextTick();
            expect(comp.rememberPasswordDisabled).toBe(false);
        });

        it('writes the preference when the login starts', () => {
            comp.tabs.account.account = 'TestAccount';
            comp.tabs.account.password = 'secret';
            comp.tabs.account.rememberPasswords = true;
            comp.startUp('account');
            const net = comp.network;
            net.ircClient.emit('registered', { nick: 'TestNick' });
            expect(s.user_settings.remember_password).toBe(true);
        });

        it('writes a false preference when left unchecked', () => {
            comp.tabs.account.account = 'TestAccount';
            comp.tabs.account.password = 'secret';
            comp.startUp('account');
            const net = comp.network;
            net.ircClient.emit('registered', { nick: 'TestNick' });
            expect(s.user_settings.remember_password).toBe(false);
        });
    });
});
