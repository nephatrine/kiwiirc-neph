import state from '@/libs/state';
import {
    DESKTOP_THEME_PREFIX,
    mergeInstalledThemes,
    themeFromDescriptor
} from '@/libs/InstalledThemes';

describe('installed desktop themes', () => {
    let s;

    beforeEach(() => {
        s = state.create();
        s.settings = {
            ...s.settings,
            themes: [{
                name: 'Built-in',
                url: 'static/themes/built-in',
            }],
        };
    });

    afterEach(() => {
        s.$destroy();
    });

    test('converts descriptors and merges them after configured themes', () => {
        const theme = themeFromDescriptor({
            id: 'my-theme-abcd1234',
            name: 'My Theme',
            mode: 'dark',
            google_fonts: ['Inter'],
            url: 'kiwi-theme://my-theme-abcd1234',
        });

        expect(theme).toMatchObject({
            name: DESKTOP_THEME_PREFIX + 'my-theme-abcd1234',
            displayName: 'My Theme',
            url: 'kiwi-theme://my-theme-abcd1234',
            mode: 'dark',
            google_fonts: ['Inter'],
            installed: true,
            desktopThemeId: 'my-theme-abcd1234',
        });

        const themes = mergeInstalledThemes(s, [{
            id: 'my-theme-abcd1234',
            name: 'My Theme',
            url: 'kiwi-theme://my-theme-abcd1234',
        }]);

        expect(themes.map((entry) => entry.name)).toEqual([
            'Built-in',
            DESKTOP_THEME_PREFIX + 'my-theme-abcd1234',
        ]);
        expect(s.settings.themes).toBe(themes);
    });

    test('replaces installed entries on refresh and removes them when gone', () => {
        mergeInstalledThemes(s, [{
            id: 'first-abcd1234',
            name: 'First',
            url: 'kiwi-theme://first-abcd1234',
        }]);

        let themes = mergeInstalledThemes(s, [{
            id: 'second-abcd1234',
            name: 'Second',
            url: 'kiwi-theme://second-abcd1234',
        }]);

        expect(themes.map((entry) => entry.displayName || entry.name)).toEqual([
            'Built-in',
            'Second',
        ]);

        themes = mergeInstalledThemes(s, []);

        expect(themes.map((entry) => entry.name)).toEqual(['Built-in']);
    });
});
