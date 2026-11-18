import http from 'node:http';
import net from 'node:net';
import { request } from '../../desktop/electron/http';

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

describe('Desktop native HTTP transport', () => {
    let server;
    let captureServer;
    let baseUrl;
    let captureBaseUrl;
    let captured;

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

    it('follows a validated redirect', async() => {
        const response = await request({ url: `${baseUrl}/redirect` }, policy());

        expect(response.status).toBe(200);
        expect(response.body.toString()).toBe('hello');
    });

    it('strips credentials and bodies on cross-origin redirects', async() => {
        captured = null;
        const response = await request({
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
        expect(captured).toMatchObject({
            method: 'GET',
            body: '',
        });
        expect(captured.headers.authorization).toBeUndefined();
        expect(captured.headers.cookie).toBeUndefined();
        expect(captured.headers.host).not.toBe('evil.example');
    });

    it('keeps credentials on same-origin redirects', async() => {
        captured = null;
        const response = await request({
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
    });

    it('does not forward a caller-supplied Host header', async() => {
        captured = null;
        await request({
            url: `${captureBaseUrl}/capture`,
            headers: {
                Host: 'evil.example',
            },
        }, policy());

        expect(captured.headers.host).not.toBe('evil.example');
    });

    it('rejects loopback access when private networks are disabled', async() => {
        await expect(request({ url: `${baseUrl}/ok` }, policy({
            allowPrivateNetworks: false,
        }))).rejects.toThrow('private network access is disabled');
    });

    it('rejects responses larger than the configured limit', async() => {
        await expect(request({ url: `${baseUrl}/ok` }, policy({
            maxResponseBytes: 1,
        }))).rejects.toThrow('response is too large');
    });

    it('rejects HTTP error statuses before reading the body', async() => {
        await expect(request({
            url: `${baseUrl}/bad-status`,
            failOnHttpError: true,
        }, policy())).rejects.toMatchObject({
            statusCode: 400,
        });
    });

    it('rejects unexpected content types before reading the body', async() => {
        await expect(request({
            url: `${baseUrl}/audio`,
            acceptContentTypes: ['text/html'],
        }, policy())).rejects.toMatchObject({
            code: 'ERR_UNEXPECTED_CONTENT_TYPE',
        });
    });

    it('accepts structured JSON content types', async() => {
        const response = await request({
            url: `${baseUrl}/vendor-json`,
            acceptContentTypes: ['application/*+json'],
        }, policy());

        expect(response.status).toBe(200);
        expect(response.body.toString()).toBe('{}');
    });

    it('rejects when the connection closes before a response', async() => {
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
});
