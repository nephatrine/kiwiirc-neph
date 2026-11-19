import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    installNetworkIcon,
    resolveNetworkIconFile
} from '../../desktop/electron/network-icons';

describe('desktop network icons', () => {
    let tempDir;
    let sourcePath;

    beforeEach(async() => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-network-icon-'));
        sourcePath = path.join(tempDir, 'source.png');
        await fs.writeFile(sourcePath, Buffer.from('89504e470d0a1a0a', 'hex'));
    });

    afterEach(async() => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('copies a selected image and resolves the saved URL', async() => {
        const result = await installNetworkIcon(tempDir, 'Test Network', sourcePath);
        const iconPath = path.join(tempDir, 'network-icons', 'test-network.png');

        expect(result.canceled).toBe(false);
        expect(result.url).toBe('kiwi-icon://network-icon/test-network.png');
        await expect(fs.readFile(iconPath)).resolves.toEqual(
            Buffer.from('89504e470d0a1a0a', 'hex')
        );

        const resolved = await resolveNetworkIconFile(tempDir, result.url);

        expect(resolved).toEqual(expect.objectContaining({
            filePath: path.join(tempDir, 'network-icons', 'test-network.png'),
            mimeType: 'image/png',
        }));
    });

    test('rejects unsupported image types and outside paths', async() => {
        const textPath = path.join(tempDir, 'icon.txt');
        await fs.writeFile(textPath, 'not an image');

        await expect(installNetworkIcon(tempDir, 'Test', textPath))
            .rejects.toThrow('Unsupported image type');

        const result = await resolveNetworkIconFile(
            tempDir,
            'kiwi-icon://network-icon/../outside.png'
        );

        expect(result).toBeNull();
    });
});
