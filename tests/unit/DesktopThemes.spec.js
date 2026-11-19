import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { crc32 } from '../../desktop/electron/theme-archive';
import {
    installTheme,
    listThemes,
    resolveThemeFile,
    themesRoot,
    uninstallTheme
} from '../../desktop/electron/themes';

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const EOCD_SIGNATURE = 0x06054b50;

function makeZip(entries) {
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    entries.forEach((entry) => {
        const name = Buffer.from(entry.name, 'utf8');
        const contents = Buffer.from(entry.contents || '');
        const method = entry.method === 'deflate' ? 8 : 0;
        const compressed = method === 8 ?
            zlib.deflateRawSync(contents) :
            contents;
        const checksum = crc32(contents);
        const flags = 0x800 + (entry.flags || 0);
        const versionMadeBy = entry.versionMadeBy || 20;
        const externalAttributes = entry.externalAttributes || 0;

        const local = Buffer.alloc(30);
        local.writeUInt32LE(LOCAL_FILE_SIGNATURE, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(flags, 6);
        local.writeUInt16LE(method, 8);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(contents.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        const localFile = Buffer.concat([local, name, compressed]);
        localParts.push(localFile);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0);
        central.writeUInt16LE(versionMadeBy, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(flags, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(contents.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt32LE(externalAttributes, 38);
        central.writeUInt32LE(localOffset, 42);
        centralParts.push(Buffer.concat([central, name]));

        localOffset += localFile.length;
    });

    const centralDirectory = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(EOCD_SIGNATURE, 0);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralDirectory.length, 12);
    eocd.writeUInt32LE(localOffset, 16);

    return Buffer.concat([
        ...localParts,
        centralDirectory,
        eocd,
    ]);
}

describe('desktop theme installation', () => {
    let userDataDir;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-themes-'));
    });

    afterEach(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    function writeArchive(entries) {
        const archivePath = path.join(userDataDir, 'theme.zip');
        fs.writeFileSync(archivePath, makeZip(entries));
        return archivePath;
    }

    test('installs, lists, serves, and uninstalls a theme archive', async() => {
        const archivePath = writeArchive([
            {
                name: 'theme.css',
                contents: ':root { --brand-primary: #123456; }\n',
                method: 'deflate',
            },
            {
                name: 'theme.json',
                contents: JSON.stringify({
                    name: 'Downloaded Theme',
                    mode: 'dark',
                    google_fonts: ['Inter'],
                }),
            },
            {
                name: 'assets/background.png',
                contents: 'not really a png',
            },
            {
                name: 'assets/evil.html',
                contents: '<html></html>',
            },
        ]);

        const installed = await installTheme(userDataDir, archivePath);

        expect(installed.name).toBe('Downloaded Theme');
        expect(installed.mode).toBe('dark');
        expect(installed.google_fonts).toEqual(['Inter']);
        expect(installed.url).toBe(`kiwi-theme://${installed.id}`);
        expect(fs.existsSync(path.join(themesRoot(userDataDir), installed.id, 'theme.css')))
            .toBe(true);

        const themes = await listThemes(userDataDir);
        expect(themes).toHaveLength(1);
        expect(themes[0]).toMatchObject({
            id: installed.id,
            name: 'Downloaded Theme',
            mode: 'dark',
        });

        const css = await resolveThemeFile(
            userDataDir,
            `kiwi-theme://${installed.id}/theme.css`
        );
        expect(css.filePath).toBe(path.join(
            fs.realpathSync(themesRoot(userDataDir)),
            installed.id,
            'theme.css'
        ));
        expect(css.mimeType).toContain('text/css');

        expect(await resolveThemeFile(
            userDataDir,
            `kiwi-theme://${installed.id}/assets/evil.html`
        )).toBeNull();

        await uninstallTheme(userDataDir, installed.id);
        expect(await listThemes(userDataDir)).toEqual([]);
    });

    test('accepts one wrapper folder and rejects other layouts', async() => {
        const installed = await installTheme(userDataDir, writeArchive([
            {
                name: 'my-theme/theme.css',
                contents: ':root {}\n',
            },
        ]));

        expect(installed.name).toBe('my-theme');
        expect(fs.existsSync(path.join(
            themesRoot(userDataDir),
            installed.id,
            'theme.json'
        ))).toBe(true);

        await expect(installTheme(userDataDir, writeArchive([
            {
                name: 'one/two/theme.css',
                contents: ':root {}\n',
            },
        ]))).rejects.toThrow('theme.css');

        await expect(installTheme(userDataDir, writeArchive([
            {
                name: 'my-theme/theme.css',
                contents: ':root {}\n',
            },
            {
                name: 'assets/background.png',
                contents: 'not really a png',
            },
        ]))).rejects.toThrow('theme.css');
    });

    test('rejects traversal, symlinks, and encrypted entries', async() => {
        await expect(installTheme(userDataDir, writeArchive([
            {
                name: '../escape.css',
                contents: 'bad',
            },
        ]))).rejects.toThrow('unsafe path');
        expect(fs.existsSync(path.join(userDataDir, 'escape.css'))).toBe(false);

        await expect(installTheme(userDataDir, writeArchive([
            {
                name: 'theme.css',
                contents: ':root {}\n',
            },
            {
                name: 'linked.css',
                contents: 'theme.css',
                versionMadeBy: (3 * 256) + 20,
                externalAttributes: 0o120777 * (2 ** 16),
            },
        ]))).rejects.toThrow('symlinks');

        await expect(installTheme(userDataDir, writeArchive([
            {
                name: 'theme.css',
                contents: ':root {}\n',
                flags: 0x1,
            },
        ]))).rejects.toThrow('Encrypted');
    });

    test('rejects invalid theme ids during uninstall', async() => {
        await expect(uninstallTheme(userDataDir, '../theme'))
            .rejects.toThrow('Invalid theme id');
    });
});
