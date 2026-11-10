import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    DEFAULT_CONFIG,
    ensureUserConfig,
    loadDesktopConfig,
    mergeConfig,
    parseConfigText
} from '../../desktop/electron/desktop-config';

describe('Desktop configuration', () => {
    let userDataDir;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-desktop-config-'));
    });

    afterEach(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    it('uses a personal startup screen with no default network or gateway', () => {
        expect(DEFAULT_CONFIG.startupScreen).toBe('personal');
        expect(DEFAULT_CONFIG.kiwiServer).toBe('');
        expect(DEFAULT_CONFIG.presetNetworks).toEqual([]);
        expect(DEFAULT_CONFIG.startupOptions.server).toBe('');
        expect(DEFAULT_CONFIG.buffers.hide_preview_cards).toBe(true);
        expect(DEFAULT_CONFIG.buffers.show_topic_in_header).toBe(true);
        expect(DEFAULT_CONFIG.desktopHttp.maxUploadBytes).toBe(268435456);
    });

    it('allows the desktop default for hiding bridged previews to be overridden', () => {
        const merged = mergeConfig(DEFAULT_CONFIG, {
            buffers: { hide_preview_cards: false },
        });

        expect(merged.buffers.hide_preview_cards).toBe(false);
        expect(DEFAULT_CONFIG.buffers.hide_preview_cards).toBe(true);
    });

    it('allows the desktop topic-in-header default to be overridden', () => {
        const merged = mergeConfig(DEFAULT_CONFIG, {
            buffers: { show_topic_in_header: false },
        });

        expect(merged.buffers.show_topic_in_header).toBe(false);
        expect(DEFAULT_CONFIG.buffers.show_topic_in_header).toBe(true);
    });

    it('allows the desktop upload limit to be overridden', () => {
        const merged = mergeConfig(DEFAULT_CONFIG, {
            desktopHttp: { maxUploadBytes: 10485760 },
        });

        expect(merged.desktopHttp.maxUploadBytes).toBe(10485760);
        expect(DEFAULT_CONFIG.desktopHttp.maxUploadBytes).toBe(268435456);
    });

    it('deep merges objects and replaces arrays', () => {
        const merged = mergeConfig(DEFAULT_CONFIG, {
            startupOptions: { nick: 'desktop_?' },
            presetNetworks: ['irc://irc.example.net'],
        });

        expect(merged.startupOptions.nick).toBe('desktop_?');
        expect(merged.startupOptions.server).toBe('');
        expect(merged.presetNetworks).toEqual(['irc://irc.example.net']);
        expect(DEFAULT_CONFIG.startupOptions.nick).toBe('kiwi_?');
    });

    it('parses a JSON5 user configuration', () => {
        const config = parseConfigText(`{
            // A gateway is optional.
            "kiwiServer": "https://irc.example.com/webirc/kiwiirc/",
        }`);

        expect(config.kiwiServer).toBe('https://irc.example.com/webirc/kiwiirc/');
    });

    it('loads user overrides from the desktop config file', () => {
        ensureUserConfig(userDataDir);
        fs.writeFileSync(
            path.join(userDataDir, 'config.json5'),
            '{ "startupScreen": "customServer", "startupOptions": { "nick": "user_?" } }'
        );

        const result = loadDesktopConfig(userDataDir);

        expect(result.error).toBe(null);
        expect(result.config.startupScreen).toBe('customServer');
        expect(result.config.startupOptions.nick).toBe('user_?');
        expect(result.config.startupOptions.server).toBe('');
    });

    it('falls back to defaults when the user configuration is invalid', () => {
        fs.writeFileSync(path.join(userDataDir, 'config.json5'), '{ invalid');

        const result = loadDesktopConfig(userDataDir);

        expect(result.error).toBeTruthy();
        expect(result.config).toEqual(DEFAULT_CONFIG);
    });
});
