import { TextEncoder } from 'util';
import {
    desktopFetch,
    desktopUploadFile,
    desktopUploadMultipart,
    isDesktop
} from '@/libs/desktop/Http';
import { saveUrl } from '@/libs/desktop/Files';

if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}

if (typeof global.Response === 'undefined') {
    global.Response = class Response {
        constructor(body, init = {}) {
            this.body = body || new Uint8Array();
            this.status = init.status || 200;
            this.statusText = init.statusText || '';
            this.headers = {
                get: (name) => (init.headers || {})[String(name).toLowerCase()] || null,
            };
            this.ok = this.status >= 200 && this.status < 300;
        }

        async text() {
            return Buffer.from(this.body).toString('utf8');
        }

        async arrayBuffer() {
            return this.body.buffer.slice(
                this.body.byteOffset,
                this.body.byteOffset + this.body.byteLength
            );
        }
    };
}

function nativeResult(body = 'hello') {
    return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        body: new TextEncoder().encode(body),
    };
}

describe('Desktop HTTP adapter', () => {
    afterEach(() => {
        delete window.kiwiDesktop;
        delete global.fetch;
    });

    it('uses the browser fetch fallback when the bridge is absent', async() => {
        const response = { ok: true, text: () => Promise.resolve('browser') };
        global.fetch = jest.fn().mockResolvedValue(response);

        const result = await desktopFetch('https://example.com/data');

        expect(global.fetch).toHaveBeenCalledWith('https://example.com/data', {});
        expect(result).toBe(response);
        expect(isDesktop()).toBe(false);
    });

    it('performs native requests through the bridge', async() => {
        const request = jest.fn().mockResolvedValue(nativeResult());
        window.kiwiDesktop = { http: { request } };

        const response = await desktopFetch('https://example.com/data', {
            method: 'POST',
            headers: { 'X-Test': 'yes' },
        });

        expect(request).toHaveBeenCalledWith({
            url: 'https://example.com/data',
            method: 'POST',
            headers: { 'X-Test': 'yes' },
            body: undefined,
        });
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('hello');
        expect(isDesktop()).toBe(true);
    });

    it('exposes the final native response URL after redirects', async() => {
        const request = jest.fn().mockResolvedValue(Object.assign(nativeResult(), {
            url: 'https://example.com/final',
        }));
        window.kiwiDesktop = { http: { request } };

        const response = await desktopFetch('https://example.com/start');

        expect(response.url).toBe('https://example.com/final');
    });

    it('sends a file upload through the bridge', async() => {
        const upload = jest.fn().mockResolvedValue(nativeResult());
        window.kiwiDesktop = { http: { upload } };
        const file = {
            name: 'test.txt',
            type: 'text/plain',
            arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        };

        const response = await desktopUploadFile('https://example.com/upload', file, {
            headers: { Authorization: 'Basic test' },
        });

        expect(upload).toHaveBeenCalledWith({
            url: 'https://example.com/upload',
            method: 'POST',
            headers: { Authorization: 'Basic test' },
            body: new Uint8Array([1, 2, 3]),
        });
        expect(response.status).toBe(200);
    });

    it('sends multipart uploads through the bridge', async() => {
        const upload = jest.fn().mockResolvedValue(nativeResult());
        window.kiwiDesktop = { http: { upload } };
        const file = {
            name: 'test.txt',
            type: 'text/plain',
            arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([4, 5])),
        };

        await desktopUploadMultipart(
            'https://example.com/upload',
            { reqtype: 'fileupload', time: '72h' },
            file
        );

        expect(upload).toHaveBeenCalledWith({
            url: 'https://example.com/upload',
            method: 'POST',
            headers: {},
            fields: { reqtype: 'fileupload', time: '72h' },
            file: {
                name: 'test.txt',
                type: 'text/plain',
                fieldName: 'fileToUpload',
                data: new Uint8Array([4, 5]),
            },
        });
    });

    it('passes a custom multipart file field name', async() => {
        const upload = jest.fn().mockResolvedValue(nativeResult());
        window.kiwiDesktop = { http: { upload } };
        const file = {
            name: 'test.txt',
            type: 'text/plain',
            arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([4, 5])),
        };

        await desktopUploadMultipart(
            'https://example.com/upload',
            {},
            file,
            { fileField: 'files[]' }
        );

        expect(upload).toHaveBeenCalledWith(expect.objectContaining({
            file: expect.objectContaining({
                fieldName: 'files[]',
            }),
        }));
    });

    it('returns null for downloads when the native bridge is absent', () => {
        expect(saveUrl('https://example.com/file')).toBe(null);
    });

    it('delegates native downloads to the files bridge', async() => {
        const saveUrlFn = jest.fn().mockResolvedValue({ saved: true });
        window.kiwiDesktop = { files: { saveUrl: saveUrlFn } };

        await expect(saveUrl('https://example.com/file')).resolves.toEqual({ saved: true });
        expect(saveUrlFn).toHaveBeenCalledWith('https://example.com/file');
    });
});
