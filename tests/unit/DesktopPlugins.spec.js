import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { crc32 } from '../../desktop/electron/theme-archive';
import {
    installPlugin,
    listPlugins,
    pluginsRoot,
    resolvePluginFile,
    uninstallPlugin
} from '../../desktop/electron/plugins';

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
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(flags, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(contents.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt32LE(0, 38);
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

function manifest(overrides = {}) {
    return {
        name: 'Kiwi Plugin',
        description: 'A tiny test plugin',
        version: '1.0.0',
        entry: 'plugin.js',
        ...overrides,
    };
}

describe('desktop plugin installation', () => {
    let userDataDir;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-plugins-'));
    });

    afterEach(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    function writeArchive(entries) {
        const archivePath = path.join(userDataDir, 'plugin.zip');
        fs.writeFileSync(archivePath, makeZip(entries));
        return archivePath;
    }

    function manifestEntry(value) {
        return {
            name: 'plugin.json',
            contents: JSON.stringify(value),
            method: 'deflate',
        };
    }

    test('installs, lists, serves, and uninstalls a plugin archive', async() => {
        const archivePath = writeArchive([
            manifestEntry(manifest()),
            {
                name: 'plugin.js',
                contents: 'window.kiwi.plugin();',
            },
            {
                name: 'assets/icon.png',
                contents: 'not really a png',
            },
        ]);

        const installed = await installPlugin(userDataDir, archivePath);

        expect(installed).toMatchObject({
            name: 'Kiwi Plugin',
            description: 'A tiny test plugin',
            version: '1.0.0',
            entry: 'plugin.js',
            url: `kiwi-plugin://${installed.id}/plugin.js`,
        });
        expect(fs.existsSync(
            path.join(pluginsRoot(userDataDir), installed.id)
        )).toBe(true);

        const plugins = await listPlugins(userDataDir);
        expect(plugins).toHaveLength(1);
        expect(plugins[0]).toMatchObject({
            id: installed.id,
            name: 'Kiwi Plugin',
        });

        const script = await resolvePluginFile(
            userDataDir,
            `kiwi-plugin://${installed.id}/plugin.js`
        );
        expect(script).toMatchObject({
            mimeType: 'text/javascript; charset=utf-8',
        });
        expect(fs.readFileSync(script.filePath, 'utf8'))
            .toBe('window.kiwi.plugin();');

        const icon = await resolvePluginFile(
            userDataDir,
            `kiwi-plugin://${installed.id}/assets/icon.png`
        );
        expect(icon).toMatchObject({ mimeType: 'image/png' });

        await uninstallPlugin(userDataDir, installed.id);
        expect(await listPlugins(userDataDir)).toEqual([]);
    });

    test('accepts a wrapper folder and rejects invalid manifests', async() => {
        const wrapped = await installPlugin(userDataDir, writeArchive([
            {
                ...manifestEntry(manifest()),
                name: 'my-plugin/plugin.json',
            },
            {
                name: 'my-plugin/plugin.js',
                contents: 'plugin();',
            },
        ]));
        expect(wrapped.url).toBe(`kiwi-plugin://${wrapped.id}/plugin.js`);

        await expect(installPlugin(userDataDir, writeArchive([
            {
                name: 'plugin.js',
                contents: 'plugin();',
            },
        ]))).rejects.toThrow('plugin.json');

        await expect(installPlugin(userDataDir, writeArchive([
            manifestEntry(manifest({ name: '' })),
            {
                name: 'plugin.js',
                contents: 'plugin();',
            },
        ]))).rejects.toThrow('name');

        await expect(installPlugin(userDataDir, writeArchive([
            manifestEntry(manifest({ entry: '../outside.js' })),
        ]))).rejects.toThrow('entry');
    });

    test('rejects missing entries and unsafe uninstall ids', async() => {
        await expect(installPlugin(userDataDir, writeArchive([
            manifestEntry(manifest()),
        ]))).rejects.toThrow();

        await expect(installPlugin(userDataDir, writeArchive([
            manifestEntry(manifest({ entry: 'plugin.css' })),
        ]))).rejects.toThrow('entry');

        await expect(uninstallPlugin(userDataDir, '../kiwi'))
            .rejects.toThrow('Invalid plugin id');
        await expect(uninstallPlugin(userDataDir, 'missing-plugin'))
            .rejects.toThrow();
    });

    test('refuses to serve files outside a plugin directory', async() => {
        const installed = await installPlugin(userDataDir, writeArchive([
            manifestEntry(manifest()),
            {
                name: 'plugin.js',
                contents: 'plugin();',
            },
        ]));

        expect(await resolvePluginFile(
            userDataDir,
            `kiwi-plugin://${installed.id}/../escape.js`
        )).toBeNull();
        expect(await resolvePluginFile(
            userDataDir,
            `kiwi-plugin://${installed.id}/missing.js`
        )).toBeNull();
        expect(await resolvePluginFile(
            userDataDir,
            'kiwi-plugin://../plugin.js'
        )).toBeNull();
        expect(await resolvePluginFile(
            userDataDir,
            `kiwi-plugin://${installed.id}/plugin.css`
        )).toBeNull();
    });
});
