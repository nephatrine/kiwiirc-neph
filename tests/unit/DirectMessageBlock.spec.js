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
    let created;

    function fresh() {
        const ctx = makeNetwork();
        created.push(ctx.s);
        return ctx;
    }

    beforeEach(() => {
        created = [];
    });

    afterEach(() => {
        created.forEach((s) => s.$destroy());
        created = [];
    });

    test('an ignored user cannot open a query but still reaches an existing one', () => {
        const { s, network } = fresh();
        network.setting('blockDirectMessages', 'allow');
        const alice = s.addUser(network.id, {
            nick: 'Alice',
            account: 'alice',
        });
        alice.ignore = true;

        incomingMessage(network, 'Alice', 'hello');

        expect(s.getBufferByName(network.id, 'Alice')).toBeFalsy();

        const query = s.addBuffer(network.id, 'Alice');

        incomingMessage(network, 'Alice', 'hello again');

        expect(query.getMessages()).toHaveLength(1);
        expect(query.getMessages()[0].message).toContain('hello again');
    });

    test('Block policy blocks a known non-oper user unless Allow overrides it', () => {
        let ctx = fresh();
        ctx.network.setting('blockDirectMessages', 'block');
        const alice = ctx.s.addUser(ctx.network.id, { nick: 'Alice' });
        alice.hasWhois = true;

        incomingMessage(ctx.network, 'Alice', 'hello');

        expect(ctx.s.getBufferByName(ctx.network.id, 'Alice')).toBeFalsy();

        ctx = fresh();
        ctx.s.setting('buffers.block_pms', true);
        ctx.network.setting('blockDirectMessages', 'allow');
        const allowed = ctx.s.addUser(ctx.network.id, { nick: 'Alice' });
        allowed.hasWhois = true;

        incomingMessage(ctx.network, 'Alice', 'hello');

        expect(ctx.s.getBufferByName(ctx.network.id, 'Alice')).toBeTruthy();
    });

    test('Friends Only blocks a new query until the sender is a friend', () => {
        const { s, network } = fresh();
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
