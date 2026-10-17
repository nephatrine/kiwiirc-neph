import ConfigLoader from '@/libs/ConfigLoader';

function mockFetch(body) {
    global.fetch = jest.fn(() => Promise.resolve({
        text: () => Promise.resolve(body),
    }));
}

describe('ConfigLoader', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete global.fetch;
    });

    describe('loadFromUrl', () => {
        it('fetches and parses a JSON5 config', async() => {
            mockFetch('{ foo: "bar", nested: { one: 1 } }');

            const loader = new ConfigLoader();
            const config = await loader.loadFromUrl('/static/config.json');

            expect(global.fetch).toHaveBeenCalledWith('/static/config.json');
            expect(config.foo).toBe('bar');
            expect(config.nested.one).toBe(1);
        });

        it('expands value replacements while parsing', async() => {
            mockFetch('{ host: "{{hostname}}" }');

            const loader = new ConfigLoader();
            loader.addValueReplacement('hostname', 'irc.example.com');
            const config = await loader.loadFromUrl('/static/config.json');

            expect(config.host).toBe('irc.example.com');
        });

        it('rejects with a friendly message for invalid JSON5', async() => {
            jest.spyOn(window.console, 'error').mockImplementation(() => {});
            mockFetch('{ "foo": }');

            const loader = new ConfigLoader();

            await expect(loader.loadFromUrl('/static/config.json'))
                .rejects.toMatch(/^Config file error:/);
        });

        it('propagates network failures', async() => {
            global.fetch = jest.fn(() => Promise.reject(new Error('network down')));

            const loader = new ConfigLoader();

            await expect(loader.loadFromUrl('/static/config.json'))
                .rejects.toThrow('network down');
        });
    });

    describe('loadFromObj', () => {
        it('resolves with the parsed config object', async() => {
            const loader = new ConfigLoader();
            const config = await loader.loadFromObj({ foo: 'bar' });

            expect(config.foo).toBe('bar');
        });
    });

    describe('insertReplacements', () => {
        it('returns non-string replacement values intact', () => {
            const loader = new ConfigLoader();
            loader.addValueReplacement('port', 443);

            expect(loader.insertReplacements('{{port}}')).toBe(443);
        });

        it('replaces placeholders inline', () => {
            const loader = new ConfigLoader();
            loader.addValueReplacement('host', 'example.com');

            expect(loader.insertReplacements('ws://{{host}}/socket')).toBe('ws://example.com/socket');
        });
    });
});
