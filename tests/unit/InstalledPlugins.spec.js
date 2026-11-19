import state from '@/libs/state';
import {
    DESKTOP_PLUGIN_PREFIX,
    mergeInstalledPlugins,
    pluginFromDescriptor
} from '@/libs/InstalledPlugins';

describe('installed desktop plugins', () => {
    let s;

    beforeEach(() => {
        s = state.create();
        s.settings = {
            ...s.settings,
            plugins: [{
                name: 'Built-in',
                url: 'static/plugins/built-in.html',
            }],
        };
    });

    afterEach(() => {
        s.$destroy();
    });

    test('converts descriptors and merges them after configured plugins', () => {
        const plugin = pluginFromDescriptor({
            id: 'my-plugin-abcd1234',
            name: 'My Plugin',
            description: 'Does a thing',
            version: '2.0.0',
            url: 'kiwi-plugin://my-plugin-abcd1234/plugin.js',
        });

        expect(plugin).toEqual({
            name: DESKTOP_PLUGIN_PREFIX + 'my-plugin-abcd1234',
            url: 'kiwi-plugin://my-plugin-abcd1234/plugin.js',
            installed: true,
            desktopPluginId: 'my-plugin-abcd1234',
            displayName: 'My Plugin',
            description: 'Does a thing',
            version: '2.0.0',
        });

        const plugins = mergeInstalledPlugins(s, [{
            id: 'my-plugin-abcd1234',
            name: 'My Plugin',
            url: 'kiwi-plugin://my-plugin-abcd1234/plugin.js',
        }]);

        expect(plugins.map((entry) => entry.name)).toEqual([
            'Built-in',
            DESKTOP_PLUGIN_PREFIX + 'my-plugin-abcd1234',
        ]);
        expect(s.settings.plugins).toBe(plugins);
    });

    test('replaces installed entries on refresh and removes them when gone', () => {
        mergeInstalledPlugins(s, [{
            id: 'first-abcd1234',
            name: 'First',
            url: 'kiwi-plugin://first-abcd1234/plugin.js',
        }]);

        let plugins = mergeInstalledPlugins(s, [{
            id: 'second-abcd1234',
            name: 'Second',
            url: 'kiwi-plugin://second-abcd1234/plugin.js',
        }]);

        expect(plugins.map((entry) => entry.displayName || entry.name))
            .toEqual(['Built-in', 'Second']);

        plugins = mergeInstalledPlugins(s, []);

        expect(plugins.map((entry) => entry.name)).toEqual(['Built-in']);
    });

    test('ignores duplicate or malformed descriptors', () => {
        const plugins = mergeInstalledPlugins(s, [
            null,
            {},
            {
                id: 'my-plugin-abcd1234',
                name: 'My Plugin',
                url: 'kiwi-plugin://my-plugin-abcd1234/plugin.js',
            },
            {
                id: 'my-plugin-abcd1234',
                name: 'Duplicate',
                url: 'kiwi-plugin://my-plugin-abcd1234/other.js',
            },
        ]);

        expect(plugins).toHaveLength(2);
        expect(plugins[1].displayName).toBe('My Plugin');
    });
});
