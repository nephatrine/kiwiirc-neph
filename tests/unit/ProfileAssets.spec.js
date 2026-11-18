const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
    collectProfileAssets,
    installProfileAssets,
} = require('../../desktop/electron/profile-assets');

const ICON_URL = 'kiwi-icon://network-icon/example.png';

function bundleWithIcon(url = ICON_URL) {
    return {
        format: 'kiwi-profile',
        version: 1,
        state: {
            networks: [{
                name: 'Example',
                settings: { network_icon_url: url },
            }],
            user_settings: {
                radio: {
                    stations: [{ name: 'Station', image: url }],
                },
            },
        },
    };
}

describe('profile icon assets', () => {
    let root;
    let userData;

    beforeEach(async() => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-profile-assets-'));
        userData = path.join(root, 'userdata');
        await fs.mkdir(path.join(userData, 'network-icons'), { recursive: true });
    });

    afterEach(async() => {
        await fs.rm(root, { recursive: true, force: true });
    });

    it('embeds referenced local icons', async() => {
        const data = Buffer.from('fake-png-bytes');
        await fs.writeFile(path.join(userData, 'network-icons', 'example.png'), data);

        const assets = await collectProfileAssets(userData, bundleWithIcon());

        expect(Object.keys(assets)).toEqual(['example.png']);
        expect(assets['example.png'].mime).toBe('image/png');
        expect(Buffer.from(assets['example.png'].data, 'base64')).toEqual(data);
    });

    it('ignores missing icons and non-icon URLs', async() => {
        const assets = await collectProfileAssets(userData, bundleWithIcon(
            'https://example.com/avatar.png'
        ));
        expect(assets).toBeNull();

        const missing = await collectProfileAssets(userData, bundleWithIcon());
        expect(missing).toBeNull();
    });

    it('restores embedded icons on import', async() => {
        const data = Buffer.from('fake-png-bytes');
        const bundle = bundleWithIcon();
        bundle.assets = {
            'example.png': {
                mime: 'image/png',
                data: data.toString('base64'),
            },
        };

        const installed = await installProfileAssets(userData, bundle);

        expect(installed).toBe(1);
        const written = await fs.readFile(
            path.join(userData, 'network-icons', 'example.png')
        );
        expect(written).toEqual(data);
    });

    it('keeps an existing icon instead of overwriting it', async() => {
        const existing = Buffer.from('existing');
        await fs.writeFile(path.join(userData, 'network-icons', 'example.png'), existing);

        const installed = await installProfileAssets(userData, {
            assets: {
                'example.png': {
                    mime: 'image/png',
                    data: Buffer.from('replacement').toString('base64'),
                },
            },
        });

        expect(installed).toBe(0);
        const written = await fs.readFile(
            path.join(userData, 'network-icons', 'example.png')
        );
        expect(written).toEqual(existing);
    });

    it('rejects traversal names, unknown types, and mismatched mime', async() => {
        const installed = await installProfileAssets(userData, {
            assets: {
                '../escape.png': {
                    mime: 'image/png',
                    data: Buffer.from('x').toString('base64'),
                },
                'bad.exe': {
                    mime: 'application/octet-stream',
                    data: Buffer.from('x').toString('base64'),
                },
                'wrong.png': {
                    mime: 'image/jpeg',
                    data: Buffer.from('x').toString('base64'),
                },
            },
        });

        expect(installed).toBe(0);
        expect(await fs.readdir(path.join(userData, 'network-icons'))).toEqual([]);
        expect(await fs.readdir(root)).toEqual(['userdata']);
    });
});
