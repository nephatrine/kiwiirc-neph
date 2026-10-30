import state from '@/libs/state';

describe('multiline notice formatting', () => {
    let s;
    let network;
    let buffer;
    let client;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.state = 'connected';
        network.nick = 'TestNick';
        buffer = s.addBuffer(network.id, '#test');
        client = network.ircClient;
        client.user.nick = 'TestNick';
    });

    function dispatch(event) {
        client.parsed_middleware.handle(['message', event, client], (err) => {
            if (err) {
                throw err;
            }
        });
    }

    function lastMessage() {
        let messages = buffer.getMessages();
        return messages[messages.length - 1];
    }

    it('prefixes every logical line of a multiline notice', () => {
        dispatch({
            type: 'notice',
            nick: 'Other',
            target: '#test',
            message: 'Line one\nLine two',
            time: Date.now(),
            tags: {},
        });

        expect(lastMessage().message).toBe('[NOTICE] Line one\n[NOTICE] Line two');
    });

    it('prefixes only logical lines when chunks are concatenated', () => {
        dispatch({
            type: 'notice',
            nick: 'Other',
            target: '#test',
            message: 'Part 1 continued\nPart 2',
            time: Date.now(),
            tags: {},
        });

        expect(lastMessage().message).toBe('[NOTICE] Part 1 continued\n[NOTICE] Part 2');
    });

    it('keeps a single-line notice unchanged', () => {
        dispatch({
            type: 'notice',
            nick: 'Other',
            target: '#test',
            message: 'hello',
            time: Date.now(),
            tags: {},
        });

        expect(lastMessage().message).toBe('[NOTICE] hello');
    });

    it('does not prefix a multiline privmsg', () => {
        dispatch({
            type: 'privmsg',
            nick: 'Other',
            target: '#test',
            message: 'Line one\nLine two',
            time: Date.now(),
            tags: {},
        });

        expect(lastMessage().message).toBe('Line one\nLine two');
    });
});
