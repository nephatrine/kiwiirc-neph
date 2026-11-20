/* eslint-disable no-underscore-dangle */
import Vue from 'vue';
import { TextEncoder } from 'util';
import state from '@/libs/state';
import ThemeManager from '@/libs/ThemeManager';
import UserBox from '@/components/UserBox';
import {
    passwordLevelClass,
    passwordLevelLabelKey,
    passwordScore
} from '@/helpers/PasswordStrength';

global.__VERSION__ = 'test';
global.__COMMITHASH__ = 'test';

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

const CAP_VALUE = [
    'custom-account-name',
    'email-required',
    'min-password-length=8',
    'max-password-length=16',
].join(',');

describe('UserBox registration', () => {
    let s;
    let network;
    let user;
    let vm;
    let comp;

    beforeEach(async() => {
        s = state.create();
        Vue.prototype.$state = s;
        ThemeManager.instance(s);

        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });
        network.state = 'connected';
        network.nick = 'TestNick';
        network.enabled_caps = ['draft/account-registration'];
        network.cap_values = {
            'draft/account-registration': CAP_VALUE,
        };
        user = s.addUser(network, { nick: 'TestNick' });

        const mountEl = document.createElement('div');
        document.body.appendChild(mountEl);
        vm = new Vue({
            el: mountEl,
            render: (h) => h(UserBox, {
                props: {
                    network,
                    buffer: network.buffers[0],
                    user,
                    sidebarState: {},
                },
            }),
        });
        comp = vm.$children[0];
        comp.startRegistration();
        await Vue.nextTick();
    });

    afterEach(() => {
        vm.$destroy();
        if (vm.$el.parentNode) {
            vm.$el.parentNode.removeChild(vm.$el);
        }
        delete Vue.prototype.$state;
    });

    function registerInput(autocomplete) {
        return comp.$el.querySelector(`input[autocomplete="${autocomplete}"]`);
    }

    it('places password before email and shows the strength class and label', async() => {
        const password = registerInput('new-password');
        const email = registerInput('email');

        expect(password).toBeTruthy();
        expect(email).toBeTruthy();
        expect(password.compareDocumentPosition(email))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);

        comp.registerForm.password = 'abc';
        await Vue.nextTick();

        const strength = comp.$el.querySelector('.kiwi-welcome-password-strength');
        const passwordAfter = registerInput('new-password');
        const emailAfter = registerInput('email');

        expect(strength).toBeTruthy();
        expect(passwordAfter.compareDocumentPosition(strength))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(strength.compareDocumentPosition(emailAfter))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);

        expect(comp.registerPasswordStrength).toBe(0);
        expect(comp.registerPasswordStrengthClass)
            .toBe('kiwi-welcome-password-strength-level--easy');
        expect(comp.registerPasswordStrengthLabel).toBe('password_strength_easy');
        expect(comp.$el.querySelector('.kiwi-welcome-password-strength-level--easy')).toBeTruthy();

        comp.registerForm.password = 'Zxcvbn9!';
        await Vue.nextTick();

        expect(comp.registerPasswordStrength).toBe(5);
        expect(comp.registerPasswordStrengthClass)
            .toBe('kiwi-welcome-password-strength-level--medium');
        expect(comp.registerPasswordStrengthLabel).toBe('password_strength_medium');
        expect(comp.$el.querySelector('.kiwi-welcome-password-strength-level--medium')).toBeTruthy();

        comp.registerForm.password = '2hAj5#mne-ix.86H';
        await Vue.nextTick();

        expect(comp.registerPasswordStrength).toBe(14);
        expect(comp.registerPasswordStrengthClass)
            .toBe('kiwi-welcome-password-strength-level--extremely-strong');
        expect(comp.registerPasswordStrengthLabel)
            .toBe('password_strength_extremely_strong');
    });

    it('maps PwScore levels to the five strength labels', () => {
        const cases = [
            ['Ab1!Ab1!Ab1!', 0, 'easy', 'password_strength_easy'],
            ['P@ssw0rd', 5, 'medium', 'password_strength_medium'],
            ['Tom19881010!', 7, 'strong', 'password_strength_strong'],
            ['correct-horse-Battery-9', 11, 'very-strong', 'password_strength_very_strong'],
            ['2hAj5#mne-ix.86H', 14, 'extremely-strong', 'password_strength_extremely_strong'],
        ];

        cases.forEach(([password, points, levelClass, label]) => {
            expect(passwordScore(password)).toBe(points);
            expect(passwordLevelClass(password))
                .toBe(`kiwi-welcome-password-strength-level--${levelClass}`);
            expect(passwordLevelLabelKey(password)).toBe(label);
        });
    });

    it('enforces the account-registration length and required fields', () => {
        comp.registerForm.account = 'newaccount';
        comp.registerForm.email = 'user@example.com';

        comp.registerForm.password = 'abcdefg';
        expect(comp.registerValid).toBe(false);

        comp.registerForm.password = 'abcdefgh';
        expect(comp.registerValid).toBe(true);

        comp.registerForm.password = 'é'.repeat(4);
        expect(comp.registerValid).toBe(true);

        comp.registerForm.password = 'abcdefghijklmnopq';
        expect(comp.registerValid).toBe(false);

        comp.registerForm.password = 'abcdefgh';
        comp.registerForm.email = '';
        expect(comp.registerValid).toBe(false);

        comp.registerForm.email = 'user@example.com';
        comp.registerForm.account = '';
        expect(comp.registerValid).toBe(false);
    });
});
