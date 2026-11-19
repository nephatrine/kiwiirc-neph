import Message from '@/libs/Message';

describe('bridged bot messages', () => {
    function botMessage(text) {
        return new Message({ nick: 'BridgeBot', message: text, tags: { bot: 'x' } }, null);
    }

    function taggedMessage(text, tags) {
        return new Message({ nick: 'BridgeBot', message: text, tags: tags }, null);
    }

    // \x03 (mIRC colour code) built without a literal control byte
    function colour() {
        return String.fromCharCode(3);
    }

    test('extracts the bridged nick and strips the prefix', () => {
        let message = botMessage('<Alice> hello there');
        expect(message.bridged_nick).toBe('Alice');
        expect(message.message).toBe('hello there');
        expect(message.nick).toBe('BridgeBot');
        expect(message.is_bot).toBe(true);
    });

    test('leaves non-bot messages with angle prefixes alone', () => {
        let message = new Message({ nick: 'Bob', message: '<Alice> hello', tags: {} }, null);
        expect(message.bridged_nick).toBe('');
        expect(message.message).toBe('<Alice> hello');
    });

    test('resolves +display-name cases', () => {
        let c = colour();
        const cases = [
            ['hello', 'Alice', 'Alice', 'hello'],
            ['<Alice> hello', 'Alice B', 'Alice B', 'hello'],
            ['hello', c + '04Alice' + c, 'Alice', 'hello'],
            ['<Alice> hello', '', 'Alice', 'hello'],
            ['<Alice> hello', c + '04' + c, 'Alice', 'hello'],
        ];

        cases.forEach(([text, displayName, expectedNick, expectedMessage]) => {
            const message = taggedMessage(text, {
                'bot': 'x',
                '+display-name': displayName,
            });
            expect(message.bridged_nick).toBe(expectedNick);
            expect(message.message).toBe(expectedMessage);
        });

        const nonBot = taggedMessage('<Alice> hello', {
            '+display-name': 'Mallory',
        });
        expect(nonBot.bridged_nick).toBe('');
        expect(nonBot.message).toBe('<Alice> hello');
    });

    test('leaves bot messages without a valid prefix alone', () => {
        let message = botMessage('hello world');
        expect(message.bridged_nick).toBe('');
        expect(message.message).toBe('hello world');
    });

    test('requires a trailing space after the bracket', () => {
        let message = botMessage('<Alice>hello');
        expect(message.bridged_nick).toBe('');
        expect(message.message).toBe('<Alice>hello');
    });

    test('does not treat emoticons as attribution', () => {
        let message = botMessage('<3 hello');
        expect(message.bridged_nick).toBe('');
        expect(message.message).toBe('<3 hello');
    });

    test('strips irc formatting from the bridged nick', () => {
        let c = colour();
        let message = botMessage('<' + c + '04Alice' + c + '> hello there');
        expect(message.bridged_nick).toBe('Alice');
        expect(message.message).toBe('hello there');
    });

    test('leaves brackets containing only formatting codes alone', () => {
        let c = colour();
        let text = '<' + c + '04> hello';
        let message = botMessage(text);
        expect(message.bridged_nick).toBe('');
        expect(message.message).toBe(text);
    });

    test('truncates long angle-prefix names but still removes the prefix', () => {
        let longName = 'A'.repeat(70);
        let message = botMessage('<' + longName + '> hello');
        expect(message.bridged_nick).toBe('A'.repeat(64));
        expect(message.message).toBe('hello');
    });

    test('truncates long +display-name values', () => {
        let longName = 'A'.repeat(70);
        let message = taggedMessage('hello', {
            'bot': 'x',
            '+display-name': longName,
        });
        expect(message.bridged_nick).toBe('A'.repeat(64));
    });

    test('condense keys group the same author and separate different ones', () => {
        const first = botMessage('<Alice> one');
        const second = botMessage('<Alice> two');
        const other = botMessage('<Mallory> two');
        const plainBot = botMessage('plain text');
        const plainFirst = new Message({ nick: 'Bob', message: 'one', tags: {} }, null);
        const plainSecond = new Message({ nick: 'Bob', message: 'two', tags: {} }, null);

        expect(second.condenseKey()).toBe(first.condenseKey());
        expect(other.condenseKey()).not.toBe(first.condenseKey());
        expect(plainBot.condenseKey()).not.toBe(first.condenseKey());
        expect(plainSecond.condenseKey()).toBe(plainFirst.condenseKey());
    });

    test('resolves +avatar cases', () => {
        const c = colour();
        const safeUrl = 'https://example.com/avatars/alice.png';

        expect(taggedMessage('<Alice> hello', {
            'bot': 'x',
            '+avatar': safeUrl,
        }).bridged_avatar).toBe(safeUrl);

        expect(taggedMessage('<Alice> hello', {
            'bot': 'x',
            '+avatar': c + '04' + safeUrl + c,
        }).bridged_avatar).toBe(safeUrl);

        expect(taggedMessage('<Alice> hello', {
            'bot': 'x',
            '+avatar': ['java', 'script:alert(1)'].join(''),
        }).bridged_avatar).toBe('');

        expect(taggedMessage('<Alice> hello', {
            '+avatar': safeUrl,
        }).bridged_avatar).toBe('');

        expect(botMessage('<Alice> hello').bridged_avatar).toBe('');
        expect(taggedMessage('<Alice> hello', { 'bot': 'x', '+avatar': '' })
            .bridged_avatar).toBe('');

        expect(taggedMessage('<Alice> hello', {
            'bot': 'x',
            '+avatar': c + '04' + c,
        }).bridged_avatar).toBe('');
    });

    test('uses +display-name and +avatar together', () => {
        let message = taggedMessage('hello', {
            'bot': 'x',
            '+display-name': 'Alice',
            '+avatar': 'https://example.com/avatars/alice.png',
        });
        expect(message.bridged_nick).toBe('Alice');
        expect(message.bridged_avatar).toBe('https://example.com/avatars/alice.png');
    });
});
