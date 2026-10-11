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
        it('should return underlined blocks for __text__', () => {
            let blocks = parseMessage('__underline__', { extras: true });
            // MessageFormatter may return an extra empty block at the end of a style range
            let underlinedBlocks = blocks.filter((b) => b.styles.underline);
            expect(underlinedBlocks.length).toBeGreaterThanOrEqual(1);
            expect(underlinedBlocks[0].styles.underline).toStrictEqual(true);
            expect(underlinedBlocks[0].content).toStrictEqual('__underline__');
        });

        it('should return strikethrough blocks for ~~text~~', () => {
            let blocks = parseMessage('~~strike~~', { extras: true });
            let strikeBlocks = blocks.filter((b) => b.styles.strikethrough);
            expect(strikeBlocks.length).toBeGreaterThanOrEqual(1);
            expect(strikeBlocks[0].styles.strikethrough).toStrictEqual(true);
            expect(strikeBlocks[0].content).toStrictEqual('~~strike~~');
        });

        it('should return strikethrough blocks for \x1Etext\x1E', () => {
            let blocks = parseMessage('\x1Estrike\x1E');
            let strikeBlocks = blocks.filter((b) => b.styles.strikethrough);
            expect(strikeBlocks.length).toBeGreaterThanOrEqual(1);
            expect(strikeBlocks[0].styles.strikethrough).toStrictEqual(true);
            expect(strikeBlocks[0].content).toStrictEqual('strike');
        });

        it('should return monospace blocks for \x11text\x11', () => {
            let blocks = parseMessage('\x11mono\x11');
            let monoBlocks = blocks.filter((b) => b.styles.monospace);
            expect(monoBlocks.length).toBeGreaterThanOrEqual(1);
            expect(monoBlocks[0].styles.monospace).toStrictEqual(true);
            expect(monoBlocks[0].content).toStrictEqual('mono');
        });

        it('should return monospace blocks for `text`', () => {
            let blocks = parseMessage('`code`', { extras: true });
            let monoBlocks = blocks.filter((b) => b.styles.monospace);
            expect(monoBlocks.length).toBeGreaterThanOrEqual(1);
            expect(monoBlocks[0].styles.monospace).toStrictEqual(true);
            expect(monoBlocks[0].content).toStrictEqual('`code`');
        });

        it('should return bold blocks for **text**', () => {
            let blocks = parseMessage('**bold**', { extras: true });
            let boldBlocks = blocks.filter((b) => b.styles.bold);
            expect(boldBlocks.length).toBeGreaterThanOrEqual(1);
            expect(boldBlocks[0].styles.bold).toStrictEqual(true);
            expect(boldBlocks[0].content).toStrictEqual('**bold**');
        });

        it('should return italic blocks for *text*', () => {
            let blocks = parseMessage('*italic*', { extras: true });
            let italicBlocks = blocks.filter((b) => b.styles.italic);
            expect(italicBlocks.length).toBeGreaterThanOrEqual(1);
            expect(italicBlocks[0].styles.italic).toStrictEqual(true);
            expect(italicBlocks[0].content).toStrictEqual('*italic*');
        });

        it('should return italic blocks for _text_', () => {
            let blocks = parseMessage('_italic_', { extras: true });
            let italicBlocks = blocks.filter((b) => b.styles.italic);
            expect(italicBlocks.length).toBeGreaterThanOrEqual(1);
            expect(italicBlocks[0].styles.italic).toStrictEqual(true);
            expect(italicBlocks[0].content).toStrictEqual('_italic_');
        });

        it('should return bold italic blocks for ***text***', () => {
            let blocks = parseMessage('***bolditalic***', { extras: true });
            let biBlocks = blocks.filter((b) => b.styles.bold && b.styles.italic);
            expect(biBlocks.length).toBeGreaterThanOrEqual(1);
            expect(biBlocks[0].styles.bold).toStrictEqual(true);
            expect(biBlocks[0].styles.italic).toStrictEqual(true);
            expect(biBlocks[0].content).toStrictEqual('***bolditalic***');
        });

        it('should return underlined italic blocks for ___text___', () => {
            let blocks = parseMessage('___underlineditalic___', { extras: true });
            let uiBlocks = blocks.filter((b) => b.styles.underline && b.styles.italic);
            expect(uiBlocks.length).toBeGreaterThanOrEqual(1);
            expect(uiBlocks[0].styles.underline).toStrictEqual(true);
            expect(uiBlocks[0].styles.italic).toStrictEqual(true);
            expect(uiBlocks[0].content).toStrictEqual('___underlineditalic___');
        });

        it('should support mixed formatting', () => {
            let blocks = parseMessage('**bold** and __underline__', { extras: true });
            let bold = blocks.find((b) => b.content === '**bold**');
            let underline = blocks.find((b) => b.content === '__underline__');

            expect(bold.styles.bold).toStrictEqual(true);
            expect(underline.styles.underline).toStrictEqual(true);
        });

        it('should handle extended color codes (16-98)', () => {
            let blocks = parseMessage('\x0316,52Colored Text');
            expect(blocks[0].styles.color).toStrictEqual('16');
            expect(blocks[0].styles.background).toStrictEqual('52');
            expect(blocks[0].content).toStrictEqual('Colored Text');
        });

        it('should handle color reset code (99)', () => {
            let blocks = parseMessage('\x0303,01Green on Black\x0399,99Reset');
            expect(blocks[0].styles.color).toStrictEqual('green');
            expect(blocks[0].styles.background).toStrictEqual('black');
            expect(blocks[1].styles.color).toBeUndefined();
            expect(blocks[1].styles.background).toBeUndefined();
        });

        it('should handle greedy two-digit color matching', () => {
            let blocks = parseMessage('\x03033');
            // \x0303 is green, followed by literal '3'
            expect(blocks[0].styles.color).toStrictEqual('green');
            expect(blocks[0].content).toStrictEqual('3');

            blocks = parseMessage('\x0333');
            // \x0333 is color 33
            expect(blocks[0].styles.color).toStrictEqual('33');
        });

        it('should return spoiler blocks for ||text||', () => {
            let blocks = parseMessage('||spoiler||', { extras: true });
            let spoilerBlocks = blocks.filter((b) => b.styles.color === 'black' && b.styles.background === 'black');
            expect(spoilerBlocks.length).toBeGreaterThanOrEqual(1);
            expect(spoilerBlocks[0].styles.color).toStrictEqual('black');
            expect(spoilerBlocks[0].styles.background).toStrictEqual('black');
            expect(spoilerBlocks[0].content).toStrictEqual('||spoiler||');
        });

        it('should return spoiler blocks for ||text||', () => {
            let blocks = parseMessage('||spoiler||', { extras: true });
            let spoilerBlocks = blocks.filter((b) => b.styles.color === 'black' && b.styles.background === 'black');
            expect(spoilerBlocks.length).toBeGreaterThanOrEqual(1);
            expect(spoilerBlocks[0].styles.color).toStrictEqual('black');
            expect(spoilerBlocks[0].styles.background).toStrictEqual('black');
            expect(spoilerBlocks[0].content).toStrictEqual('||spoiler||');
        });

        it('should handle color reset code (\x03)', () => {
            let blocks = parseMessage('\x0303,01Green on Black\x03Reset');
            expect(blocks[0].styles.color).toStrictEqual('green');
            expect(blocks[0].styles.background).toStrictEqual('black');
            expect(blocks[1].styles.color).toBeUndefined();
            expect(blocks[1].styles.background).toBeUndefined();
        });

        it('should handle combined foreground and background codes', () => {
            let blocks = parseMessage('\x0301,01Spoiler');
            expect(blocks[0].styles.color).toStrictEqual('black');
            expect(blocks[0].styles.background).toStrictEqual('black');
            expect(blocks[0].content).toStrictEqual('Spoiler');
        });

        it('should handle hex color codes (\x04)', () => {
            let blocks = parseMessage('\x04ff0000Red Text');
            expect(blocks[0].styles.color).toStrictEqual('#ff0000');
            expect(blocks[0].content).toStrictEqual('Red Text');

            blocks = parseMessage('\x04ff0000,00ff00Red on Green');
            expect(blocks[0].styles.color).toStrictEqual('#ff0000');
            expect(blocks[0].styles.background).toStrictEqual('#00ff00');
            expect(blocks[0].content).toStrictEqual('Red on Green');
        });

        it('should handle hex color reset code (\x04)', () => {
            let blocks = parseMessage('\x04ff0000Red\x04Reset');
            expect(blocks[0].styles.color).toStrictEqual('#ff0000');
            expect(blocks[1].styles.color).toBeUndefined();
        });

        it('should handle global reset code (\x0F)', () => {
            let blocks = parseMessage('\x02\x0303\x16Formatted\x0F Plain', { extras: true });
            // Block 0: Bold Green Fancy text
            expect(blocks[0].styles.bold).toStrictEqual(true);
            expect(blocks[0].styles.color).toStrictEqual('green');
            expect(blocks[0].styles.reverse).toStrictEqual(true);
            expect(blocks[0].content).toStrictEqual('Formatted');

            // Block 1: Reset applied, text should be plain
            let lastBlock = blocks[blocks.length - 1];
            expect(lastBlock.content).toStrictEqual(' Plain');
            expect(Object.keys(lastBlock.styles).length).toStrictEqual(0);
        });

        it('should handle global reset code (\x0F) clearing unclosed bold', () => {
            let blocks = parseMessage('\x02bold \x0F plain', { extras: true });
            // Block 0: bold
            expect(blocks[0].styles.bold).toStrictEqual(true);
            expect(blocks[0].content).toStrictEqual('bold ');

            // Block 1: plain
            expect(blocks[1].styles.bold).toBeUndefined();
            expect(blocks[1].content).toStrictEqual(' plain');
        });

        it('should handle nested background color clearing', () => {
            // This test simulates the output of buildIrcText for nested spans
            // Note: parseMessage is the receiver, but we can verify it parses correctly
            let blocks = parseMessage('\x0304,02BG\x0304,99FG\x0fPlain');
            expect(blocks[0].styles.color).toStrictEqual('light-red');
            expect(blocks[0].styles.background).toStrictEqual('blue');
            expect(blocks[1].styles.color).toStrictEqual('light-red');
            expect(blocks[1].styles.background).toBeUndefined();
            expect(blocks[2].styles.color).toBeUndefined();
        });

        it('should handle digit-safe color resets', () => {
            // \x0399 followed by a digit should be parsed as a reset
            let blocks = parseMessage('\x0304Red\x0399123');
            expect(blocks[0].styles.color).toStrictEqual('light-red');
            expect(blocks[0].content).toStrictEqual('Red');
            expect(blocks[1].styles.color).toBeUndefined();
            expect(blocks[1].content).toStrictEqual('123');
        });
    });
});
