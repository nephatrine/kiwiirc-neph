import ConfigLoader, { parseConfigText } from '@/libs/ConfigLoader';
import { loadJson5 } from '@/libs/Json5Loader';

jest.mock('@/libs/Json5Loader', () => {
    const JSON5 = jest.requireActual('json5');
    return {
        loadJson5: jest.fn(() => Promise.resolve(JSON5)),
        getJson5: () => JSON5,
    };
});

function mockFetch(body) {
    global.fetch = jest.fn(() => Promise.resolve({
        text: () => Promise.resolve(body),
    }));
}

describe('ConfigLoader', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete global.fetch;
    });

    test('parses strict JSON, JSON5, and replacements', async() => {
        let config = await parseConfigText('{"foo":"bar"}');
        expect(config.foo).toBe('bar');
        expect(loadJson5).not.toHaveBeenCalled();

        mockFetch('{ foo: "bar", nested: { one: 1 } }');
        let loader = new ConfigLoader();
        config = await loader.loadFromUrl('/static/config.json');
        expect(global.fetch).toHaveBeenCalledWith('/static/config.json');
        expect(config.foo).toBe('bar');
        expect(config.nested.one).toBe(1);
        expect(loadJson5).toHaveBeenCalled();

        mockFetch('{ host: "{{hostname}}" }');
        loader = new ConfigLoader();
        loader.addValueReplacement('hostname', 'irc.example.com');
        config = await loader.loadFromUrl('/static/config.json');
        expect(config.host).toBe('irc.example.com');
    });

    test('reports parse and network failures', async() => {
        jest.spyOn(window.console, 'error').mockImplementation(() => {});
        mockFetch('{ "foo": }');
        let loader = new ConfigLoader();
        await expect(loader.loadFromUrl('/static/config.json'))
            .rejects.toMatch(/^Config file error:/);

        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        loader = new ConfigLoader();
        await expect(loader.loadFromUrl('/static/config.json'))
            .rejects.toThrow('network down');
    });

    test('loads objects and inserts replacement values', async() => {
        let loader = new ConfigLoader();
        const config = await loader.loadFromObj({ foo: 'bar' });
        expect(config.foo).toBe('bar');

        loader = new ConfigLoader();
        loader.addValueReplacement('port', 443);
        loader.addValueReplacement('host', 'example.com');
        expect(loader.insertReplacements('{{port}}')).toBe(443);
        expect(loader.insertReplacements('ws://{{host}}/socket'))
            .toBe('ws://example.com/socket');
    });
});
