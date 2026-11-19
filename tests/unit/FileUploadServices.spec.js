jest.mock('@/libs/desktop/Http', () => ({
    desktopUploadFile: jest.fn(),
    desktopUploadMultipart: jest.fn(),
}));

import {
    desktopUploadFile,
    desktopUploadMultipart
} from '@/libs/desktop/Http';
import { uploadCatbox } from '@/libs/fileupload/catbox';
import { uploadFilebin } from '@/libs/fileupload/filebin';
import { uploadSharebin } from '@/libs/fileupload/sharebin';
import { uploadUguu } from '@/libs/fileupload/uguu';
import { generateUniqueFilename, uploadWebdav } from '@/libs/fileupload/webdav';
import {
    effectiveService,
    retentionFor,
    serviceAvailableOnPlatform,
    services
} from '@/libs/fileupload';

const { TextEncoder } = require('util');
global.TextEncoder = TextEncoder;

function response({ status = 200, text = '', json = null } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: jest.fn(async() => text),
        json: jest.fn(async() => json),
    };
}

function file(name = 'test.txt', type = 'text/plain', size = 10) {
    return {
        name,
        type,
        size,
    };
}

describe('generic upload services', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete window.kiwiDesktop;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('uploads simple files to Catbox, Filebin, ShareBin, and Uguu', async() => {
        const testFile = file();
        desktopUploadMultipart.mockResolvedValue(response({
            text: 'https://files.catbox.moe/test.txt',
        }));
        await expect(uploadCatbox(testFile, 'hash123'))
            .resolves.toBe('https://files.catbox.moe/test.txt');
        expect(desktopUploadMultipart).toHaveBeenCalledWith(
            'https://catbox.moe/user/api.php',
            { reqtype: 'fileupload', userhash: 'hash123' },
            testFile
        );

        desktopUploadFile.mockResolvedValue(response({
            status: 201,
            json: { file: { filename: 'test.txt' } },
        }));
        const filebinUrl = await uploadFilebin(testFile);
        expect(desktopUploadFile).toHaveBeenCalledWith(
            expect.stringMatching(/^https:\/\/filebin\.net\/[a-f0-9]+\/test\.txt$/),
            testFile,
            {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
            }
        );
        expect(filebinUrl).toMatch(
            /^https:\/\/filebin\.net\/[a-f0-9]+\/test\.txt$/
        );

        desktopUploadMultipart.mockResolvedValue(response({
            text: '<input id="fileLinkText" type="text" value="https://sharebin.eu/files/test.txt">',
        }));
        await expect(uploadSharebin(testFile, '7d'))
            .resolves.toBe('https://sharebin.eu/files/test.txt');
        expect(desktopUploadMultipart).toHaveBeenCalledWith(
            'https://sharebin.eu/',
            { expiry_days: '7' },
            testFile,
            { fileField: 'file' }
        );

        desktopUploadMultipart.mockResolvedValue(response({
            json: {
                success: true,
                files: [{ url: 'https://d.uguu.se/test.txt' }],
            },
        }));
        await expect(uploadUguu(testFile)).resolves.toBe('https://d.uguu.se/test.txt');
        expect(desktopUploadMultipart).toHaveBeenCalledWith(
            'https://uguu.se/upload',
            {},
            testFile,
            { fileField: 'files[]' }
        );
    });

    test('chunks large ShareBin uploads', async() => {
        desktopUploadMultipart
            .mockResolvedValueOnce(response({ text: '{"status":"uploaded"}' }))
            .mockResolvedValueOnce(response({
                text: '{"status":"assembled","link":"https://sharebin.eu/files/big.bin"}',
            }));
        const testFile = {
            name: 'big.bin',
            type: 'application/octet-stream',
            size: (20 * 1024 * 1024) + 1,
            slice: jest.fn(() => new Blob(['chunk'])),
        };

        await expect(uploadSharebin(testFile, '30d'))
            .resolves.toBe('https://sharebin.eu/files/big.bin');
        expect(desktopUploadMultipart).toHaveBeenCalledTimes(2);
        expect(desktopUploadMultipart.mock.calls[1][0])
            .toBe('https://sharebin.eu/upload_part');
        expect(desktopUploadMultipart.mock.calls[1][1]).toMatchObject({
            filename: 'big.bin',
            index: '1',
            total: '2',
            expiry_days: '30',
        });
    });

    test('generates names and uploads to WebDAV with auth and access URLs', async() => {
        jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
        jest.spyOn(Math, 'random').mockReturnValue(0.5);

        const imageName = generateUniqueFilename('folder/photo 1.PNG');
        expect(imageName).toMatch(/^1700000000000-[a-z0-9]+\.PNG$/);
        expect(imageName).not.toContain('photo');
        expect(imageName).not.toContain('/');
        expect(generateUniqueFilename('archive.tar.gz')).toMatch(/\.gz$/);
        expect(generateUniqueFilename('README')).toMatch(/^1700000000000-[a-z0-9]+$/);
        expect(generateUniqueFilename('C:\\Users\\alice\\photo.png'))
            .toMatch(/^1700000000000-[a-z0-9]+\.png$/);

        desktopUploadFile.mockResolvedValue(response({ status: 204 }));
        const testFile = file('photo 1.png', 'image/png');
        const uniqueName = generateUniqueFilename(testFile.name);
        let url = await uploadWebdav(testFile, {
            uploadUrl: 'https://dav.example.com/',
            accessUrl: 'https://static.example.com/',
            username: 'alice',
            password: 'secret',
        });
        expect(desktopUploadFile).toHaveBeenCalledWith(
            `https://dav.example.com/${uniqueName}`,
            testFile,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'image/png',
                    'Authorization': 'Basic YWxpY2U6c2VjcmV0',
                },
            }
        );
        expect(url).toBe(`https://static.example.com/${uniqueName}`);

        desktopUploadFile.mockResolvedValue(response({ status: 201 }));
        url = await uploadWebdav(file('test.txt'), {
            uploadUrl: 'https://dav.example.com/uploads',
        });
        expect(url).toMatch(/^https:\/\/dav\.example\.com\/uploads\/1700000000000-/);
    });

    test('exposes limits and ignores desktop-only services on web', () => {
        expect(services.catbox.maxBytes).toBe(200 * 1024 * 1024);
        expect(services.sharebin.maxBytes).toBe(500 * 1024 * 1024);
        expect(services.uguu.maxBytes).toBe(128 * 1024 * 1024);
        expect(services.sharebin.retentions).toEqual(['1d', '7d', '30d', 'never']);
        expect(retentionFor(services.sharebin, '30d')).toBe('30d');
        expect(retentionFor(services.sharebin, 'garbage')).toBe('7d');
        expect(serviceAvailableOnPlatform(services.litterbox)).toBe(true);
        expect(serviceAvailableOnPlatform(services.catbox)).toBe(false);

        const state = {
            setting(name) {
                return name === 'fileupload.service' ? 'catbox' : undefined;
            },
        };
        expect(effectiveService(state)).toBeNull();

        window.kiwiDesktop = {};
        expect(serviceAvailableOnPlatform(services.catbox)).toBe(true);
        expect(effectiveService(state)).toBe(services.catbox);
    });
});
