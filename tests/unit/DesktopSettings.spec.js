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

    it('defaults close-to-tray on', async() => {
        const store = createDesktopSettingsStore(userDataDir);

        expect(await store.load()).toEqual(DEFAULT_SETTINGS);
        expect(store.get()).toEqual(DEFAULT_SETTINGS);
    });

    it('persists a close-to-tray change', async() => {
        const store = createDesktopSettingsStore(userDataDir);
        await store.load();

        expect(await store.set({ closeToTray: false })).toEqual({
            version: 1,
            closeToTray: false,
        });

        const restored = createDesktopSettingsStore(userDataDir);
        expect(await restored.load()).toEqual({
            version: 1,
            closeToTray: false,
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
        expect(normalizeSettings({ closeToTray: 'yes' })).toEqual({
            version: 1,
            closeToTray: true,
        });
    });
});
