const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
    applyPendingImport,
    isProfileArchive,
    prepareProfileArchive,
    writeProfileArchive,
} = require('../../desktop/electron/profile-archive');

const ICON_URL = 'kiwi-icon://network-icon/example.png';

function profileBundle(url = ICON_URL) {
    return {
        format: 'kiwi-profile',
        version: 1,
        source: 'desktop',
        exportedAt: '2026-11-19T00:00:00.000Z',
        state: {
            networks: [{
                name: 'Example',
                settings: { network_icon_url: url },
            }],
        },
    };
}

async function populate(userData) {
    await fs.mkdir(path.join(userData, 'network-icons'), { recursive: true });
    await fs.mkdir(path.join(userData, 'themes', 'custom'), { recursive: true });
    await fs.mkdir(path.join(userData, 'emoji-packs', 'testpack'), { recursive: true });
    await fs.mkdir(path.join(userData, 'plugins', 'testplugin'), { recursive: true });

    await fs.writeFile(
        path.join(userData, 'network-icons', 'example.png'),
        Buffer.from('fake-icon')
    );
    await fs.writeFile(
        path.join(userData, 'themes', 'custom', 'theme.css'),
        '.kiwi-wrap { color: red; }'
    );
    await fs.writeFile(
        path.join(userData, 'themes', 'custom', 'theme.json'),
        JSON.stringify({ name: 'Custom Theme' })
    );
    await fs.writeFile(
        path.join(userData, 'themes', 'custom', 'font.woff2'),
        Buffer.from('fake-font')
    );
    await fs.writeFile(
        path.join(userData, 'emoji-packs', 'testpack', 'emoji.json'),
        JSON.stringify([{
            id: 'testpack',
            name: 'Test Pack',
            emoji: { kiwi: { url: 'kiwi.png' } },
        }])
    );
    await fs.writeFile(
        path.join(userData, 'emoji-packs', 'testpack', 'kiwi.png'),
        Buffer.from('fake-emoji')
    );
    await fs.writeFile(
        path.join(userData, 'plugins', 'testplugin', 'plugin.json'),
        JSON.stringify({ name: 'Test Plugin', entry: 'plugin.js' })
    );
    await fs.writeFile(
        path.join(userData, 'plugins', 'testplugin', 'plugin.js'),
        'window.kiwi.plugin();'
    );
}

describe('profile archive', () => {
    let root;
    let userData;

    beforeEach(async() => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-profile-archive-'));
        userData = path.join(root, 'userdata');
        await populate(userData);
    });

    afterEach(async() => {
        await fs.rm(root, { recursive: true, force: true });
    });

    it('round-trips icons, themes, emoji packs, and plugins', async() => {
        const archive = await writeProfileArchive(userData, profileBundle(), {
            includeAssets: true,
        });
        expect(isProfileArchive(archive)).toBe(true);

        const destination = path.join(root, 'destination');
        await fs.mkdir(destination, { recursive: true });

        const prepared = await prepareProfileArchive(archive, destination);
        expect(JSON.parse(prepared.text).format).toBe('kiwi-profile');
        expect(prepared.hasPlugins).toBe(true);

        const summary = await applyPendingImport(
            prepared.pendingDir,
            destination
        );

        expect(summary).toEqual({
            themes: 1,
            emojiPacks: 1,
            plugins: 1,
            icons: 1,
            skipped: 0,
        });
        expect(await fs.readFile(
            path.join(destination, 'network-icons', 'example.png'),
            'utf8'
        )).toBe('fake-icon');
        expect(await fs.readFile(
            path.join(destination, 'themes', 'custom', 'theme.css'),
            'utf8'
        )).toContain('color: red');
        expect(await fs.readFile(
            path.join(destination, 'themes', 'custom', 'font.woff2'),
            'utf8'
        )).toBe('fake-font');
        expect(await fs.readFile(
            path.join(destination, 'emoji-packs', 'testpack', 'kiwi.png'),
            'utf8'
        )).toBe('fake-emoji');
        expect(await fs.readFile(
            path.join(destination, 'plugins', 'testplugin', 'plugin.js'),
            'utf8'
        )).toBe('window.kiwi.plugin();');
    });

    it('omits local assets when excluded and skips installed ones', async() => {
        const archive = await writeProfileArchive(userData, profileBundle(), {
            includeAssets: false,
        });

        const destination = path.join(root, 'destination');
        await fs.mkdir(destination, { recursive: true });

        const prepared = await prepareProfileArchive(archive, destination);
        expect(prepared.hasPlugins).toBe(false);
        const summary = await applyPendingImport(
            prepared.pendingDir,
            destination
        );

        expect(summary).toEqual({
            themes: 0,
            emojiPacks: 0,
            plugins: 0,
            icons: 0,
            skipped: 0,
        });
        expect(await fs.readdir(destination)).toEqual([]);

        const fullArchive = await writeProfileArchive(userData, profileBundle(), {
            includeAssets: true,
        });
        const existing = path.join(root, 'existing');
        await fs.mkdir(path.join(existing, 'themes', 'custom'), {
            recursive: true,
        });
        await fs.mkdir(path.join(existing, 'emoji-packs', 'testpack'), {
            recursive: true,
        });
        await fs.mkdir(path.join(existing, 'plugins', 'testplugin'), {
            recursive: true,
        });
        await fs.writeFile(
            path.join(existing, 'themes', 'custom', 'theme.css'),
            'local theme'
        );

        const preparedExisting = await prepareProfileArchive(fullArchive, existing);
        const existingSummary = await applyPendingImport(
            preparedExisting.pendingDir,
            existing
        );

        expect(existingSummary.themes).toBe(0);
        expect(existingSummary.emojiPacks).toBe(0);
        expect(existingSummary.plugins).toBe(0);
        expect(existingSummary.skipped).toBe(3);
        expect(await fs.readFile(
            path.join(existing, 'themes', 'custom', 'theme.css'),
            'utf8'
        )).toBe('local theme');
    });

    it('does not embed an icon symlink that points outside the icon directory', async() => {
        const outside = path.join(root, 'secret.txt');
        await fs.writeFile(outside, 'do not export');

        try {
            await fs.symlink(
                outside,
                path.join(userData, 'network-icons', 'linked.png')
            );
        } catch (err) {
            if (err.code === 'EPERM' || err.code === 'EACCES') {
                return;
            }
            throw err;
        }

        const archive = await writeProfileArchive(
            userData,
            profileBundle('kiwi-icon://network-icon/linked.png'),
            { includeAssets: true }
        );

        const destination = path.join(root, 'destination');
        await fs.mkdir(destination, { recursive: true });

        const prepared = await prepareProfileArchive(archive, destination);
        const summary = await applyPendingImport(
            prepared.pendingDir,
            destination
        );

        expect(summary.icons).toBe(0);
    });

    it('rejects files that are not profile archives', async() => {
        expect(isProfileArchive(Buffer.from('{"format":"kiwi-profile"}'))).toBe(false);

        const destination = path.join(root, 'destination');
        await fs.mkdir(destination, { recursive: true });

        await expect(prepareProfileArchive(
            Buffer.from('not a zip file'),
            destination
        )).rejects.toBeDefined();
    });
});
