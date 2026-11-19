import parseMessage from '@/libs/MessageParser';

describe('MessageParser.js', () => {
    it('should return valid channel blocks', () => {
        let tests = [
            ['#channel', '#channel'],
            ['#channel;', '#channel'],
            ['#chan;nel', '#chan;nel'],
            ['#channel.', '#channel'],
            ['#chan;el;', '#chan;el'],
            ['#channel),', '#channel'],
            ['#chan(n)el,', '#chan(n)el'],
            ['#chan(n)el),', '#chan(n)el'],
            ['#chan(nel),', '#chan(nel)'],
            ['#chan[n]el,', '#chan[n]el'],
            ['#chan[n]el],', '#chan[n]el'],
            ['#chan[nel],', '#chan[nel]'],
            ['#channel.name,', '#channel.name'],
            ['#channel.name.,', '#channel.name'],
            ['#channel.,', '#channel'],
            ['#channel-name,', '#channel-name'],
            ['#channel_name,', '#channel_name'],
            ['#channel&name,', '#channel&name'],
            ['@#channel:', '#channel'],
            ['@&channel,', '&channel'],
            ['&@#channel,', '#channel'],
            ['&@&channel,', '&channel'],
        ];

        tests.forEach((c) => {
            let blocks = parseMessage(c[0]);
            let channelBlocks = blocks.filter((b) => b.type === 'channel');

            expect(channelBlocks.length).toStrictEqual(1);
            expect(channelBlocks[0].meta.channel).toStrictEqual(c[1]);
        });
    });

    it('should return valid url blocks', () => {
        let tests = [
            ['www.example.com', 'http://www.example.com'],
            ['http://example.com'],
            ['http://127.0.0.1'],
            ['http://example.com:8080'],
            ['http://127.0.0.1:8001'],
            ['http://example.com/test.html?test=foo#bar'],
            ['http://example.computer/some/path/test.html?test=foo#bar'],
            ['http://127.0.0.1/test.html?test=foo#bar'],
            ['https://www.example.com'],
            ['https://127.0.0.1/test.html?test=foo#bar'],
            ['http://2001:0000:1234:0000:0000:C1C0:ABCD:0876/'],
            ['http://[2001:db8:1f70::999:de8:7648:6e8]:100/'],
            ['ldap://[2001:db8::7]/c=GB?objectClass?one'],
            ['(http://example.com)', 'http://example.com', '(', ')'],
            ['test text http://example.com more testings', 'http://example.com'],
            ['test text [http://example.com] more testings', 'http://example.com'],
            ['test text "http://example.com" more testings', 'http://example.com'],
            ['test text (test test: http://example.com) more testings', 'http://example.com'],
            ['test text http://example.com#(test) more testings', 'http://example.com#(test)'],
            ['test (text http://example.com#(te)st) more testings', 'http://example.com#(te)st'],
            ['test (text http://example.com#(test)) more testings', 'http://example.com#(test)'],
        ];

        tests.forEach((c) => {
            let blocks = parseMessage(c[0]);
            let urlIndex = blocks.findIndex((b) => b.type === 'url');
            let urlBlocks = blocks.filter((b) => b.type === 'url');
            let compare = c.length >= 2 ? c[1] : c[0];

            expect(urlBlocks.length).toStrictEqual(1);
            expect(urlBlocks[0].meta.url).toStrictEqual(compare);
            // check prefix and suffix
            if (c.length >= 3) {
                expect(blocks[urlIndex - 1].content).toStrictEqual(c[2]);
            }
            if (c.length >= 4) {
                expect(blocks[urlIndex + 1].content).toStrictEqual(c[3]);
            }
        });
    });

    it('should reject invalid urls', () => {
        let tests = ['test', 'example.com', 'test:8080', '127.0.0.1/test.html'];

        tests.forEach((c) => {
            let blocks = parseMessage(c[0]);
            let urlBlocks = blocks.filter((b) => b.type === 'url');
            expect(urlBlocks.length).toStrictEqual(0);
        });
    });

    it('should return valid user blocks', () => {
        let createMockUser = (user) => ({
            nick: user.nick,
            username: user.username,
            colour: user.colour || '',
            getColour: function getColour() { return this.colour; },
        });

        // mock users list
        let users = {
            'TESTNICK1': createMockUser({ nick: 'TestNick1', username: 'testnick1', colour: '#a1fc5d' }),
            'TESTNICK2': createMockUser({ nick: 'TestNick2', username: 'testnick2', colour: '#7363fe' }),
            'TESTNICK3': createMockUser({ nick: 'TestNick3', username: 'testnick3' }),
            'TESTNICK4_': createMockUser({ nick: 'Test-Nick4_', username: 'testnick4' }),
            'TEST-NICK5': createMockUser({ nick: 'Test-Nick5', username: 'testnick5' }),
            'TESTNICK6-': createMockUser({ nick: 'TestNick6-', username: 'testnick6' }),
        };
        let tests = [
            ['testnick1', 'testnick1'],
            ['TestNick1'],
            ['TestNick2'],
            ['Testnick3', 'Testnick3'],
            ['testnick1:', 'testnick1'],
            ['@testnick2', 'testnick2'],
            ['@TestNick2:', 'TestNick2'],
            ['tEsTnIcK4_.', 'tEsTnIcK4_'],
            ['test-nick5'],
            ['testnick6-'],
        ];

        tests.forEach((c) => {
            let blocks = parseMessage(c[0], {}, users);
            let userBlocks = blocks.filter((b) => b.type === 'user');
            let compare = c.length === 2 ? c[1] : c[0];
            let user = users[compare.toUpperCase()];

            expect(userBlocks.length).toStrictEqual(1);
            expect(userBlocks[0].meta.user).toStrictEqual(compare);
            expect(userBlocks[0].meta.colour).toStrictEqual(user.getColour());
        });
    });

    it('should reject invalid users', () => {
        // mock users list
        let users = {
            TESTNICK1: { nick: 'TestNick1', username: 'testnick1' },
            TESTNICK2: { nick: 'TestNick2', username: 'testnick2' },
        };
        let tests = ['notauser', 'ttestnick', 'testnick11', 'ttestnick11'];

        tests.forEach((c) => {
            let blocks = parseMessage(c[0], {}, users);
            let userBlocks = blocks.filter((b) => b.type === 'user');

            expect(userBlocks.length).toStrictEqual(0);
        });
    });

    describe('formatting', () => {
        it('should return styled blocks for supported formatting', () => {
            const cases = [
                ['__underline__', true, ['underline'], '__underline__'],
                ['~~strike~~', true, ['strikethrough'], '~~strike~~'],
                ['\x1Estrike\x1E', false, ['strikethrough'], 'strike'],
                ['\x11mono\x11', false, ['monospace'], 'mono'],
                ['`code`', true, ['monospace'], '`code`'],
                ['**bold**', true, ['bold'], '**bold**'],
                ['*italic*', true, ['italic'], '*italic*'],
                ['_italic_', true, ['italic'], '_italic_'],
                ['***bolditalic***', true, ['bold', 'italic'], '***bolditalic***'],
                ['___underlineditalic___', true, ['underline', 'italic'], '___underlineditalic___'],
            ];

            cases.forEach(([text, extras, styles, content]) => {
                const blocks = parseMessage(text, extras ? { extras: true } : undefined);
                const matching = blocks.filter((block) => (
                    styles.every((style) => block.styles[style])
                ));

                expect(matching.length).toBeGreaterThanOrEqual(1);
                styles.forEach((style) => {
                    expect(matching[0].styles[style]).toStrictEqual(true);
                });
                expect(matching[0].content).toStrictEqual(content);
            });
        });

        it('should support mixed formatting', () => {
            let blocks = parseMessage('**bold** and __underline__', { extras: true });
            let bold = blocks.find((b) => b.content === '**bold**');
            let underline = blocks.find((b) => b.content === '__underline__');

            expect(bold.styles.bold).toStrictEqual(true);
            expect(underline.styles.underline).toStrictEqual(true);
        });

        it('should parse extended, combined, greedy, and hex colors', () => {
            let blocks = parseMessage('\x0316,52Colored Text');
            expect(blocks[0].styles.color).toStrictEqual('16');
            expect(blocks[0].styles.background).toStrictEqual('52');
            expect(blocks[0].content).toStrictEqual('Colored Text');

            blocks = parseMessage('\x0301,01Spoiler');
            expect(blocks[0].styles.color).toStrictEqual('black');
            expect(blocks[0].styles.background).toStrictEqual('black');
            expect(blocks[0].content).toStrictEqual('Spoiler');

            blocks = parseMessage('\x03033');
            expect(blocks[0].styles.color).toStrictEqual('green');
            expect(blocks[0].content).toStrictEqual('3');

            blocks = parseMessage('\x0333');
            expect(blocks[0].styles.color).toStrictEqual('33');

            blocks = parseMessage('\x04ff0000Red Text');
            expect(blocks[0].styles.color).toStrictEqual('#ff0000');
            expect(blocks[0].content).toStrictEqual('Red Text');

            blocks = parseMessage('\x04ff0000,00ff00Red on Green');
            expect(blocks[0].styles.color).toStrictEqual('#ff0000');
            expect(blocks[0].styles.background).toStrictEqual('#00ff00');
            expect(blocks[0].content).toStrictEqual('Red on Green');
        });

        it('should return spoiler blocks for ||text||', () => {
            let blocks = parseMessage('||spoiler||', { extras: true });
            let spoilerBlocks = blocks.filter((b) => b.styles.color === 'black' && b.styles.background === 'black');
            expect(spoilerBlocks.length).toBeGreaterThanOrEqual(1);
            expect(spoilerBlocks[0].styles.color).toStrictEqual('black');
            expect(spoilerBlocks[0].styles.background).toStrictEqual('black');
            expect(spoilerBlocks[0].content).toStrictEqual('||spoiler||');
        });

        it('should handle color resets', () => {
            let blocks = parseMessage('\x0303,01Green on Black\x0399,99Reset');
            expect(blocks[0].styles.color).toStrictEqual('green');
            expect(blocks[0].styles.background).toStrictEqual('black');
            expect(blocks[1].styles.color).toBeUndefined();
            expect(blocks[1].styles.background).toBeUndefined();

            blocks = parseMessage('\x0303,01Green on Black\x03Reset');
            expect(blocks[0].styles.color).toStrictEqual('green');
            expect(blocks[0].styles.background).toStrictEqual('black');
            expect(blocks[1].styles.color).toBeUndefined();
            expect(blocks[1].styles.background).toBeUndefined();

            blocks = parseMessage('\x04ff0000Red\x04Reset');
            expect(blocks[0].styles.color).toStrictEqual('#ff0000');
            expect(blocks[1].styles.color).toBeUndefined();

            blocks = parseMessage('\x0304Red\x0399123');
            expect(blocks[0].styles.color).toStrictEqual('light-red');
            expect(blocks[0].content).toStrictEqual('Red');
            expect(blocks[1].styles.color).toBeUndefined();
            expect(blocks[1].content).toStrictEqual('123');
        });

        it('should handle global resets and nested background clearing', () => {
            let blocks = parseMessage('\x02\x0303\x16Formatted\x0F Plain', { extras: true });
            expect(blocks[0].styles.bold).toStrictEqual(true);
            expect(blocks[0].styles.color).toStrictEqual('green');
            expect(blocks[0].styles.reverse).toStrictEqual(true);
            expect(blocks[0].content).toStrictEqual('Formatted');

            let lastBlock = blocks[blocks.length - 1];
            expect(lastBlock.content).toStrictEqual(' Plain');
            expect(Object.keys(lastBlock.styles).length).toStrictEqual(0);

            blocks = parseMessage('\x02bold \x0F plain', { extras: true });
            expect(blocks[0].styles.bold).toStrictEqual(true);
            expect(blocks[0].content).toStrictEqual('bold ');
            expect(blocks[1].styles.bold).toBeUndefined();
            expect(blocks[1].content).toStrictEqual(' plain');

            blocks = parseMessage('\x0304,02BG\x0304,99FG\x0fPlain');
            expect(blocks[0].styles.color).toStrictEqual('light-red');
            expect(blocks[0].styles.background).toStrictEqual('blue');
            expect(blocks[1].styles.color).toStrictEqual('light-red');
            expect(blocks[1].styles.background).toBeUndefined();
            expect(blocks[2].styles.color).toBeUndefined();
        });
    });
});
