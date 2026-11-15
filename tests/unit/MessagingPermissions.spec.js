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
    let s;
    let network;

    beforeEach(() => {
        ({ s, network } = makeNetwork());
    });

    afterEach(() => {
        s.$destroy();
    });

    test('resolves the global default and per-network policy', () => {
        s.setting('buffers.block_pms', false);
        expect(network.directMessagePolicy()).toBe('allow');

        s.setting('buffers.block_pms', true);
        expect(network.directMessagePolicy()).toBe('block');

        network.setting('blockDirectMessages', 'allow');
        expect(network.directMessagePolicy()).toBe('allow');

        network.setting('blockDirectMessages', 'friends');
        expect(network.directMessagePolicy()).toBe('friends');
    });

    test('matches friends by account before nickname', () => {
        network.setting('friends', [
            { nick: 'Alice', account: 'alice' },
        ]);

        expect(network.isFriend({ nick: 'Alice', account: 'alice' })).toBe(true);
        expect(network.isFriend({ nick: 'Alice', account: 'other' })).toBe(false);
        expect(network.isFriend({ nick: 'Bob', account: '' })).toBe(false);
    });

    test('adds an offline nickname to the local ignore list', () => {
        const result = network.addIgnoredNick('Alice');

        expect(result.ok).toBe(true);
        expect(network.ignoredEntries()).toEqual([
            { nick: 'Alice', account: '' },
        ]);
        expect(network.isIgnoredNick('Alice')).toBe(true);
        expect(network.isIgnoredNick('alice')).toBe(true);
    });

    test('adds and removes a known account-first entry', () => {
        const alice = s.addUser(network.id, {
            nick: 'Alice',
            account: 'alice',
        });

        expect(network.addIgnoredNick('Alice').ok).toBe(true);
        expect(alice.ignore).toBe(true);
        expect(network.ignoredEntries()).toEqual([
            { nick: 'Alice', account: 'alice' },
        ]);

        expect(network.removeIgnoredEntry({
            nick: 'Alice',
            account: 'alice',
        }).ok).toBe(true);
        expect(alice.ignore).toBe(false);
        expect(network.ignoredEntries()).toEqual([]);
    });

    test('does not match the same nick on a different account', () => {
        network.setting('ignoredUsers', [
            { nick: 'Alice', account: 'alice' },
        ]);

        expect(network.isIgnoredIdentity({
            nick: 'Alice',
            account: 'other',
        })).toBe(false);
        expect(network.isIgnoredIdentity({
            nick: 'Alicia',
            account: 'alice',
        })).toBe(true);
    });

    test('applies the local ignore list to new users', () => {
        network.setting('ignoredUsers', [
            { nick: 'Alice', account: '' },
        ]);

        const alice = s.addUser(network.id, {
            nick: 'Alice',
            account: 'alice',
        });

        expect(alice.ignore).toBe(true);
        expect(network.ignoredEntries()).toEqual([
            { nick: 'Alice', account: 'alice' },
        ]);
    });

    test('updates stored nicknames when a user changes nick', () => {
        s.addUser(network.id, { nick: 'Alice' });
        network.addIgnoredNick('Alice');

        s.changeUserNick(network.id, 'Alice', 'Alicia');

        expect(network.ignoredEntries()).toEqual([
            { nick: 'Alicia', account: '' },
        ]);
    });

    test('requires connected users on Soju metadata networks', () => {
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
