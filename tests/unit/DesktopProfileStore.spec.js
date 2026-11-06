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

    it('stores state and metadata files under the default profile', async() => {
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
    });

    it('rotates the previous valid file into a backup', async() => {
        await store.set('kiwi-state', '{"version":1}');
        await store.set('kiwi-state', '{"version":2}');

        expect(await store.get('kiwi-state')).toBe('{"version":2}');
        expect(fs.readFileSync(
            `${store.filePathFor('kiwi-state')}.bak`,
            'utf8'
        )).toBe('{"version":1}');
    });

    it('falls back to the backup when the primary file is corrupt', async() => {
        await store.set('kiwi-state', '{"version":1}');
        await store.set('kiwi-state', '{"version":2}');
        fs.writeFileSync(store.filePathFor('kiwi-state'), '{broken');

        expect(await store.get('kiwi-state')).toBe('{"version":1}');
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
        expect(() => fileNameForKey('../state')).toThrow();
        expect(() => fileNameForKey('bad/key')).toThrow();
        expect(fileNameForKey('custom-state')).toBe('state-custom-state.json');
    });

    it('rejects a state file that is not a JSON string', async() => {
        await expect(store.set('kiwi-state', 123)).rejects.toThrow();
    });
});
