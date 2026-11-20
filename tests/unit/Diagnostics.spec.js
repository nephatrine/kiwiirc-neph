import EventEmitter from 'eventemitter3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import desktop from '@/libs/desktop';
import {
    setDiagnosticPhase,
    startFreezeBeacon,
    stopFreezeBeacon
} from '@/libs/desktop/FreezeBeacon';
import { createDiagnostics } from '../../desktop/electron/diagnostics';

jest.mock('@/libs/desktop', () => ({
    __esModule: true,
    default: {
        isDesktop: jest.fn(() => true),
        diagnostics: {
            isAvailable: jest.fn(() => true),
            event: jest.fn(),
        },
    },
}));

function makeApp() {
    return {
        getVersion: () => '2.2.0',
        isPackaged: true,
        getAppMetrics: () => [
            {
                pid: 10,
                type: 'Browser',
                cpu: { percentCPUUsage: 1.5 },
                memory: { workingSetSize: 100 },
            },
            {
                pid: 11,
                type: 'Tab',
                cpu: { percentCPUUsage: 0 },
                memory: { workingSetSize: 50 },
            },
        ],
    };
}

function makeWindow(id = 1) {
    const win = new EventEmitter();
    const webContents = new EventEmitter();
    webContents.id = id;
    webContents.getURL = () => 'app://kiwi/index.html';
    webContents.getTitle = () => 'Kiwi IRC';
    win.webContents = webContents;
    win.isVisible = () => true;
    win.isFocused = () => true;
    return win;
}

function readSnapshot(dir) {
    const files = fs.readdirSync(path.join(dir, 'diagnostics'))
        .filter((name) => name.startsWith('freeze-'));
    expect(files).toHaveLength(1);
    return JSON.parse(fs.readFileSync(
        path.join(dir, 'diagnostics', files[0]),
        'utf8'
    ));
}

describe('freeze diagnostics', () => {
    let userDataDir;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-diagnostics-'));
    });

    afterEach(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    it('logs hangs, records duration, and writes a metrics-only snapshot', async() => {
        let clock = 1000;
        const log = { info: jest.fn(), warn: jest.fn() };
        const diagnostics = createDiagnostics({
            app: makeApp(),
            userDataDir,
            log,
            now: () => clock,
        });
        const win = makeWindow();
        diagnostics.attachWindow(win);

        clock = 2000;
        win.webContents.emit('unresponsive');
        await new Promise((resolve) => {
            setTimeout(resolve, 20);
        });

        expect(log.warn).toHaveBeenCalledWith(
            'Window became unresponsive',
            expect.objectContaining({ windowId: 1 })
        );

        const payload = readSnapshot(userDataDir);
        expect(payload.reason).toBe('unresponsive');
        expect(payload.app).toMatchObject({
            version: '2.2.0',
            packaged: true,
        });
        expect(payload.processes).toHaveLength(2);
        expect(payload.windows[0]).toMatchObject({
            id: 1,
            url: 'app://kiwi/index.html',
            title: 'Kiwi IRC',
            phase: 'start',
        });
        expect(payload.windows[0]).not.toHaveProperty('messages');

        clock = 5000;
        win.webContents.emit('responsive');
        expect(log.info).toHaveBeenCalledWith(
            'Window responsive again',
            expect.objectContaining({ windowId: 1, durationMs: 3000 })
        );
    });

    it('includes heartbeats and renderer events in snapshots', async() => {
        let clock = 1000;
        const log = { info: jest.fn(), warn: jest.fn() };
        const diagnostics = createDiagnostics({
            app: makeApp(),
            userDataDir,
            log,
            now: () => clock,
        });
        const win = makeWindow();
        diagnostics.attachWindow(win);

        diagnostics.recordBeat(1, { phase: 'buffer-switch' });
        diagnostics.recordEvent(1, {
            type: 'longtask',
            durationMs: 800,
        });
        diagnostics.recordEvent(1, {
            type: 'sync-ipc',
            channel: 'kiwi:desktop-config',
            durationMs: 120,
        });

        clock += 2500;
        await diagnostics.snapshotNow('manual');

        const payload = readSnapshot(userDataDir);
        expect(payload.reason).toBe('manual');
        expect(payload.windows[0].phase).toBe('buffer-switch');
        expect(payload.windows[0].lastBeatAgoMs).toBe(2500);
        expect(payload.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'longtask', durationMs: 800 }),
            expect.objectContaining({
                type: 'sync-ipc',
                channel: 'kiwi:desktop-config',
                durationMs: 120,
            }),
        ]));
        expect(log.warn).toHaveBeenCalledWith(
            'Renderer long task',
            expect.objectContaining({ durationMs: 800 })
        );
        expect(log.warn).toHaveBeenCalledWith(
            'Slow synchronous IPC',
            expect.objectContaining({ channel: 'kiwi:desktop-config' })
        );
    });

    it('warns and snapshots when the main loop stalls', async() => {
        let clock = 1000;
        const log = { info: jest.fn(), warn: jest.fn() };
        const diagnostics = createDiagnostics({
            app: makeApp(),
            userDataDir,
            log,
            now: () => clock,
            lagIntervalMs: 250,
            lagWarnMs: 1000,
        });

        diagnostics.start();
        clock = 3000;
        expect(diagnostics.checkLag()).toBe(1750);
        diagnostics.stop();

        expect(log.warn).toHaveBeenCalledWith(
            'Main process event loop blocked',
            expect.objectContaining({ lagMs: 1750 })
        );
        expect(diagnostics.status().maxLagMs).toBe(1750);

        await new Promise((resolve) => {
            setTimeout(resolve, 20);
        });
        expect(readSnapshot(userDataDir).reason).toBe('event-loop-lag');
    });

    it('ignores unknown windows and empty snapshot directories', async() => {
        const diagnostics = createDiagnostics({
            app: makeApp(),
            userDataDir: '',
            log: { info: jest.fn(), warn: jest.fn() },
        });

        expect(() => diagnostics.recordBeat(99, {})).not.toThrow();
        expect(() => diagnostics.recordEvent(99, {})).not.toThrow();
        await expect(diagnostics.snapshotNow()).resolves.toBeNull();
    });
});

describe('freeze beacon', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        desktop.isDesktop.mockReturnValue(true);
        desktop.diagnostics.isAvailable.mockReturnValue(true);
        desktop.diagnostics.event.mockClear();
    });

    afterEach(() => {
        stopFreezeBeacon();
        jest.useRealTimers();
    });

    test('reports a start event, beats, and phase changes', () => {
        startFreezeBeacon();

        expect(desktop.diagnostics.event).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'start' })
        );

        jest.advanceTimersByTime(2000);

        const beats = desktop.diagnostics.event.mock.calls.filter(
            ([payload]) => payload.type === 'beat'
        );
        expect(beats).toHaveLength(2);

        setDiagnosticPhase('focus');

        expect(desktop.diagnostics.event).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: 'phase', phase: 'focus' })
        );
    });

    test('does nothing outside the desktop shell', () => {
        desktop.isDesktop.mockReturnValue(false);

        startFreezeBeacon();
        jest.advanceTimersByTime(2000);

        expect(desktop.diagnostics.event).not.toHaveBeenCalled();
    });

    test('does nothing when the bridge lacks diagnostics', () => {
        desktop.diagnostics.isAvailable.mockReturnValue(false);

        startFreezeBeacon();
        jest.advanceTimersByTime(2000);

        expect(desktop.diagnostics.event).not.toHaveBeenCalled();
    });
});
