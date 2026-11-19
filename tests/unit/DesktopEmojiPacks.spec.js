import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import getState from '@/libs/state';
import {
    getInstalledEmojiPackages,
    getLocalEmojiPacks,
    localEmojiPackState,
    refreshLocalEmojiPacks,
    setLocalEmojiPacks
} from '@/libs/LocalEmojiPacks';
import { crc32 } from '../../desktop/electron/theme-archive';
import {
    emojiPacksRoot,
    installEmojiPack,
    listEmojiPacks,
    resolveEmojiPackFile,
    uninstallEmojiPack
} from '../../desktop/electron/emoji-packs';

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

function packDocument(overrides = {}) {
    return [{
        id: 'kiwi',
        name: 'Kiwi Pack',
        description: 'Local kiwi emoji',
        authors: ['Kiwi'],
        homepage: 'https://example.com/kiwi',
        emoji: {
            kiwi: {
                url: 'images/kiwi.png',
                alt: 'kiwi bird',
            },
            party: {
                url: 'https://example.com/party.png',
                alt: 'party',
            },
            vector: {
                url: 'images/vector.svg',
                alt: 'vector kiwi',
            },
        },
        ...overrides,
    }];
}

describe('desktop emoji pack installation', () => {
    let userDataDir;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-emoji-packs-'));
    });

    afterEach(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    function writeArchive(entries) {
        const archivePath = path.join(userDataDir, 'emoji-pack.zip');
        fs.writeFileSync(archivePath, makeZip(entries));
        return archivePath;
    }

    function manifest(packs) {
        return {
            name: 'emoji.json',
            contents: JSON.stringify(packs),
            method: 'deflate',
        };
    }

    test('installs, lists, serves, and uninstalls an emoji pack archive', async() => {
        const archivePath = writeArchive([
            manifest(packDocument()),
            {
                name: 'images/kiwi.png',
                contents: 'not really a png',
            },
            {
                name: 'images/vector.svg',
                contents: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
            },
        ]);

        const installed = await installEmojiPack(userDataDir, archivePath);

        expect(installed.name).toBe('Kiwi Pack');
        expect(fs.existsSync(path.join(emojiPacksRoot(userDataDir), installed.id)))
            .toBe(true);

        const packages = await listEmojiPacks(userDataDir);
        expect(packages).toHaveLength(1);
        expect(packages[0]).toMatchObject({
            id: installed.id,
            name: 'Kiwi Pack',
        });
        expect(packages[0].packs[0].emoji.kiwi).toEqual({
            url: `kiwi-emoji://${installed.id}/images/kiwi.png`,
            alt: 'kiwi bird',
        });
        expect(packages[0].packs[0].emoji.party.url)
            .toBe('https://example.com/party.png');
        expect(packages[0].packs[0].emoji.vector.url)
            .toBe(`kiwi-emoji://${installed.id}/images/vector.svg`);

        const png = await resolveEmojiPackFile(
            userDataDir,
            `kiwi-emoji://${installed.id}/images/kiwi.png`
        );
        expect(png).toMatchObject({ mimeType: 'image/png' });
        expect(fs.readFileSync(png.filePath, 'utf8')).toBe('not really a png');

        const svg = await resolveEmojiPackFile(
            userDataDir,
            `kiwi-emoji://${installed.id}/images/vector.svg`
        );
        expect(svg).toMatchObject({ mimeType: 'image/svg+xml' });

        expect(await resolveEmojiPackFile(
            userDataDir,
            `kiwi-emoji://${installed.id}/emoji.json`
        )).toBeNull();
        expect(await resolveEmojiPackFile(
            userDataDir,
            `kiwi-emoji://${installed.id}/missing.png`
        )).toBeNull();

        await uninstallEmojiPack(userDataDir, installed.id);
        expect(await listEmojiPacks(userDataDir)).toEqual([]);
    });

    test('accepts a wrapper folder and rejects unsafe or missing images', async() => {
        const wrapped = await installEmojiPack(userDataDir, writeArchive([
            {
                ...manifest(packDocument()),
                name: 'my-pack/emoji.json',
            },
            {
                name: 'my-pack/images/kiwi.png',
                contents: 'png',
            },
            {
                name: 'my-pack/images/vector.svg',
                contents: '<svg></svg>',
            },
        ]));
        expect(wrapped.packs).toHaveLength(1);
        expect(wrapped.packs[0].emoji.kiwi.url)
            .toBe(`kiwi-emoji://${wrapped.id}/images/kiwi.png`);

        const traversal = writeArchive([
            manifest(packDocument({
                emoji: {
                    kiwi: {
                        url: '../outside.png',
                    },
                },
            })),
        ]);
        await expect(installEmojiPack(userDataDir, traversal))
            .rejects.toThrow('invalid image');

        const missing = writeArchive([
            manifest(packDocument({
                emoji: {
                    kiwi: {
                        url: 'images/missing.png',
                    },
                },
            })),
        ]);
        await expect(installEmojiPack(userDataDir, missing))
            .rejects.toThrow('invalid image');
    });

    test('rejects unsupported extensions, required extensions, and duplicates', async() => {
        const unsupported = writeArchive([
            manifest(packDocument({
                emoji: {
                    kiwi: {
                        url: 'images/kiwi.txt',
                    },
                },
            })),
            {
                name: 'images/kiwi.txt',
                contents: 'text',
            },
        ]);
        await expect(installEmojiPack(userDataDir, unsupported))
            .rejects.toThrow('invalid image');

        const required = writeArchive([
            manifest(packDocument({
                required: ['example.com/animated'],
                emoji: {
                    kiwi: {
                        url: 'images/kiwi.png',
                    },
                },
            })),
            {
                name: 'images/kiwi.png',
                contents: 'png',
            },
        ]);
        await expect(installEmojiPack(userDataDir, required))
            .rejects.toThrow('unsupported extensions');

        const duplicate = writeArchive([
            manifest([
                ...packDocument(),
                ...packDocument({ name: 'Duplicate' }),
            ]),
            {
                name: 'images/kiwi.png',
                contents: 'png',
            },
            {
                name: 'images/vector.svg',
                contents: '<svg></svg>',
            },
        ]);
        await expect(installEmojiPack(userDataDir, duplicate))
            .rejects.toThrow('duplicated');
    });

    test('rejects invalid uninstall ids and missing uninstall targets', async() => {
        await expect(uninstallEmojiPack(userDataDir, '../kiwi'))
            .rejects.toThrow('Invalid emoji pack id');
        await expect(uninstallEmojiPack(userDataDir, 'missing-pack'))
            .rejects.toThrow();
    });
});

describe('local emoji packs', () => {
    let state;

    beforeEach(() => {
        state = getState();
        state.resetState();
        setLocalEmojiPacks([]);
    });

    afterEach(() => {
        setLocalEmojiPacks([]);
        state.resetState();
        delete window.kiwiDesktop;
    });

    function makePackage(overrides = {}) {
        return {
            id: 'kiwi-pack-abcd1234',
            name: 'Kiwi Pack',
            installedAt: 10,
            packs: [{
                id: 'kiwi',
                name: 'Kiwi Pack',
                description: 'Local kiwi emoji',
                authors: ['Kiwi'],
                homepage: 'https://example.com/kiwi',
                supported: true,
                emoji: {
                    kiwi: {
                        url: 'kiwi-emoji://kiwi-pack-abcd1234/images/kiwi.png',
                        alt: 'kiwi bird',
                    },
                },
            }],
            ...overrides,
        };
    }

    test('flattens packages, sorts newer last, and emits on change', () => {
        setLocalEmojiPacks([makePackage()]);

        expect(getInstalledEmojiPackages()).toHaveLength(1);
        expect(getInstalledEmojiPackages()[0]).toMatchObject({
            id: 'kiwi-pack-abcd1234',
            name: 'Kiwi Pack',
        });

        let packs = getLocalEmojiPacks();
        expect(packs).toHaveLength(1);
        expect(packs[0]).toMatchObject({
            id: 'kiwi',
            name: 'Kiwi Pack',
            desktopEmojiPackId: 'kiwi-pack-abcd1234',
            supported: true,
        });
        expect(packs[0].emoji.kiwi).toEqual({
            url: 'kiwi-emoji://kiwi-pack-abcd1234/images/kiwi.png',
            alt: 'kiwi bird',
        });

        setLocalEmojiPacks([
            makePackage({ id: 'older', installedAt: 1 }),
            makePackage({
                id: 'newer',
                installedAt: 2,
                packs: [{
                    id: 'newer-pack',
                    name: 'Newer Pack',
                    emoji: {
                        kiwi: {
                            url: 'https://example.com/newer.png',
                            alt: '',
                        },
                        bad: {
                            url: 'file:///tmp/bad.png',
                        },
                    },
                }],
            }),
        ]);

        expect(getInstalledEmojiPackages().map((pkg) => pkg.id))
            .toEqual(['older', 'newer']);
        packs = getLocalEmojiPacks();
        expect(packs.map((pack) => pack.id)).toEqual(['kiwi', 'newer-pack']);
        expect(packs[1].emoji.bad).toBeUndefined();

        const listener = jest.fn();
        state.$on('emoji.local-packs', listener);

        setLocalEmojiPacks([makePackage()]);
        setLocalEmojiPacks([]);

        expect(listener).toHaveBeenCalledTimes(2);
        expect(localEmojiPackState.packs).toEqual([]);
    });

    test('refreshes from the desktop bridge', async() => {
        const list = jest.fn(() => Promise.resolve([makePackage()]));
        window.kiwiDesktop = {
            emojiPacks: {
                list,
                install: jest.fn(),
                uninstall: jest.fn(),
            },
        };

        await refreshLocalEmojiPacks();

        expect(list).toHaveBeenCalledTimes(1);
        expect(getLocalEmojiPacks()).toHaveLength(1);
    });
});
