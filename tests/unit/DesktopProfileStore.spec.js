import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    createProfileStore,
    fileNameForKey
} from '../../desktop/electron/profile-store';

describe('Desktop profile store', () => {
    let userDataDir;
    let store;

    beforeEach(() => {
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-profile-'));
        store = createProfileStore(userDataDir);
    });

    afterEach(() => {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    it('stores files, rotates the previous version, and falls back to it', async() => {
        await store.set('kiwi-state', '{"networks":[]}');
        await store.set('kiwi-metadata-cache', '{"networks":{}}');

        expect(await store.get('kiwi-state')).toBe('{"networks":[]}');
        expect(await store.get('kiwi-metadata-cache')).toBe('{"networks":{}}');
        expect(
            fs.existsSync(path.join(userDataDir, 'profiles', 'default', 'state.json'))
        ).toBe(true);
        expect(
            fs.existsSync(
                path.join(userDataDir, 'profiles', 'default', 'metadata-cache.json')
            )
        ).toBe(true);

        await store.set('kiwi-state', '{"version":2}');
        expect(await store.get('kiwi-state')).toBe('{"version":2}');
        expect(fs.readFileSync(
            `${store.filePathFor('kiwi-state')}.bak`,
            'utf8'
        )).toBe('{"networks":[]}');

        fs.writeFileSync(store.filePathFor('kiwi-state'), '{broken');
        expect(await store.get('kiwi-state')).toBe('{"networks":[]}');
    });

    it('deletes both the primary file and backup for a null value', async() => {
        await store.set('kiwi-state', '{"version":1}');
        await store.set('kiwi-state', '{"version":2}');
        await store.set('kiwi-state', null);

        expect(await store.get('kiwi-state')).toBe(null);
        expect(fs.existsSync(store.filePathFor('kiwi-state'))).toBe(false);
        expect(fs.existsSync(`${store.filePathFor('kiwi-state')}.bak`)).toBe(false);
    });

    it('rejects invalid values and path-like keys', async() => {
        await expect(store.set('kiwi-state', '{broken')).rejects.toThrow();
        await expect(store.set('kiwi-state', 123)).rejects.toThrow();
        expect(() => fileNameForKey('../state')).toThrow();
        expect(() => fileNameForKey('bad/key')).toThrow();
        expect(fileNameForKey('custom-state')).toBe('state-custom-state.json');
    });

    it('backs up the current profile files', async() => {
        await store.set('kiwi-state', '{"version":1}');
        await store.set('kiwi-metadata-cache', '{"networks":{}}');
        fs.writeFileSync(
            path.join(store.profileDirectory(), 'secrets.json'),
            '{"version":1}'
        );

        const backupDir = await store.backup();
        const backupFiles = fs.readdirSync(backupDir).sort();

        expect(backupFiles).toEqual([
            'metadata-cache.json',
            'secrets.json',
            'state.json',
        ]);
        expect(fs.readFileSync(path.join(backupDir, 'state.json'), 'utf8'))
            .toBe('{"version":1}');
    });
});
