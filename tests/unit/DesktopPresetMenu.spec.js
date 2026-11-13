import { initDesktopPresetMenu } from '@/libs/desktop/PresetMenu';

function createState() {
    return {
        setting: jest.fn(),
    };
}

function createThemeManager() {
    return {
        findTheme: jest.fn(() => ({ name: 'NephDeck', url: 'static/themes/test' })),
        setTheme: jest.fn(),
    };
}

describe('desktop preset menu bridge', () => {
    afterEach(() => {
        delete window.kiwiDesktop;
    });

    it('applies a preset received from the native menu', () => {
        let handler = null;
        const unsubscribe = jest.fn();
        window.kiwiDesktop = {
            presets: {
                onApply: jest.fn((fn) => {
                    handler = fn;
                    return unsubscribe;
                }),
            },
        };
        const state = createState();
        const themeManager = createThemeManager();

        const off = initDesktopPresetMenu(state, themeManager);

        expect(window.kiwiDesktop.presets.onApply).toHaveBeenCalledWith(
            expect.any(Function)
        );
        expect(typeof off).toBe('function');

        handler('nephnet');

        expect(state.setting).toHaveBeenCalledWith(
            'buffers.messageLayout',
            'cyberdeck'
        );
        expect(state.setting).toHaveBeenCalledWith('useMonospace', false);
        expect(themeManager.setTheme).toHaveBeenCalledWith('NephDeck');

        off();
        expect(unsubscribe).toHaveBeenCalled();
    });

    it('reports enabled presets and updates when themes change', () => {
        let themeWatcher = null;
        const unsubscribe = jest.fn();
        const unwatch = jest.fn();
        const setAvailable = jest.fn();
        const state = {
            setting: jest.fn(),
            $watch: jest.fn((expression, handler) => {
                if (expression === 'settings.themes') {
                    themeWatcher = handler;
                }
                return unwatch;
            }),
        };
        const themeManager = {
            findTheme: jest.fn((name) => (
                name === 'NephDeck' ? { name } : null
            )),
            setTheme: jest.fn(),
        };

        window.kiwiDesktop = {
            presets: {
                onApply: jest.fn(() => unsubscribe),
                setAvailable,
            },
        };

        const off = initDesktopPresetMenu(state, themeManager);

        expect(setAvailable).toHaveBeenCalledWith([
            { id: 'nephnet', label: 'NephNET' },
        ]);
        expect(state.$watch).toHaveBeenCalledWith(
            'settings.themes',
            expect.any(Function),
            { deep: true }
        );

        themeManager.findTheme.mockImplementation((name) => (
            name === 'NephDeck' || name === 'NephWave' ? { name } : null
        ));
        themeWatcher();

        expect(setAvailable).toHaveBeenLastCalledWith([
            { id: 'nephnet', label: 'NephNET' },
            { id: 'aim', label: 'AIM' },
        ]);

        off();
        expect(unsubscribe).toHaveBeenCalled();
        expect(unwatch).toHaveBeenCalled();
    });

    it('ignores unknown preset ids', () => {
        let handler = null;
        window.kiwiDesktop = {
            presets: {
                onApply: jest.fn((fn) => {
                    handler = fn;
                    return () => {};
                }),
            },
        };
        const state = createState();
        const themeManager = createThemeManager();

        initDesktopPresetMenu(state, themeManager);
        handler('unknown');

        expect(state.setting).not.toHaveBeenCalled();
        expect(themeManager.setTheme).not.toHaveBeenCalled();
    });

    it('is inert outside the desktop app', () => {
        const state = createState();
        const themeManager = createThemeManager();

        expect(typeof initDesktopPresetMenu(state, themeManager)).toBe('function');
        expect(state.setting).not.toHaveBeenCalled();
    });
});
