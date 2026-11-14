const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
    DEFAULT_SETTINGS,
    createDesktopSettingsStore,
    normalizeSettings,
} = require('../../desktop/electron/desktop-settings');

describe('desktop settings', () => {
    let userDataDir;

    beforeEach(async() => {
        userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-desktop-settings-'));
    });

    afterEach(async() => {
        await fs.rm(userDataDir, { recursive: true, force: true });
    });

    it('defaults close-to-tray on and spellcheck on', async() => {
        const store = createDesktopSettingsStore(userDataDir);

        expect(await store.load()).toEqual(DEFAULT_SETTINGS);
        expect(store.get()).toEqual(DEFAULT_SETTINGS);
        expect(DEFAULT_SETTINGS.autoLaunch).toBe(false);
        expect(DEFAULT_SETTINGS.spellcheck).toBe(true);
    });

    it('persists desktop setting changes', async() => {
        const store = createDesktopSettingsStore(userDataDir);
        await store.load();

        expect(await store.set({
            closeToTray: false,
            autoLaunch: true,
            spellcheck: false,
        })).toEqual({
            version: 1,
            closeToTray: false,
            autoLaunch: true,
            spellcheck: false,
        });

        const restored = createDesktopSettingsStore(userDataDir);
        expect(await restored.load()).toEqual({
            version: 1,
            closeToTray: false,
            autoLaunch: true,
            spellcheck: false,
        });
    });

    it('falls back to defaults for corrupt files', async() => {
        await fs.writeFile(
            path.join(userDataDir, 'desktop-settings.json'),
            '{not-json',
            'utf8'
        );

        const store = createDesktopSettingsStore(userDataDir);
        expect(await store.load()).toEqual(DEFAULT_SETTINGS);
    });

    it('normalizes invalid values', () => {
        expect(normalizeSettings({
            closeToTray: 'yes',
            autoLaunch: 'no',
            spellcheck: 1,
        })).toEqual({
            version: 1,
            closeToTray: true,
            autoLaunch: false,
            spellcheck: true,
        });
    });
});
