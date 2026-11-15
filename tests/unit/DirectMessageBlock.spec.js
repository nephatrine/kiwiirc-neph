import state from '@/libs/state';

function makeNetwork() {
    const s = state.create();
    const network = s.addNetwork('TestNetwork', 'TestNick', {
        server: 'irc.example.com',
    });
    network.nick = 'TestNick';
    network.state = 'connected';
    return { s, network };
}

function incomingMessage(network, nick, message) {
    network.ircClient.command_handler.emit('privmsg', {
        nick,
        ident: nick.toLowerCase(),
        hostname: 'example.com',
        target: network.nick,
        message,
        tags: {},
        time: Date.now(),
    });
}

describe('direct message blocking', () => {
    let s;
    let network;

    beforeEach(() => {
        ({ s, network } = makeNetwork());
    });

    afterEach(() => {
        s.$destroy();
    });

    test('an ignored user cannot open a new query buffer', () => {
        network.setting('blockDirectMessages', 'allow');
        const alice = s.addUser(network.id, {
            nick: 'Alice',
            account: 'alice',
        });
        alice.ignore = true;

        incomingMessage(network, 'Alice', 'hello');

        expect(s.getBufferByName(network.id, 'Alice')).toBeFalsy();
    });

    test('an ignored user still reaches an existing query buffer', () => {
        network.setting('blockDirectMessages', 'allow');
        const alice = s.addUser(network.id, {
            nick: 'Alice',
            account: 'alice',
        });
        alice.ignore = true;
        const query = s.addBuffer(network.id, 'Alice');

        incomingMessage(network, 'Alice', 'hello');

        expect(query.getMessages()).toHaveLength(1);
        expect(query.getMessages()[0].message).toContain('hello');
    });

    test('Block policy blocks a known non-oper user', () => {
        network.setting('blockDirectMessages', 'block');
        const alice = s.addUser(network.id, { nick: 'Alice' });
        alice.hasWhois = true;

        incomingMessage(network, 'Alice', 'hello');

        expect(s.getBufferByName(network.id, 'Alice')).toBeFalsy();
    });

    test('Allow policy overrides the global block default', () => {
        s.setting('buffers.block_pms', true);
        network.setting('blockDirectMessages', 'allow');
        const alice = s.addUser(network.id, { nick: 'Alice' });
        alice.hasWhois = true;

        incomingMessage(network, 'Alice', 'hello');

        expect(s.getBufferByName(network.id, 'Alice')).toBeTruthy();
    });

    test('Friends Only blocks a new query until the sender is a friend', () => {
        network.setting('blockDirectMessages', 'friends');

        incomingMessage(network, 'Alice', 'hello');
        expect(s.getBufferByName(network.id, 'Alice')).toBeFalsy();

        s.addUser(network.id, { nick: 'Alice', account: 'alice' });
        network.setting('friends', [
            { nick: 'Alice', account: 'alice' },
        ]);
        incomingMessage(network, 'Alice', 'hello again');

        expect(s.getBufferByName(network.id, 'Alice')).toBeTruthy();
    });
});
