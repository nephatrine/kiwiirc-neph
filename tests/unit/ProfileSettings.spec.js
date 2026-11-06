import Vue from 'vue';
import state from '@/libs/state';
import ProfileSettings from '@/components/ProfileSettings';
import * as MetadataCache from '@/libs/MetadataCache';

jest.mock('@/libs/MetadataCache', () => ({
    ...jest.requireActual('@/libs/MetadataCache'),
    clear: jest.fn(),
    flush: jest.fn(),
}));

Vue.mixin({
    computed: {
        $t() {
            return (key) => key;
        },
    },
});

describe('Profile settings', () => {
    let s;
    let vm;

    beforeEach(() => {
        s = state.create();
        s.settings.startupOptions = {};
        const network = s.addNetwork('ProfileNet', 'ProfileNick', {
            server: 'irc.example.com',
        });
        network.password = 'sasl-secret';
        network.connection.password = 'server-secret';
        network.connection.account = 'ProfileAccount';
        s.persistence = {
            saveStateNow: jest.fn(async() => ({
                secretsSaved: true,
                stateSaved: true,
            })),
        };
        Vue.prototype.$state = s;
        window.kiwiDesktop = {
            profile: {
                export: jest.fn(async() => ({ saved: true })),
                import: jest.fn(),
                backup: jest.fn(async() => '/tmp/backup'),
                openFolder: jest.fn(),
            },
        };
        window.confirm = jest.fn(() => true);
        MetadataCache.flush.mockResolvedValue();
    });

    afterEach(() => {
        if (vm) {
            vm.$destroy();
            if (vm.$el.parentNode) {
                vm.$el.parentNode.removeChild(vm.$el);
            }
        }
        delete Vue.prototype.$state;
        delete window.kiwiDesktop;
        delete window.confirm;
    });

    function mount() {
        const mountEl = document.createElement('div');
        document.body.appendChild(mountEl);
        vm = new Vue({
            el: mountEl,
            render: (h) => h(ProfileSettings),
        });
        return vm.$children[0];
    }

    it('allows export but hides import outside Personal mode', async() => {
        s.settings.startupScreen = 'customServer';
        const comp = mount();

        expect(comp.$el.querySelector('.kiwi-profile-export')).not.toBeNull();
        expect(comp.$el.querySelector('.kiwi-profile-import')).toBeNull();

        await comp.chooseImport();

        expect(window.kiwiDesktop.profile.import).not.toHaveBeenCalled();
        expect(comp.statusMessage).toBe('profile_import_personal_only');
    });

    it('shows import in Personal mode', async() => {
        s.settings.startupScreen = 'personal';
        const comp = mount();
        await Vue.nextTick();

        expect(comp.$el.querySelector('.kiwi-profile-import')).not.toBeNull();
    });

    it('exports state without passwords by default', async() => {
        const comp = mount();

        await comp.exportProfile();

        const text = window.kiwiDesktop.profile.export.mock.calls[0][0];
        const bundle = JSON.parse(text);
        expect(bundle.state.networks[0].password).toBe('');
        expect(bundle.state.networks[0].connection.password).toBe('');
        expect(bundle.secrets).toBeUndefined();
        expect(s.persistence.saveStateNow).toHaveBeenCalled();
    });

    it('exports separate plaintext secrets when requested', async() => {
        const comp = mount();
        comp.includePasswords = true;

        await comp.exportProfile();

        const text = window.kiwiDesktop.profile.export.mock.calls[0][0];
        const bundle = JSON.parse(text);
        expect(bundle.state.networks[0].password).toBe('');
        expect(bundle.state.networks[0].connection.password).toBe('');
        expect(bundle.secrets).toEqual({
            1: {
                connection: 'server-secret',
                sasl: 'sasl-secret',
            },
        });
        expect(window.confirm).toHaveBeenCalled();
    });
});
