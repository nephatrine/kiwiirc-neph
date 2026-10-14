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

    test('condense key matches for the same bridged user', () => {
        let first = botMessage('<Alice> one');
        let second = botMessage('<Alice> two');
        expect(second.condenseKey()).toBe(first.condenseKey());
    });

    test('condense key differs across bridged users on the same bot', () => {
        let first = botMessage('<Alice> one');
        let second = botMessage('<Mallory> two');
        expect(second.condenseKey()).not.toBe(first.condenseKey());
    });

    test('condense key differs between bridged and plain bot messages', () => {
        let bridged = botMessage('<Alice> one');
        let plain = botMessage('plain text');
        expect(plain.condenseKey()).not.toBe(bridged.condenseKey());
    });

    test('condense key still matches for plain messages from one nick', () => {
        let first = new Message({ nick: 'Bob', message: 'one', tags: {} }, null);
        let second = new Message({ nick: 'Bob', message: 'two', tags: {} }, null);
        expect(second.condenseKey()).toBe(first.condenseKey());
    });

    test('uses a valid +avatar tag as the per-message avatar', () => {
        let message = taggedMessage('<Alice> hello', {
            'bot': 'x',
            '+avatar': 'https://example.com/avatars/alice.png',
        });
        expect(message.bridged_avatar).toBe('https://example.com/avatars/alice.png');
    });

    test('rejects unsafe +avatar tag values', () => {
        let unsafeUrl = ['java', 'script:alert(1)'].join('');
        let message = taggedMessage('<Alice> hello', {
            'bot': 'x',
            '+avatar': unsafeUrl,
        });
        expect(message.bridged_avatar).toBe('');
    });

    test('ignores missing or empty +avatar tags', () => {
        expect(botMessage('<Alice> hello').bridged_avatar).toBe('');
        let message = taggedMessage('<Alice> hello', { 'bot': 'x', '+avatar': '' });
        expect(message.bridged_avatar).toBe('');
    });
});
