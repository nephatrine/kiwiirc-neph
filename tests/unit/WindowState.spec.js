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

describe('Desktop window state', () => {
    let userDataDir;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-window-state-'));
    });

    afterEach(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    it('uses centered default bounds when no state exists', () => {
        expect(restoreWindowState(null, [primary, secondary], primary)).toEqual({
            x: 320,
            y: 130,
            width: 1280,
            height: 820,
            maximized: false,
        });
    });

    it('restores a window on a secondary display', () => {
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
    });

    it('keeps negative coordinates on a display left of the primary', () => {
        const left = { x: -1920, y: 0, width: 1920, height: 1080 };
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
    });

    it('centers a window whose saved position is off-screen', () => {
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
    });

    it('clamps oversized windows and preserves the maximized flag', () => {
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

    it('loads and saves the window state', async() => {
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
    });

    it('ignores a malformed window state file', () => {
        fs.writeFileSync(stateFilePath(userDataDir), '{invalid');

        expect(loadWindowState(userDataDir)).toBe(null);
    });
});
