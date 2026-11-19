const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
    createMainLog,
    formatValue,
} = require('../../desktop/electron/main-log');

describe('desktop main log', () => {
    let logDir;

    beforeEach(() => {
        logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-main-log-'));
    });

    afterEach(() => {
        fs.rmSync(logDir, { recursive: true, force: true });
    });

    it('writes timestamped log lines and formats errors and objects', () => {
        const log = createMainLog({ logDir });

        log.info('started');
        log.warn('warning');
        log.error(new Error('boom'));

        const text = fs.readFileSync(log.path(), 'utf8');
        expect(text).toContain('[INFO] started');
        expect(text).toContain('[WARN] warning');
        expect(text).toContain('[ERROR] Error: boom');

        expect(formatValue(new Error('boom'))).toContain('Error: boom');
        expect(formatValue({ ok: true })).toBe('{"ok":true}');
    });

    it('rotates the log when it exceeds the size limit', () => {
        const log = createMainLog({
            logDir,
            maxBytes: 80,
        });

        log.info('a'.repeat(60));
        log.info('b'.repeat(60));

        expect(fs.existsSync(`${log.path()}.1`)).toBe(true);
        expect(fs.readFileSync(`${log.path()}.1`, 'utf8'))
            .toContain('a'.repeat(60));
        expect(fs.readFileSync(log.path(), 'utf8'))
            .toContain('b'.repeat(60));
    });
});
