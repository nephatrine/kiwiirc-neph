import { TextEncoder } from 'util';
import http from 'node:http';
import net from 'node:net';
import {
    buildMultipart,
    request
} from '../../desktop/electron/http';
import {
    isPrivateAddress,
    pinnedLookup,
    resolveTarget,
    validateHttpUrl
} from '../../desktop/electron/http-policy';
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

    it('falls back to browser fetch and performs native requests', async() => {
        const browserResponse = { ok: true, text: () => Promise.resolve('browser') };
        global.fetch = jest.fn().mockResolvedValue(browserResponse);
        let result = await desktopFetch('https://example.com/data');
        expect(global.fetch).toHaveBeenCalledWith('https://example.com/data', {});
        expect(result).toBe(browserResponse);
        expect(isDesktop()).toBe(false);

        const nativeRequest = jest.fn().mockResolvedValue(Object.assign(
            nativeResult(),
            { url: 'https://example.com/final' }
        ));
        window.kiwiDesktop = { http: { request: nativeRequest } };
        let response = await desktopFetch('https://example.com/data', {
            method: 'POST',
            headers: { 'X-Test': 'yes' },
        });
        expect(nativeRequest).toHaveBeenCalledWith({
            url: 'https://example.com/data',
            method: 'POST',
            headers: { 'X-Test': 'yes' },
            body: undefined,
        });
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('hello');
        expect(isDesktop()).toBe(true);

        response = await desktopFetch('https://example.com/start');
        expect(response.url).toBe('https://example.com/final');

        await desktopFetch('https://example.com/preview', {
            purpose: 'page-preview',
            timeoutMs: 8000,
            maxResponseBytes: 2048,
            acceptContentTypes: ['text/html'],
            truncateAtMaxBytes: true,
            failOnHttpError: true,
        });
        expect(nativeRequest).toHaveBeenLastCalledWith({
            url: 'https://example.com/preview',
            method: 'GET',
            headers: {},
            body: undefined,
            maxResponseBytes: 2048,
            timeoutMs: 8000,
            purpose: 'page-preview',
            acceptContentTypes: ['text/html'],
            truncateAtMaxBytes: true,
            failOnHttpError: true,
        });
    });

    it('limits concurrent preview requests', async() => {
        const pending = [];
        const nativeRequest = jest.fn(() => new Promise((resolve) => {
            pending.push(resolve);
        }));
        window.kiwiDesktop = { http: { request: nativeRequest } };

        const calls = [];
        for (let i = 0; i < 5; i++) {
            calls.push(desktopFetch(`https://example.com/${i}`, {
                purpose: 'page-preview',
            }));
        }

        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(nativeRequest).toHaveBeenCalledTimes(4);

        pending.splice(0).forEach((resolve) => resolve(nativeResult()));
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(nativeRequest).toHaveBeenCalledTimes(5);

        pending.splice(0).forEach((resolve) => resolve(nativeResult()));
        await Promise.all(calls);
    });

    it('uploads files and multipart data with custom fields', async() => {
        const upload = jest.fn().mockResolvedValue(nativeResult());
        window.kiwiDesktop = { http: { upload } };
        let file = {
            name: 'test.txt',
            type: 'text/plain',
            arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        };

        let response = await desktopUploadFile('https://example.com/upload', file, {
            headers: { Authorization: 'Basic test' },
        });
        expect(upload).toHaveBeenCalledWith({
            url: 'https://example.com/upload',
            method: 'POST',
            headers: { Authorization: 'Basic test' },
            body: new Uint8Array([1, 2, 3]),
            purpose: 'upload',
        });
        expect(response.status).toBe(200);

        file = {
            name: 'test.txt',
            type: 'text/plain',
            arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([4, 5])),
        };
        await desktopUploadMultipart(
            'https://example.com/upload',
            { reqtype: 'fileupload', time: '72h' },
            file
        );
        expect(upload).toHaveBeenLastCalledWith({
            url: 'https://example.com/upload',
            method: 'POST',
            headers: {},
            fields: { reqtype: 'fileupload', time: '72h' },
            purpose: 'upload',
            file: {
                name: 'test.txt',
                type: 'text/plain',
                fieldName: 'fileToUpload',
                data: new Uint8Array([4, 5]),
            },
        });

        await desktopUploadMultipart(
            'https://example.com/upload',
            {},
            file,
            { fileField: 'files[]' }
        );
        expect(upload).toHaveBeenLastCalledWith(expect.objectContaining({
            file: expect.objectContaining({
                fieldName: 'files[]',
            }),
        }));
    });

    it('delegates downloads when the files bridge exists', async() => {
        expect(saveUrl('https://example.com/file')).toBe(null);

        const saveUrlFn = jest.fn().mockResolvedValue({ saved: true });
        window.kiwiDesktop = { files: { saveUrl: saveUrlFn } };
        await expect(saveUrl('https://example.com/file')).resolves.toEqual({ saved: true });
        expect(saveUrlFn).toHaveBeenCalledWith('https://example.com/file');
    });
});

describe('Desktop native HTTP transport', () => {
    let server;
    let captureServer;
    let baseUrl;
    let captureBaseUrl;
    let captured;

    function policy(overrides = {}) {
        return Object.assign({
            allowPrivateNetworks: true,
            timeoutMs: 5000,
            maxResponseBytes: 1024 * 1024,
            maxDownloadBytes: 1024 * 1024,
            maxRequestBytes: 1024 * 1024,
            maxRedirects: 3,
        }, overrides);
    }

    function captureRequest(req, res) {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            captured = {
                method: req.method,
                headers: req.headers,
                body: Buffer.concat(chunks).toString(),
            };
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('captured');
        });
    }

    beforeAll(async() => {
        captureServer = http.createServer(captureRequest);
        server = http.createServer((req, res) => {
            if (req.url === '/redirect') {
                res.writeHead(302, { Location: '/ok' });
                res.end();
                return;
            }
            if (req.url === '/redirect-cross-origin') {
                res.writeHead(302, { Location: `${captureBaseUrl}/capture` });
                res.end();
                return;
            }
            if (req.url === '/redirect-same-origin') {
                res.writeHead(307, { Location: '/capture' });
                res.end();
                return;
            }
            if (req.url === '/capture') {
                captureRequest(req, res);
                return;
            }
            if (req.url === '/bad-status') {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('bad request');
                return;
            }
            if (req.url === '/redirect-no-type') {
                res.writeHead(302, { Location: '/html' });
                res.end();
                return;
            }
            if (req.url === '/redirect-no-type-audio') {
                res.writeHead(302, { Location: '/audio' });
                res.end();
                return;
            }
            if (req.url === '/html') {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<html><head><title>Redirected</title></head></html>');
                return;
            }
            if (req.url === '/large-html') {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('x'.repeat(4096));
                return;
            }
            if (req.url === '/audio') {
                res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
                res.end('audio');
                return;
            }
            if (req.url === '/vendor-json') {
                res.writeHead(200, { 'Content-Type': 'application/vnd.api+json' });
                res.end('{}');
                return;
            }
            res.writeHead(200, {
                'Content-Type': 'text/plain',
                'X-Test': 'yes',
            });
            res.end('hello');
        });

        await new Promise((resolve) => {
            server.listen(0, '127.0.0.1', resolve);
        });
        await new Promise((resolve) => {
            captureServer.listen(0, '127.0.0.1', resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        captureBaseUrl = `http://127.0.0.1:${captureServer.address().port}`;
    });

    afterAll(async() => {
        await new Promise((resolve) => {
            server.close(() => resolve());
        });
        await new Promise((resolve) => {
            captureServer.close(() => resolve());
        });
    });

    it('fetches a public response without browser CORS', async() => {
        const response = await request({ url: `${baseUrl}/ok` }, policy());

        expect(response.status).toBe(200);
        expect(response.headers['x-test']).toBe('yes');
        expect(response.body.toString()).toBe('hello');
    });

    it('follows redirects and scopes credentials and headers', async() => {
        let response = await request({ url: `${baseUrl}/redirect` }, policy());
        expect(response.status).toBe(200);
        expect(response.body.toString()).toBe('hello');

        captured = null;
        response = await request({
            url: `${baseUrl}/redirect-cross-origin`,
            method: 'POST',
            headers: {
                'Authorization': 'Basic secret',
                'Cookie': 'session=secret',
                'Host': 'evil.example',
                'Content-Type': 'text/plain',
            },
            body: Buffer.from('secret body'),
        }, policy());
        expect(response.status).toBe(200);
        expect(captured).toMatchObject({ method: 'GET', body: '' });
        expect(captured.headers.authorization).toBeUndefined();
        expect(captured.headers.cookie).toBeUndefined();
        expect(captured.headers.host).not.toBe('evil.example');

        captured = null;
        response = await request({
            url: `${baseUrl}/redirect-same-origin`,
            method: 'POST',
            headers: {
                'Authorization': 'Basic secret',
                'Content-Type': 'text/plain',
            },
            body: Buffer.from('same origin body'),
        }, policy());
        expect(response.status).toBe(200);
        expect(captured).toMatchObject({
            method: 'POST',
            body: 'same origin body',
        });
        expect(captured.headers.authorization).toBe('Basic secret');

        captured = null;
        await request({
            url: `${captureBaseUrl}/capture`,
            headers: { Host: 'evil.example' },
        }, policy());
        expect(captured.headers.host).not.toBe('evil.example');
    });

    it('checks accepted content types on the final response only', async() => {
        const response = await request({
            url: `${baseUrl}/redirect-no-type`,
            acceptContentTypes: ['text/html'],
            failOnHttpError: true,
        }, policy());

        expect(response.status).toBe(200);
        expect(response.body.toString()).toContain('Redirected');

        await expect(request({
            url: `${baseUrl}/redirect-no-type-audio`,
            acceptContentTypes: ['text/html'],
            failOnHttpError: true,
        }, policy())).rejects.toMatchObject({
            code: 'ERR_UNEXPECTED_CONTENT_TYPE',
            contentType: 'audio/mpeg',
        });
    });

    it('truncates oversized responses only when requested', async() => {
        await expect(request({
            url: `${baseUrl}/large-html`,
            maxResponseBytes: 16,
        }, policy())).rejects.toMatchObject({
            code: 'ERR_RESPONSE_TOO_LARGE',
        });

        const response = await request({
            url: `${baseUrl}/large-html`,
            maxResponseBytes: 16,
            truncateAtMaxBytes: true,
        }, policy());

        expect(response.truncated).toBe(true);
        expect(response.body.toString()).toBe('x'.repeat(16));
    });

    it('retries malformed framing with a lenient parser when allowed', async() => {
        const rawServer = net.createServer((socket) => {
            socket.once('data', () => {
                socket.end(
                    'HTTP/1.1 200 OK\r\n' +
                    'Content-Type: text/html\r\n' +
                    'Content-Length: 5\r\n' +
                    'Transfer-Encoding: chunked\r\n\r\n' +
                    '5\r\nhello\r\n0\r\n\r\n'
                );
            });
        });
        await new Promise((resolve) => {
            rawServer.listen(0, '127.0.0.1', resolve);
        });
        const url = `http://127.0.0.1:${rawServer.address().port}/`;

        try {
            await expect(request({ url }, policy())).rejects.toMatchObject({
                code: expect.stringMatching(/^HPE_/),
            });

            const response = await request({
                url,
                allowInsecureHttpParser: true,
            }, policy());
            expect(response.status).toBe(200);
            expect(response.body.toString()).toBe('hello');
        } finally {
            await new Promise((resolve) => {
                rawServer.close(resolve);
            });
        }
    });

    it('rejects private networks, oversized/error responses, and closed connections', async() => {
        await expect(request({ url: `${baseUrl}/ok` }, policy({
            allowPrivateNetworks: false,
        }))).rejects.toThrow('private network access is disabled');

        await expect(request({ url: `${baseUrl}/ok` }, policy({
            maxResponseBytes: 1,
        }))).rejects.toThrow('response is too large');

        await expect(request({
            url: `${baseUrl}/bad-status`,
            failOnHttpError: true,
        }, policy())).rejects.toMatchObject({ statusCode: 400 });

        await expect(request({
            url: `${baseUrl}/audio`,
            acceptContentTypes: ['text/html'],
        }, policy())).rejects.toMatchObject({
            code: 'ERR_UNEXPECTED_CONTENT_TYPE',
        });

        const closingServer = net.createServer((socket) => {
            socket.destroy();
        });
        await new Promise((resolve) => {
            closingServer.listen(0, '127.0.0.1', resolve);
        });
        const port = closingServer.address().port;

        try {
            await expect(request({
                url: `http://127.0.0.1:${port}/`,
                timeoutMs: 1000,
            }, policy())).rejects.toBeDefined();
        } finally {
            await new Promise((resolve) => {
                closingServer.close(resolve);
            });
        }
    });

    it('accepts structured JSON content types', async() => {
        const response = await request({
            url: `${baseUrl}/vendor-json`,
            acceptContentTypes: ['application/*+json'],
        }, policy());

        expect(response.status).toBe(200);
        expect(response.body.toString()).toBe('{}');
    });
});

describe('Desktop HTTP policy', () => {
    it('rejects non-HTTP URLs and URL credentials', () => {
        expect(() => validateHttpUrl('file:///etc/passwd')).toThrow();
        expect(() => validateHttpUrl('data:text/plain,hello')).toThrow();
        expect(() => validateHttpUrl('https://user:pass@example.com/')).toThrow();
    });

    it('recognizes private and reserved addresses', () => {
        expect(isPrivateAddress('127.0.0.1')).toBe(true);
        expect(isPrivateAddress('10.1.2.3')).toBe(true);
        expect(isPrivateAddress('172.16.0.1')).toBe(true);
        expect(isPrivateAddress('192.168.1.1')).toBe(true);
        expect(isPrivateAddress('169.254.1.1')).toBe(true);
        expect(isPrivateAddress('100.64.0.1')).toBe(true);
        expect(isPrivateAddress('::1')).toBe(true);
        expect(isPrivateAddress('fc00::1')).toBe(true);
        expect(isPrivateAddress('fe80::1')).toBe(true);
        expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
        expect(isPrivateAddress('::ffff:7f00:1')).toBe(true);
        expect(isPrivateAddress('93.184.216.34')).toBe(false);
    });

    it('rejects a hostname that resolves to a private address by default', async() => {
        const lookup = jest.fn().mockResolvedValue([
            { address: '10.0.0.5', family: 4 },
        ]);

        await expect(resolveTarget('https://example.test/', false, lookup))
            .rejects.toThrow('private network access is disabled');
    });

    it('allows a hostname that resolves to a private address when opted in', async() => {
        const lookup = jest.fn().mockResolvedValue([
            { address: '10.0.0.5', family: 4 },
        ]);

        const target = await resolveTarget('https://example.test/', true, lookup);

        expect(target.address).toBe('10.0.0.5');
        expect(target.family).toBe(4);
    });

    it('rejects mixed public and private DNS results by default', async() => {
        const lookup = jest.fn().mockResolvedValue([
            { address: '93.184.216.34', family: 4 },
            { address: '192.168.0.5', family: 4 },
        ]);

        await expect(resolveTarget('https://example.test/', false, lookup)).rejects.toThrow();
    });

    it('supports the all-address lookup form used by newer Node runtimes', () => {
        const lookup = pinnedLookup([
            { address: '2001:db8::1', family: 6 },
            { address: '93.184.216.34', family: 4 },
        ]);
        const done = jest.fn();

        lookup('example.test', { all: true }, done);

        expect(done).toHaveBeenCalledWith(null, [
            { address: '2001:db8::1', family: 6 },
            { address: '93.184.216.34', family: 4 },
        ]);
    });

    it('supports the single-address lookup form', () => {
        const lookup = pinnedLookup('93.184.216.34', 4);
        const done = jest.fn();

        lookup('example.test', {}, done);

        expect(done).toHaveBeenCalledWith(null, '93.184.216.34', 4);
    });

    it('builds a multipart body with fields and a file', () => {
        const result = buildMultipart(
            { reqtype: 'fileupload', time: '72h' },
            {
                name: 'test.txt',
                type: 'text/plain',
                data: Buffer.from('hello'),
            }
        );

        expect(result.contentType).toContain('multipart/form-data; boundary=');
        expect(result.body.toString()).toContain('name="reqtype"');
        expect(result.body.toString()).toContain('name="time"');
        expect(result.body.toString()).toContain('filename="test.txt"');
        expect(result.body.toString()).toContain('hello');
    });

    it('supports a custom multipart file field name', () => {
        const result = buildMultipart(
            {},
            {
                name: 'test.txt',
                type: 'text/plain',
                fieldName: 'files[]',
                data: Buffer.from('hello'),
            }
        );

        expect(result.body.toString()).toContain('name="files[]"');
    });
});
