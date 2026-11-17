const {
    compareVersions,
    createUpdateService,
    isNewerVersion,
    normalizeRelease,
    parseVersion,
} = require('../../desktop/electron/updates');

function releasePayload(overrides = {}) {
    return {
        tag_name: 'v2.3.0',
        name: 'Kiwi IRC 2.3.0',
        html_url: 'https://code.nephatrine.net/nephatrine/kiwiirc/releases/tag/v2.3.0',
        published_at: '2026-11-17T00:00:00Z',
        ...overrides,
    };
}

function jsonResponse(payload, status = 200) {
    return {
        status,
        body: Buffer.from(JSON.stringify(payload)),
    };
}

function makeService(options = {}) {
    return createUpdateService({
        appVersion: '2.2.0',
        apiUrl: 'https://example.com/releases/latest',
        request: jest.fn(() => Promise.resolve(jsonResponse(releasePayload()))),
        getAutoCheck: () => true,
        getLastNotified: () => '',
        setLastNotified: jest.fn(() => Promise.resolve()),
        onResult: jest.fn(),
        notify: jest.fn(),
        ...options,
    });
}

describe('desktop update checks', () => {
    it('parses and compares semantic versions', () => {
        expect(parseVersion('v2.3.0')).toMatchObject({
            major: 2,
            minor: 3,
            patch: 0,
            prerelease: '',
            text: '2.3.0',
        });
        expect(parseVersion('2.3.0-rc.1').prerelease).toBe('rc.1');
        expect(parseVersion('2.3')).toBe(null);
        expect(compareVersions('2.3.0', '2.2.9')).toBe(1);
        expect(compareVersions('2.2.0', '2.2.0')).toBe(0);
        expect(compareVersions('2.2.0-rc.1', '2.2.0')).toBe(-1);
        expect(compareVersions('2.2.0-rc.2', '2.2.0-rc.1')).toBe(1);
        expect(isNewerVersion('2.3.0', '2.2.0')).toBe(true);
    });

    it('normalizes release metadata', () => {
        expect(normalizeRelease(releasePayload())).toEqual({
            latestVersion: '2.3.0',
            releaseUrl: 'https://code.nephatrine.net/nephatrine/kiwiirc/releases/tag/v2.3.0',
            releaseName: 'Kiwi IRC 2.3.0',
            publishedAt: '2026-11-17T00:00:00Z',
        });
        expect(normalizeRelease(releasePayload({ draft: true }))).toBe(null);
        expect(normalizeRelease(releasePayload({ tag_name: 'nightly' }))).toBe(null);
        expect(normalizeRelease(releasePayload({ html_url: 'file:///tmp/release' }))).toBe(null);
    });

    it('reports a newer release', async() => {
        const request = jest.fn(() => Promise.resolve(jsonResponse(releasePayload())));
        const onResult = jest.fn();
        const service = makeService({ request, onResult });

        const result = await service.check({ manual: true });

        expect(result).toMatchObject({
            currentVersion: '2.2.0',
            latestVersion: '2.3.0',
            updateAvailable: true,
        });
        expect(request).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://example.com/releases/latest',
            method: 'GET',
            acceptContentTypes: ['application/json'],
        }));
        expect(onResult).toHaveBeenCalledWith(result);
        expect(service.status()).toBe(result);
    });

    it('reports an up-to-date release', async() => {
        const service = makeService({
            request: jest.fn(() => Promise.resolve(jsonResponse(releasePayload({
                tag_name: 'v2.2.0',
            })))),
        });

        await expect(service.check({ manual: true })).resolves.toMatchObject({
            currentVersion: '2.2.0',
            latestVersion: '2.2.0',
            updateAvailable: false,
        });
    });

    it('updates the configured endpoint', async() => {
        const request = jest.fn(() => Promise.resolve(jsonResponse(releasePayload())));
        const service = makeService({ request });

        service.setConfig({
            apiUrl: 'https://example.org/releases/latest',
            checkIntervalHours: 6,
        });
        await service.check({ manual: true });

        expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
            url: 'https://example.org/releases/latest',
        }));
    });

    it('clears the cache when the endpoint changes', async() => {
        let now = 1000;
        const request = jest.fn(() => Promise.resolve(jsonResponse(releasePayload())));
        const service = makeService({
            request,
            now: () => now,
        });

        await service.check({ manual: false });
        now += 1000;
        service.setConfig({ apiUrl: 'https://example.org/releases/latest' });
        await service.check({ manual: false });

        expect(request).toHaveBeenCalledTimes(2);
    });

    it('caches automatic checks and bypasses the cache for manual checks', async() => {
        let now = 1000;
        const request = jest.fn(() => Promise.resolve(jsonResponse(releasePayload())));
        const service = makeService({
            request,
            now: () => now,
        });

        await service.check({ manual: false });
        now += 1000;
        await service.check({ manual: false });
        expect(request).toHaveBeenCalledTimes(1);

        await service.check({ manual: true });
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('notifies once per version for automatic checks', async() => {
        let lastNotified = '';
        const notify = jest.fn();
        const setLastNotified = jest.fn((version) => {
            lastNotified = version;
            return Promise.resolve();
        });
        const service = makeService({
            getLastNotified: () => lastNotified,
            setLastNotified,
            notify,
        });

        await service.check({ manual: false });
        await service.check({ manual: false });

        expect(setLastNotified).toHaveBeenCalledWith('2.3.0');
        expect(notify).toHaveBeenCalledTimes(1);

        await service.check({ manual: true });
        expect(notify).toHaveBeenCalledTimes(1);
    });

    it('does not schedule automatic checks when disabled', () => {
        jest.useFakeTimers();
        const request = jest.fn(() => Promise.resolve(jsonResponse(releasePayload())));
        const service = makeService({
            request,
            getAutoCheck: () => false,
            startupDelayMs: 10,
        });

        service.start();
        jest.advanceTimersByTime(100);
        expect(request).not.toHaveBeenCalled();
        service.stop();
        jest.useRealTimers();
    });

    it('reports request and response failures', async() => {
        const failingRequest = makeService({
            request: jest.fn(() => Promise.resolve({
                status: 500,
                body: Buffer.from(''),
            })),
        });
        await expect(failingRequest.check({ manual: true }))
            .rejects.toThrow('update check failed (500)');

        const invalidJson = makeService({
            request: jest.fn(() => Promise.resolve({
                status: 200,
                body: Buffer.from('not-json'),
            })),
        });
        await expect(invalidJson.check({ manual: true }))
            .rejects.toThrow('invalid update response');
    });
});
