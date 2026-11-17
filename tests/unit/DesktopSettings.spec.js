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

    it('defaults close-to-tray, spellcheck, and update checks on', async() => {
        const store = createDesktopSettingsStore(userDataDir);

        expect(await store.load()).toEqual(DEFAULT_SETTINGS);
        expect(store.get()).toEqual(DEFAULT_SETTINGS);
        expect(DEFAULT_SETTINGS.autoLaunch).toBe(false);
        expect(DEFAULT_SETTINGS.spellcheck).toBe(true);
        expect(DEFAULT_SETTINGS.checkForUpdates).toBe(true);
        expect(DEFAULT_SETTINGS.lastNotifiedUpdate).toBe('');
    });

    it('persists desktop setting changes', async() => {
        const store = createDesktopSettingsStore(userDataDir);
        await store.load();

        expect(await store.set({
            closeToTray: false,
            autoLaunch: true,
            spellcheck: false,
            checkForUpdates: false,
            lastNotifiedUpdate: '2.3.0',
        })).toEqual({
            version: 1,
            closeToTray: false,
            autoLaunch: true,
            spellcheck: false,
            checkForUpdates: false,
            lastNotifiedUpdate: '2.3.0',
        });

        const restored = createDesktopSettingsStore(userDataDir);
        expect(await restored.load()).toEqual({
            version: 1,
            closeToTray: false,
            autoLaunch: true,
            spellcheck: false,
            checkForUpdates: false,
            lastNotifiedUpdate: '2.3.0',
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
            checkForUpdates: 'yes',
            lastNotifiedUpdate: 42,
        })).toEqual({
            version: 1,
            closeToTray: true,
            autoLaunch: false,
            spellcheck: true,
            checkForUpdates: true,
            lastNotifiedUpdate: '',
        });
    });
});
