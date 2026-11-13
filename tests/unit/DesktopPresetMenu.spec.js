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
        expect(off).toBe(unsubscribe);

        handler('nephnet');

        expect(state.setting).toHaveBeenCalledWith(
            'buffers.messageLayout',
            'cyberdeck'
        );
        expect(state.setting).toHaveBeenCalledWith('useMonospace', false);
        expect(themeManager.setTheme).toHaveBeenCalledWith('NephDeck');
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
