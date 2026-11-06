import http from 'node:http';
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
    let baseUrl;

    beforeAll((done) => {
        server = http.createServer((req, res) => {
            if (req.url === '/redirect') {
                res.writeHead(302, { Location: '/ok' });
                res.end();
                return;
            }
            res.writeHead(200, {
                'Content-Type': 'text/plain',
                'X-Test': 'yes',
            });
            res.end('hello');
        });

        server.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            done();
        });
    });

    afterAll((done) => {
        server.close(done);
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
});
