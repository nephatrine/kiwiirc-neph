import Vue from 'vue';
import state from '@/libs/state';
import GlobalApi from '@/libs/GlobalApi';
import SidebarState from '@/components/SidebarState';

// The listen() helper and $state are installed by main.js in the real app.
// Replicate the small parts SidebarState needs here.
Vue.mixin({
    methods: {
        listen(source, event, fn) {
            this.listeningEvents = this.listeningEvents || [];
            let off = () => {
                let remove = source.removeEventListener || source.$off || source.off;
                remove.call(source, event, fn);
            };
            this.listeningEvents.push(off);
            (source.addEventListener || source.$on || source.on).call(source, event, fn);
            return off;
        },
    },
});

let testState = null;
Vue.mixin({
    computed: {
        $state() {
            return testState;
        },
    },
});

describe('sidebar component toggle', () => {
    let vm = null;

    beforeEach(() => {
        testState = state.create();
        vm = new SidebarState({
            // SidebarState is a headless Vue.extend with no template
            render: (h) => h('div'),
        });
        vm.$mount();
    });

    afterEach(() => {
        vm.$destroy();
        vm = null;
    });

    it('shows a component with an id and reports it open', () => {
        let component = { template: '<div />' };
        testState.$emit('sidebar.component', component, { foo: 'bar' }, 'plugin-a');
        expect(vm.sidebarOpen).toBe(true);
        expect(vm.activeComponent).toBe(component);
        expect(vm.activeComponentProps).toEqual({ foo: 'bar' });
        expect(vm.activeComponentId).toBe('plugin-a');
        expect(vm.section()).toBe('component');
        expect(vm.isComponentOpen('plugin-a')).toBe(true);
        expect(vm.isComponentOpen('plugin-b')).toBe(false);
    });

    it('toggle closes the open component with the same id', () => {
        let component = { template: '<div />' };
        testState.$emit('sidebar.component', component, {}, 'plugin-a');
        expect(vm.isComponentOpen('plugin-a')).toBe(true);

        testState.$emit('sidebar.component.toggle', 'plugin-a', component, {});
        expect(vm.sidebarOpen).toBe(false);
        expect(vm.activeComponent).toBe(null);
        expect(vm.activeComponentId).toBe(null);
        expect(vm.isComponentOpen('plugin-a')).toBe(false);
    });

    it('toggle with a different id switches components', () => {
        let first = { template: '<div />' };
        let second = { template: '<span />' };
        testState.$emit('sidebar.component', first, {}, 'plugin-a');

        testState.$emit('sidebar.component.toggle', 'plugin-b', second, {});
        expect(vm.sidebarOpen).toBe(true);
        expect(vm.activeComponent).toBe(second);
        expect(vm.isComponentOpen('plugin-a')).toBe(false);
        expect(vm.isComponentOpen('plugin-b')).toBe(true);
    });

    it('legacy shows without an id still work and match no id', () => {
        let component = { template: '<div />' };
        testState.$emit('sidebar.component', component, {});
        expect(vm.sidebarOpen).toBe(true);
        expect(vm.activeComponentId).toBe(null);
        expect(vm.isComponentOpen('plugin-a')).toBe(false);
    });

    it('showing a built-in section clears the component id', () => {
        let component = { template: '<div />' };
        testState.$emit('sidebar.component', component, {}, 'plugin-a');
        expect(vm.isComponentOpen('plugin-a')).toBe(true);

        let network = testState.addNetwork('TestNetwork', 'TestNick', {});
        testState.getOrAddBufferByName(network.id, '#chan');
        testState.setActiveBuffer(network.id, '#chan');

        vm.showNicklist();
        expect(vm.isComponentOpen('plugin-a')).toBe(false);
        expect(vm.section()).toBe('nicklist');
    });

    it('GlobalApi passes ids through and toggles end to end', () => {
        // eslint-disable-next-line no-underscore-dangle
        global.__VERSION__ = 'test';
        // eslint-disable-next-line no-underscore-dangle
        global.__COMMITHASH__ = 'test';
        let api = new GlobalApi();
        api.state = testState;

        let emitSpy = jest.spyOn(testState, '$emit');
        let component = { template: '<div />' };

        api.showInSidebar(component, { network: 'net' }, 'channels-sidebar');
        expect(emitSpy).toHaveBeenCalledWith(
            'sidebar.component',
            expect.anything(),
            { network: 'net' },
            'channels-sidebar'
        );
        expect(vm.isComponentOpen('channels-sidebar')).toBe(true);

        api.toggleInSidebar('channels-sidebar', component, { network: 'net' });
        expect(emitSpy).toHaveBeenCalledWith(
            'sidebar.component.toggle',
            'channels-sidebar',
            expect.anything(),
            { network: 'net' }
        );
        expect(vm.isComponentOpen('channels-sidebar')).toBe(false);
        emitSpy.mockRestore();
    });
});
