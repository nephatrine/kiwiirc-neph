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
