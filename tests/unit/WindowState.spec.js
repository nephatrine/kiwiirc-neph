import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    loadWindowState,
    restoreWindowState,
    saveWindowState,
    saveWindowStateSync,
    stateFilePath
} from '../../desktop/electron/window-state';

const primary = { x: 0, y: 0, width: 1920, height: 1080 };
const secondary = { x: 1920, y: 0, width: 1920, height: 1080 };
const left = { x: -1920, y: 0, width: 1920, height: 1080 };

describe('Desktop window state', () => {
    let userDataDir;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-window-state-'));
    });

    afterEach(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    it('centers, restores, and clamps bounds across displays', () => {
        expect(restoreWindowState(null, [primary, secondary], primary)).toEqual({
            x: 320,
            y: 130,
            width: 1280,
            height: 820,
            maximized: false,
        });

        expect(restoreWindowState({
            x: 2100,
            y: 100,
            width: 1000,
            height: 700,
        }, [primary, secondary], primary)).toEqual({
            x: 2100,
            y: 100,
            width: 1000,
            height: 700,
            maximized: false,
        });

        expect(restoreWindowState({
            x: -1500,
            y: 100,
            width: 1000,
            height: 700,
        }, [left, primary], primary)).toEqual({
            x: -1500,
            y: 100,
            width: 1000,
            height: 700,
            maximized: false,
        });

        expect(restoreWindowState({
            x: 9000,
            y: 9000,
            width: 1000,
            height: 700,
        }, [primary, secondary], primary)).toEqual({
            x: 460,
            y: 190,
            width: 1000,
            height: 700,
            maximized: false,
        });

        expect(restoreWindowState({
            x: 100,
            y: 100,
            width: 4000,
            height: 3000,
            maximized: true,
        }, [primary], primary)).toEqual({
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            maximized: true,
        });
    });

    it('round-trips the window state and ignores malformed files', async() => {
        await saveWindowState(userDataDir, {
            x: 10,
            y: 20,
            width: 900,
            height: 700,
            maximized: false,
        });

        expect(loadWindowState(userDataDir)).toEqual({
            x: 10,
            y: 20,
            width: 900,
            height: 700,
            maximized: false,
        });

        saveWindowStateSync(userDataDir, {
            x: 30,
            y: 40,
            width: 1000,
            height: 800,
            maximized: true,
        });
        expect(loadWindowState(userDataDir)).toEqual({
            x: 30,
            y: 40,
            width: 1000,
            height: 800,
            maximized: true,
        });

        fs.writeFileSync(stateFilePath(userDataDir), '{invalid');
        expect(loadWindowState(userDataDir)).toBe(null);
    });
});
