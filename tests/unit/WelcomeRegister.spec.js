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

describe('Welcome register startup', () => {
    let s;
    let comp;
    let vm;

    beforeEach(() => {
        s = state.create();
        s.settings.startupOptions = {};
        Vue.prototype.$state = s;

        vm = new Vue({
            el: document.createElement('div'),
            render: (h) => h(Welcome),
        });
        comp = vm.$children[0];

        comp.nick = 'RegNick';
        comp.channel = '#testchan';
        comp.serverInfo = {
            caps: {
                'draft/account-registration': 'before-connect,email-required',
            },
            isupport: {},
        };
        comp.activeTab = 'register';
        comp.registerEmail = 'reg@example.com';
        comp.registerPassword = 'secret123';
    });

    afterEach(() => {
        vm.$destroy();
        delete Vue.prototype.$state;
    });

    it('arms pre-connect registration on a fresh network without throwing', () => {
        // The register branch must work when startUp itself is the first code
        // to touch net.ircClient (production lazy-init ordering). This threw
        // `armPreConnectRegistration is not a function` before the ircClient
        // access was moved ahead of the arm call.
        expect(() => comp.startUp('register')).not.toThrow();

        const net = comp.network;
        expect(net.registration.account).toBe('RegNick');
        expect(net.password).toBe('');
        expect(net.connection.password).toBe('');
        expect(net.ircClient.connect).toHaveBeenCalledTimes(1);
    });

    it('connects with the register account without touching other tabs', () => {
        // Without custom-account-name the account IS the nick, and the
        // nick field is hidden: the typed account goes out directly and
        // no other tab's field is modified.
        comp.nick = 'UnrelatedNick';
        comp.registerAccount = 'NewAccount';
        comp.startUp('register');
        expect(comp.nick).toBe('UnrelatedNick');
        expect(comp.network.connection.nick).toBe('NewAccount');
        expect(comp.network.ircClient.connect).toHaveBeenCalledTimes(1);
    });

    it('sends REGISTER and holds CAP END once the cap is ACKed', async() => {
        jest.useFakeTimers();
        try {
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
        } finally {
            jest.useRealTimers();
        }
    });

    describe('username autofill token placement', () => {
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

        it('keeps the token on the account field when the probe has not run', async() => {
            comp.serverInfo = null;
            comp.activeTab = 'account';
            comp.showAdvanced = true;
            await comp.$nextTick();
            expect(comp.nickIsLoginUsername).toBe(false);
            expect(inputByLabel('nick').autocomplete).not.toBe('username');
            expect(inputByLabel('account').autocomplete).toBe('username');
        });

        it('keeps the username token on the register account field', async() => {
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
            expect(inputByLabel('account')).not.toBeUndefined();
            expect(inputByLabel('account').autocomplete).toBe('username');
            expect(inputByLabel('account').placeholder).toBeUndefined();
            expect(inputByLabel('nick')).toBeUndefined();
        });

        it('keeps the token on the account field with custom-account-name', async() => {
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
            expect(inputByLabel('nick').autocomplete).not.toBe('username');
            expect(inputByLabel('account').autocomplete).toBe('username');
        });
    });
});
