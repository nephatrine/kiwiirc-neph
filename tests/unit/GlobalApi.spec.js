import GlobalApi from '@/libs/GlobalApi';

/* eslint-disable no-underscore-dangle */

// src/main.js supplies these through webpack's DefinePlugin; jest does not.
global.__VERSION__ = '2.0.0';
global.__COMMITHASH__ = 'testhash';

function makeState() {
    const state = {
        emitted: [],
        $emit(...args) {
            state.emitted.push(args);
        },
    };
    return state;
}

describe('GlobalApi plugin surface', () => {
    let api;
    let state;

    beforeEach(() => {
        // Keep plugin/require failures from polluting the test output; tests
        // that care assert against this spy.
        jest.spyOn(window.console, 'error').mockImplementation(() => {});
        window._kiwi_exports = {};
        api = new GlobalApi();
        state = makeState();
        api.setState(state);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete window._kiwi_exports;
    });

    it('showInSidebar emits sidebar.component with its props and id', () => {
        let component = { name: 'SidebarThing' };
        api.showInSidebar(component, { network: 'net' }, 'plugin-a');

        expect(state.emitted).toEqual([
            ['sidebar.component', expect.any(Function), { network: 'net' }, 'plugin-a'],
        ]);
    });

    it('showInSidebar defaults the id to null', () => {
        api.showInSidebar({ name: 'Thing' }, {});

        expect(state.emitted).toEqual([
            ['sidebar.component', expect.any(Function), {}, null],
        ]);
    });

    it('toggleInSidebar emits sidebar.component.toggle with its id', () => {
        api.toggleInSidebar('plugin-a', { name: 'Thing' }, { tab: 1 });

        expect(state.emitted).toEqual([
            ['sidebar.component.toggle', 'plugin-a', expect.any(Function), { tab: 1 }],
        ]);
    });

    it('addUi routes each type to its plugin list', () => {
        let component = { name: 'Thing' };
        api.addUi('input', component);
        api.addUi('browser', component);
        api.addUi('header_channel', component);
        api.addUi('header_query', component);
        api.addUi('userbox_button', component);
        api.addUi('userbox_info', component);
        api.addUi('userbox_whois', component);
        api.addUi('about_buffer', component);
        api.addUi('message_info', component);

        expect(api.controlInputPlugins).toHaveLength(1);
        expect(api.stateBrowserPlugins).toHaveLength(1);
        expect(api.channelHeaderPlugins).toHaveLength(1);
        expect(api.queryHeaderPlugins).toHaveLength(1);
        expect(api.userboxButtonPlugins).toHaveLength(1);
        expect(api.userboxInfoPlugins).toHaveLength(1);
        expect(api.userboxWhoisPlugins).toHaveLength(1);
        expect(api.aboutBufferPlugins).toHaveLength(1);
        expect(api.messageInfoPlugins).toHaveLength(1);
    });

    it('addUi ignores unknown types', () => {
        api.addUi('not-a-real-type', { name: 'Thing' });

        expect(api.stateBrowserPlugins).toHaveLength(0);
        expect(api.controlInputPlugins).toHaveLength(0);
    });

    it('addUi wraps the component and keeps its props and title', () => {
        api.addUi('browser', { name: 'Thing' }, { title: 'My Panel', props: { extra: true } });

        let plugin = api.stateBrowserPlugins[0];
        expect(typeof plugin.component).toBe('function');
        expect(plugin.props).toEqual({ extra: true });
        expect(plugin.title()).toBe('My Panel');
    });

    it('addTab routes each type to its plugin list', () => {
        let component = { name: 'Thing' };
        api.addTab('channel', 'Channels', component);
        api.addTab('settings', 'Settings', component);
        api.addTab('server', 'Server', component);
        api.addTab('nope', 'Nope', component);

        expect(api.sideBarPlugins).toHaveLength(1);
        expect(api.appSettingsPlugins).toHaveLength(1);
        expect(api.serverViewPlugins).toHaveLength(1);
        expect(api.sideBarPlugins[0].title()).toBe('Channels');
    });

    it('addView registers a view that showView can present', () => {
        api.addView('myview', { name: 'Thing' });

        api.showView('myview');
        expect(state.emitted[0][0]).toBe('active.component');
        expect(state.emitted[0][1]).toBe(api.tabs.myview.component);

        api.showView('missing');
        expect(state.emitted[1]).toEqual(['active.component', null]);
    });

    it('setConfigDefaults only writes settings that are unset', () => {
        let store = { 'settings.plugin-x.keep': 'configured' };
        api.state.getSetting = (key) => store[key];
        api.state.setSetting = (key, value) => {
            store[key] = value;
        };

        api.setConfigDefaults('plugin-x', { keep: 'default', fill: 'new', nested: { deep: 1 } });

        expect(store['settings.plugin-x.keep']).toBe('configured');
        expect(store['settings.plugin-x.fill']).toBe('new');
        expect(store['settings.plugin-x.nested.deep']).toBe(1);
    });

    it('defers plugins registered before init and runs them once ready', () => {
        let ran = [];
        api.isReady = false;
        api.plugin('early', () => ran.push('early'));
        expect(ran).toEqual([]);

        api.isReady = true;
        api.initPlugins();
        expect(ran).toEqual(['early']);

        api.plugin('late', () => ran.push('late'));
        expect(ran).toEqual(['early', 'late']);
    });

    it('logs a throwing plugin instead of aborting the load', () => {
        api.isReady = true;

        expect(() => api.plugin('boom', () => {
            throw new Error('nope');
        })).not.toThrow();
        expect(window.console.error).toHaveBeenCalled();
    });

    it('require resolves modules out of _kiwi_exports', () => {
        window._kiwi_exports = { helpers: { Misc: { hello: 'world' } } };
        let fresh = new GlobalApi();

        expect(fresh.require('helpers/Misc')).toEqual({ hello: 'world' });
    });

    it('require logs when the module is missing', () => {
        let fresh = new GlobalApi();

        expect(fresh.require('does/not/exist')).toBeUndefined();
        expect(window.console.error).toHaveBeenCalled();
    });

    it('versionMatches compares against the build version', () => {
        expect(api.versionMatches('2.0.0')).toBe(true);
        expect(api.versionMatches('1.5.0')).toBe(true);
        expect(api.versionMatches('3.0.0')).toBe(false);
    });

    it('forwards state events on to plugin listeners', () => {
        let seen = [];
        api.on('all', (name) => seen.push('all:' + name));
        api.on('custom.event', () => seen.push('direct'));

        state.$emit('custom.event', 1);

        expect(seen).toContain('all:custom.event');
        expect(seen).toContain('direct');
    });
});
