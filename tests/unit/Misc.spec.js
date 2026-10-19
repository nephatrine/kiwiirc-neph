import * as Misc from '@/helpers/Misc';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    const translations = {
        error_test: 'Translated test',
        error_unknown: 'Unknown error',
    };
    return {
        ...actual,
        t: jest.fn((key) => (translations[key] === undefined ? key : translations[key])),
    };
});

describe('Misc.js', () => {
    const nicksTests = [
        ['foo', 'foo', true], // on its own
        ['Foo', 'foo', true], // different case
        ['foo bar baz', 'foo', true], // start of line
        ['baz foo bar', 'foo', true], // in middle of line
        ['bar baz foo', 'foo', true], // end of line
        ['missing', 'foo', false], // doesnt exist in text
        ['baz food bar', 'foo', false], // dont trigger on substrings
        ['hello food foo bar', 'foo', true], // when substring exists previously
        ['hello, foo?', 'foo', true], // punctuation test
        ['foo: hello', 'foo', true], // another
        ['hello (foo)', 'foo', true], // another
        ['https://domain.com/foo/blah.png', 'foo', false], // nick only in a url
        ['check https://domain.com/foo/blah.png out', 'foo', false], // url in a sentence
        ['www.domain.com/foo/bar', 'foo', false], // www url without protocol
        ['https://domain.com/foo/x.png hey foo', 'foo', true], // real mention beside a url
    ];
    test.each(nicksTests)('should find mentions of nickname in text [%#]', (line, nick, result) => {
        let doesMention = Misc.mentionsNick(line, nick);
        expect(doesMention).toEqual(result);
    });

    const networkParseTests = [
        ['example|irc.example.com:6667', 'irc://irc.example.com:6667', { name: 'example', server: 'irc.example.com', port: 6667, tls: false, direct: false }],
        ['example|irc.example.com:+6697', 'ircs://irc.example.com:6697', { name: 'example', server: 'irc.example.com', port: 6697, tls: true, direct: false }],
        ['irc.example.com:+6697', 'ircs://irc.example.com:6697', { name: 'irc.example.com', server: 'irc.example.com', port: 6697, tls: true, direct: false }],
        ['example|irc://irc.example.com', 'irc://irc.example.com:6667', { name: 'example', server: 'irc.example.com', port: 6667, tls: false, direct: false }],
        ['example|ircs://irc.example.com', 'ircs://irc.example.com:6697', { name: 'example', server: 'irc.example.com', port: 6697, tls: true, direct: false }],
        ['example|ws://irc.example.com:8067', 'ws://irc.example.com:8067', { name: 'example', server: 'irc.example.com', port: 8067, tls: false, direct: true }],
        ['example|wss://irc.example.com:8097', 'wss://irc.example.com:8097', { name: 'example', server: 'irc.example.com', port: 8097, tls: true, direct: true }],
        ['example|ws://irc.example.com', 'ws://irc.example.com:8067', { name: 'example', server: 'irc.example.com', port: 8067, tls: false, direct: true }],
        ['example|wss://irc.example.com', 'wss://irc.example.com:8097', { name: 'example', server: 'irc.example.com', port: 8097, tls: true, direct: true }],
        ['ws://irc.example.com', 'ws://irc.example.com:8067', { name: 'irc.example.com', server: 'irc.example.com', port: 8067, tls: false, direct: true }],
        ['example|wss://irc.example.com:8097/some/path/', 'wss://irc.example.com:8097/some/path/', { name: 'example', server: 'irc.example.com', port: 8097, tls: true, direct: true, path: '/some/path/' }],
        ['example|wss://irc.example.com:8097/some/path/#chan1,#chan2', 'wss://irc.example.com:8097/some/path/', { name: 'example', server: 'irc.example.com', port: 8097, tls: true, direct: true, path: '/some/path/', channels: '#chan1,#chan2' }],
        ['example|wss://irc.example.com/some/path', 'wss://irc.example.com:8097/some/path', { name: 'example', server: 'irc.example.com', port: 8097, tls: true, direct: true, path: '/some/path' }],
        ['example|irc.example.com#test123', 'irc://irc.example.com:6667', { name: 'example', server: 'irc.example.com', port: 6667, tls: false, direct: false, channels: '#test123' }],
        ['[2600:1406:bc00:53::b81e:94ce]', 'irc://[2600:1406:bc00:53::b81e:94ce]:6667', { name: '[2600:1406:bc00:53::b81e:94ce]', server: '[2600:1406:bc00:53::b81e:94ce]', port: 6667, tls: false, direct: false }],
        ['23.192.228.84', 'irc://23.192.228.84:6667', { name: '23.192.228.84', server: '23.192.228.84', port: 6667, tls: false, direct: false }],
    ];
    test.each(networkParseTests)('should parse network preset [%#]', (item, uri, obj, ...args) => {
        let server = Misc.parsePresetServer(item);
        expect(server.toUri()).toEqual(uri);
        expect(server).toMatchObject(obj);
    });

    const styleStripTests = [
        ['\x034Single \x034,3SingleBG\x03', 'Single SingleBG'],
        ['\x0304Foreground\x03 \x0304,03Background', 'Foreground Background'],
        ['\x03,03Bad\x03', ',03Bad'],
        ['\x04f0f0f0Foreground\x04 \x04f0f0f0,0f0f0fBackground', 'Foreground Background'],
        ['\x04F0F0F0Foreground \x04F0F0F0,0F0F0FBackground', 'Foreground Background'],
        ['\x04,f0f0f0Bad\x04', ',f0f0f0Bad'],
        ['\x03\u200B04,14Foreground', '04,14Foreground'],
        ['\x0304\u200B,14Foreground', ',14Foreground'],
        ['\x04\u200Bf0f0f0,123456Foreground', 'f0f0f0,123456Foreground'],
        ['\x04f0f0f0\u200B,123456Foreground', ',123456Foreground'],
        ['\x0304,Comma', ',Comma'],
        ['\x02Bold \x1dItalic \x1fUnderline \x1eStrikethrough \x11Monospace \x16Reverse \x0fReset', 'Bold Italic Underline Strikethrough Monospace Reverse Reset'],
    ];
    test.each(styleStripTests)('should strip styles from text [%#]', (line, result) => {
        const stripped = Misc.stripStyles(line);
        expect(stripped).toEqual(result);
    });

    const dedotTests = [
        {
            name: 'keeps flat objects unchanged',
            input: { test1: 'test1' },
            expected: { test1: 'test1' },
        },
        {
            name: 'dedots a single nested key',
            input: {
                test1: {
                    'test2.test3': 'test3',
                },
            },
            expected: {
                test1: {
                    test2: {
                        test3: 'test3',
                    },
                },
            },
        },
        {
            name: 'dedots multiple dotted keys at the same level',
            input: {
                'a.b': 1,
                'a.c': 2,
            },
            expected: {
                a: {
                    b: 1,
                    c: 2,
                },
            },
        },
        {
            name: 'preserves non-dotted siblings',
            input: {
                'a': 1,
                'b.c': 2,
            },
            expected: {
                a: 1,
                b: {
                    c: 2,
                },
            },
        },
        {
            name: 'merges into existing nested objects',
            input: {
                'a': {
                    b: {
                        c: 1,
                    },
                },
                'a.b.d': 2,
            },
            expected: {
                a: {
                    b: {
                        c: 1,
                        d: 2,
                    },
                },
            },
        },
        {
            name: 'does not overwrite existing values when expanding keys',
            input: {
                'a': {
                    b: 1,
                },
                'a.b.c': 2,
            },
            expected: {
                a: {
                    b: {
                        c: 2,
                    },
                },
            },
        },
        {
            name: 'ignores empty path segments',
            input: {
                'a..b': 1,
            },
            expected: {
                a: {
                    b: 1,
                },
            },
        },
        {
            name: 'handles leading and trailing dots',
            input: {
                '.a.b.': 1,
            },
            expected: {
                a: {
                    b: 1,
                },
            },
        },
        {
            name: 'does not dedot inside arrays',
            input: {
                a: [
                    { 'b.c': 1 },
                ],
            },
            expected: {
                a: [
                    { 'b.c': 1 },
                ],
            },
        },
        {
            name: 'preserves null and undefined values',
            input: {
                'a.b': null,
                'c': undefined,
            },
            expected: {
                a: {
                    b: null,
                },
                c: undefined,
            },
        },
        {
            name: 'treats numeric path segments as object keys',
            input: {
                'a.0.b': 'value',
            },
            expected: {
                a: {
                    0: {
                        b: 'value',
                    },
                },
            },
        },
        {
            name: 'is safe when run multiple times',
            input: {
                a: {
                    b: {
                        c: 1,
                    },
                },
            },
            expected: {
                a: {
                    b: {
                        c: 1,
                    },
                },
            },
        },
    ];

    test.each(dedotTests)('dedotObject: $name', ({ input, expected }) => {
        Misc.dedotObject(input);
        expect(input).toMatchObject(expected);
    });

    const originBase = 'https://kiwi.example/client/';
    test('detects same-origin urls', () => {
        expect(Misc.isSameOriginUrl('https://kiwi.example/files/a.html', originBase)).toBe(true);
        expect(Misc.isSameOriginUrl('/files/a.html', originBase)).toBe(true);
        expect(Misc.isSameOriginUrl('https://other.example/a.html', originBase)).toBe(false);
        expect(Misc.isSameOriginUrl('http://kiwi.example/a.html', originBase)).toBe(false);
        expect(Misc.isSameOriginUrl('', originBase)).toBe(false);
    });

    test('allows same-origin media opens except svg and html', () => {
        expect(Misc.isSafeSameOriginOpen('https://kiwi.example/a.png')).toBe(true);
        expect(Misc.isSafeSameOriginOpen('https://kiwi.example/a.png?x=1')).toBe(true);
        expect(Misc.isSafeSameOriginOpen('https://kiwi.example/a.mp3')).toBe(true);
        expect(Misc.isSafeSameOriginOpen('https://kiwi.example/a.svg')).toBe(false);
        expect(Misc.isSafeSameOriginOpen('https://kiwi.example/a.svg?x=1')).toBe(false);
        expect(Misc.isSafeSameOriginOpen('https://kiwi.example/a.html')).toBe(false);
        expect(Misc.isSafeSameOriginOpen('https://kiwi.example/page')).toBe(false);
    });

    describe('errorMessage', () => {
        test('falls back for empty values', () => {
            expect(Misc.errorMessage(undefined)).toBe('Unknown error');
            expect(Misc.errorMessage('')).toBe('Unknown error');
        });

        test('returns a plain string unchanged', () => {
            expect(Misc.errorMessage('plain string')).toBe('plain string');
        });

        test('prefers a string reason', () => {
            expect(Misc.errorMessage({ reason: 'readonly database' })).toBe('readonly database');
        });

        test('uses a message when there is no reason', () => {
            expect(Misc.errorMessage({ message: 'boom' })).toBe('boom');
        });

        test('prefers the reason over the message', () => {
            expect(Misc.errorMessage({ reason: 'reason wins', message: 'message' })).toBe('reason wins');
        });

        test('reads an Error message', () => {
            expect(Misc.errorMessage(new Error('nope'))).toBe('nope');
        });

        test('stringifies an object with neither reason nor message', () => {
            expect(Misc.errorMessage({ error: 'UNKNOWN_ERROR' })).toBe('{"error":"UNKNOWN_ERROR"}');
        });

        test('falls back to String() when the value cannot be stringified', () => {
            let circular = {};
            circular.self = circular;
            expect(Misc.errorMessage(circular)).toBe('[object Object]');
        });
    });
});

describe('Misc.js helpers', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete global.fetch;
        delete window.URL.createObjectURL;
        delete window.URL.revokeObjectURL;
        window.kiwi_deprecations_vueEl = false;
    });

    describe('makePluginObject', () => {
        test('wraps a vue component object and keeps its props', () => {
            const plugin = Misc.makePluginObject(7, { name: 'Thing' }, { props: { foo: 1 }, title: 'Hello' });

            expect(plugin.id).toBe(7);
            expect(typeof plugin.component).toBe('function');
            expect(plugin.props).toEqual({ foo: 1 });
            expect(plugin.title()).toBe('Hello');
            expect(plugin.tabName).toBe('Hello');
        });

        test('defaults the tab name to plugin_tab_<id>', () => {
            const plugin = Misc.makePluginObject(12, { name: 'Thing' });

            expect(plugin.tabName).toBe('plugin_tab_12');
            expect(plugin.title()).toBe('');
        });

        test('translates a t_ prefixed title', () => {
            const plugin = Misc.makePluginObject(3, { name: 'Thing' }, { title: 't_error_test' });

            expect(plugin.title()).toBe('Translated test');
        });

        test('wraps a raw element and carries it as a prop', () => {
            const el = document.createElement('span');
            const plugin = Misc.makePluginObject(4, el);

            expect(plugin.component).toBeTruthy();
            expect(plugin.props.pluginElement).toBe(el);
        });

        test('warns once when a mounted $el is passed', () => {
            const el = document.createElement('span');
            // eslint-disable-next-line no-underscore-dangle
            el.__vue__ = {};
            window.kiwi_deprecations_vueEl = false;
            const warnSpy = jest.spyOn(window.console, 'warn').mockImplementation(() => {});

            Misc.makePluginObject(5, el);
            expect(warnSpy).toHaveBeenCalled();

            Misc.makePluginObject(6, el);
            expect(warnSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('downloadUrl', () => {
        test('saves a fetched blob under the file name', async() => {
            const blob = { size: 3 };
            const createObjectURL = jest.fn(() => 'blob:kiwi');
            const revokeObjectURL = jest.fn();
            window.URL.createObjectURL = createObjectURL;
            window.URL.revokeObjectURL = revokeObjectURL;
            global.fetch = jest.fn(() => Promise.resolve({
                ok: true,
                blob: () => Promise.resolve(blob),
            }));

            let downloaded = null;
            const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
                downloaded = this.download;
            });

            await Misc.downloadUrl('https://kiwi.example/files/report.pdf');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://kiwi.example/files/report.pdf',
                { credentials: 'same-origin' }
            );
            expect(createObjectURL).toHaveBeenCalledWith(blob);
            expect(downloaded).toBe('report.pdf');
            expect(revokeObjectURL).toHaveBeenCalledWith('blob:kiwi');
            expect(document.querySelector('a')).toBeNull();
            clickSpy.mockRestore();
        });

        test('resolves quietly when the fetch fails', async() => {
            global.fetch = jest.fn(() => Promise.reject(new Error('offline')));

            await expect(Misc.downloadUrl('https://kiwi.example/a.png')).resolves.toBeUndefined();
        });

        test('resolves quietly when the response is not ok', async() => {
            global.fetch = jest.fn(() => Promise.resolve({ ok: false }));

            await expect(Misc.downloadUrl('https://kiwi.example/a.png')).resolves.toBeUndefined();
        });

        test('ignores an unparseable url without fetching', async() => {
            global.fetch = jest.fn();

            await expect(Misc.downloadUrl('http://[')).resolves.toBeUndefined();
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('small helpers', () => {
        test('connectionInfoFromConfig parses a websocket url', () => {
            const connection = Misc.connectionInfoFromConfig({ websocket: 'wss://irc.example.com:8097/socket?token=1' });

            expect(connection).toMatchObject({
                direct: true,
                tls: true,
                port: 8097,
                hostname: 'irc.example.com',
                direct_path: '/socket?token=1',
            });
        });

        test('connectionInfoFromConfig falls back to plain fields', () => {
            const connection = Misc.connectionInfoFromConfig({
                server: 'irc.example.com',
                port: 7000,
                tls: true,
                direct: false,
            });

            expect(connection).toMatchObject({
                tls: true,
                port: 7000,
                hostname: 'irc.example.com',
                direct: false,
                direct_path: '',
            });
        });

        test('matchUri splits a uri into its parts', () => {
            expect(Misc.matchUri('ws://host.example:6676/path?foo=val')).toEqual({
                protocol: 'ws',
                hostname: 'host.example',
                port: 6676,
                path: '/path',
                search: 'foo=val',
            });
            expect(Misc.matchUri('UPPERCASE')).toBeNull();
        });

        test('parseIrcUri parses connections, channels and params', () => {
            const connections = Misc.parseIrcUri('ircs://irc.example.com:+6697/#chan,#chan2?nick=bob');

            expect(connections).toHaveLength(1);
            expect(connections[0]).toMatchObject({
                tls: true,
                server: 'irc.example.com',
                port: 6697,
                nick: 'bob',
                direct: false,
            });
            expect(connections[0].channels).toEqual(['#chan', '#chan2']);
        });

        test('parseIrcUri handles several connections and skips blanks', () => {
            const connections = Misc.parseIrcUri('a.example; ;b.example:7000');

            expect(connections).toHaveLength(2);
            expect(connections[0].server).toBe('a.example');
            expect(connections[1].port).toBe(7000);
        });

        test('getDefaultConnection builds an irc uri', () => {
            const connection = Misc.getDefaultConnection();

            expect(connection.port).toBe(6667);
            expect(connection.toUri()).toBe('irc://:6667');
        });

        test('queryStringVal reads and decodes a query value', () => {
            expect(Misc.queryStringVal('foo', 'https://x/?foo=bar')).toBe('bar');
            expect(Misc.queryStringVal('foo', 'https://x/?foo=a%20b')).toBe('a b');
            expect(Misc.queryStringVal('foo', 'https://x/?foo')).toBe('');
            expect(Misc.queryStringVal('foo', 'https://x/')).toBeNull();
        });

        test('processNickRandomNumber replaces ? with digits', () => {
            expect(Misc.processNickRandomNumber('kiwi-?')).toMatch(/^kiwi-\d+$/);
            expect(Misc.processNickRandomNumber('fixed')).toBe('fixed');
            expect(Misc.processNickRandomNumber('')).toMatch(/^kiwi-n\d+$/);
        });

        test('networkErrorMessage translates known codes and falls back', () => {
            expect(Misc.networkErrorMessage('err_test')).toBe('Translated test');
            expect(Misc.networkErrorMessage('err_missing')).toBe('Unknown error');
        });

        test('strCompare sorts numbered nicks naturally', () => {
            expect(Misc.strCompare('nick2', 'nick10')).toBeLessThan(0);
            expect(Misc.strCompare('same', 'same')).toBe(0);
            expect(Misc.strCompare('b', 'a')).toBeGreaterThan(0);
        });

        test('replaceObjectProps swaps every property', () => {
            const target = { a: 1, b: 2 };
            Misc.replaceObjectProps(target, { c: 3 });

            expect(target).toEqual({ c: 3 });
        });

        test('dateIso formats a utc timestamp', () => {
            expect(Misc.dateIso(new Date(Date.UTC(2020, 0, 2, 3, 4, 5, 6))))
                .toBe('2020-01-02T03:04:05.006Z');
        });

        test('parseIntZero casts and falls back to zero', () => {
            expect(Misc.parseIntZero('42')).toBe(42);
            expect(Misc.parseIntZero('nope')).toBe(0);
            expect(Misc.parseIntZero('')).toBe(0);
        });

        test('hasUnmatchedTrailingBracket detects an unclosed bracket', () => {
            expect(Misc.hasUnmatchedTrailingBracket('hello)')).toBe(true);
            expect(Misc.hasUnmatchedTrailingBracket('(hello)')).toBe(false);
            expect(Misc.hasUnmatchedTrailingBracket('hello')).toBe(false);
        });

        test('generateLabel is unique per call', () => {
            const first = Misc.generateLabel();
            const second = Misc.generateLabel();

            expect(first).toMatch(/^kiwi-l-\d+-\d+$/);
            expect(second).not.toBe(first);
        });

        test('extractBuffers pairs names with keys', () => {
            expect(Misc.extractBuffers('#chan,#chan2 key')).toEqual([
                { name: '#chan', key: 'key' },
                { name: '#chan2', key: '' },
            ]);
        });

        test('extractURL returns the first url', () => {
            expect(Misc.extractURL('see https://example.com/a.png now')).toBe('https://example.com/a.png');
            expect(Misc.extractURL('nothing here')).toBe('');
        });
    });

    describe('compareVersions', () => {
        test('orders plain release versions', () => {
            expect(Misc.compareVersions('2.0.0', '1.5.0')).toBe(1);
            expect(Misc.compareVersions('1.5.0', '2.0.0')).toBe(-1);
            expect(Misc.compareVersions('2.0.0', '2.0.0')).toBe(0);
        });

        test('handles differing segment counts and a leading v', () => {
            expect(Misc.compareVersions('2.1', '2.0.9')).toBe(1);
            expect(Misc.compareVersions('v2.0.0', '2.0.0')).toBe(0);
        });

        test('ranks a prerelease below its release', () => {
            expect(Misc.compareVersions('2.0.0-rc.1', '2.0.0')).toBe(-1);
            expect(Misc.compareVersions('2.0.0', '2.0.0-rc.1')).toBe(1);
        });

        test('applies semver prerelease ordering', () => {
            expect(Misc.compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
            expect(Misc.compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1);
            expect(Misc.compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1);
        });

        test('ignores build metadata', () => {
            expect(Misc.compareVersions('1.2.3+build.5', '1.2.3+build.9')).toBe(0);
        });
    });
});
