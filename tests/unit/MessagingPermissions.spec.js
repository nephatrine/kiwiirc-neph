import state from '@/libs/state';
import Message from '@/libs/Message';

function makeNetwork() {
    const s = state.create();
    const network = s.addNetwork('TestNetwork', 'TestNick', {
        server: 'irc.example.com',
    });
    network.nick = 'TestNick';
    network.state = 'connected';
    return { s, network };
}

describe('messaging permissions', () => {
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

    test('resolves the global default, per-network policy, and friends', () => {
        const { s, network } = fresh();

        s.setting('buffers.block_pms', false);
        expect(network.directMessagePolicy()).toBe('allow');

        s.setting('buffers.block_pms', true);
        expect(network.directMessagePolicy()).toBe('block');

        network.setting('blockDirectMessages', 'allow');
        expect(network.directMessagePolicy()).toBe('allow');

        network.setting('blockDirectMessages', 'friends');
        expect(network.directMessagePolicy()).toBe('friends');

        network.setting('friends', [
            { nick: 'Alice', account: 'alice' },
        ]);
        expect(network.isFriend({ nick: 'Alice', account: 'alice' })).toBe(true);
        expect(network.isFriend({ nick: 'Alice', account: 'other' })).toBe(false);
        expect(network.isFriend({ nick: 'Bob', account: '' })).toBe(false);
    });

    test('adds and removes ignore entries offline and account-first', () => {
        let ctx = fresh();
        let result = ctx.network.addIgnoredNick('Alice');
        expect(result.ok).toBe(true);
        expect(ctx.network.ignoredEntries()).toEqual([
            { nick: 'Alice', account: '' },
        ]);
        expect(ctx.network.isIgnoredNick('Alice')).toBe(true);
        expect(ctx.network.isIgnoredNick('alice')).toBe(true);

        ctx = fresh();
        const alice = ctx.s.addUser(ctx.network.id, {
            nick: 'Alice',
            account: 'alice',
        });
        expect(ctx.network.addIgnoredNick('Alice').ok).toBe(true);
        expect(alice.ignore).toBe(true);
        expect(ctx.network.ignoredEntries()).toEqual([
            { nick: 'Alice', account: 'alice' },
        ]);
        expect(ctx.network.removeIgnoredEntry({
            nick: 'Alice',
            account: 'alice',
        }).ok).toBe(true);
        expect(alice.ignore).toBe(false);
        expect(ctx.network.ignoredEntries()).toEqual([]);
    });

    test('matches identities account-first, applies to new users, and follows nicks', () => {
        let ctx = fresh();
        ctx.network.setting('ignoredUsers', [
            { nick: 'Alice', account: 'alice' },
        ]);
        expect(ctx.network.isIgnoredIdentity({
            nick: 'Alice',
            account: 'other',
        })).toBe(false);
        expect(ctx.network.isIgnoredIdentity({
            nick: 'Alicia',
            account: 'alice',
        })).toBe(true);

        ctx = fresh();
        ctx.network.setting('ignoredUsers', [
            { nick: 'Alice', account: '' },
        ]);
        const alice = ctx.s.addUser(ctx.network.id, {
            nick: 'Alice',
            account: 'alice',
        });
        expect(alice.ignore).toBe(true);
        expect(ctx.network.ignoredEntries()).toEqual([
            { nick: 'Alice', account: 'alice' },
        ]);

        ctx = fresh();
        ctx.s.addUser(ctx.network.id, { nick: 'Alice' });
        ctx.network.addIgnoredNick('Alice');
        ctx.s.changeUserNick(ctx.network.id, 'Alice', 'Alicia');
        expect(ctx.network.ignoredEntries()).toEqual([
            { nick: 'Alicia', account: '' },
        ]);
    });

    test('requires connected users on Soju metadata networks', () => {
        const { s, network } = fresh();
        network.ircd = 'soju';
        network.metadataCap = () => 'draft/metadata-3';
        network.setMetadata = jest.fn();

        expect(network.addIgnoredNick('Unknown')).toEqual({
            ok: false,
            reason: 'not-connected',
        });

        const alice = s.addUser(network.id, {
            nick: 'Alice',
            account: 'alice',
        });
        expect(network.addIgnoredNick('Alice').ok).toBe(true);
        expect(alice.ignore).toBe(true);
        expect(network.setMetadata).toHaveBeenCalledWith(
            'Alice',
            'soju.im/blocked',
            '1'
        );
        expect(network.ignoredEntries()).toEqual([
            { nick: 'Alice', account: 'alice', online: true },
        ]);

        expect(network.removeIgnoredEntry({
            nick: 'Alice',
            account: 'alice',
        }).ok).toBe(true);
        expect(alice.ignore).toBe(false);
        expect(network.setMetadata).toHaveBeenCalledWith(
            'Alice',
            'soju.im/blocked',
            '0'
        );
    });
});

describe('direct message blocking', () => {
    let created;

    function fresh() {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        network.nick = 'TestNick';
        network.state = 'connected';
        created.push(s);
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

describe('bot messages', () => {
    let created;

    beforeEach(() => {
        created = [];
    });

    afterEach(() => {
        created.forEach((s) => s.$destroy());
        created = [];
    });

    function makeBotNetwork() {
        const s = state.create();
        created.push(s);
        const network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        network.nick = 'TestNick';
        network.state = 'connected';
        const buffer = s.addBuffer(network.id, '#test');
        const user = s.addUser(network.id, { nick: 'BotUser' });
        user.metadata.bot = 'Sopel';
        return {
            s, network, buffer, user,
        };
    }

    function emitMessage(network, nick, target, message) {
        network.ircClient.command_handler.emit('privmsg', {
            nick,
            ident: nick.toLowerCase(),
            hostname: 'example.com',
            target,
            message,
            tags: {},
            time: Date.now(),
        });
    }

    test('marks metadata bots and resolves the bot-message policy', () => {
        const { s, network, user } = makeBotNetwork();
        const message = new Message({
            nick: 'BotUser',
            message: 'hello',
        }, user);

        expect(message.is_bot).toBe(true);

        expect(network.showBotMessages()).toBe(true);
        s.setting('showBotMessages', false);
        expect(network.showBotMessages()).toBe(false);

        network.setting('showBotMessages', 'yes');
        expect(network.showBotMessages()).toBe(true);
        network.setting('showBotMessages', 'no');
        expect(network.showBotMessages()).toBe(false);
    });

    test('filters metadata bots when bot messages are disabled', () => {
        const { network, buffer } = makeBotNetwork();
        network.setting('showBotMessages', 'no');

        emitMessage(network, 'BotUser', '#test', 'hidden');
        expect(buffer.getMessages()).toHaveLength(0);

        network.setting('showBotMessages', 'yes');
        emitMessage(network, 'BotUser', '#test', 'visible');
        expect(buffer.getMessages()).toHaveLength(1);
        expect(buffer.getMessages()[0].is_bot).toBe(true);
    });
});
