import state from '@/libs/state';

describe('raw buffer scrollback', () => {
    let s;
    let network;
    let raw;
    let channel;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        raw = s.addBuffer(network.id, '*raw');
        channel = s.addBuffer(network.id, '#chan');
    });

    it('defaults the raw buffer to 500 lines', () => {
        expect(raw.setting('scrollback_size')).toBe(500);
    });

    it('uses the network raw_scrollback_size for the raw buffer', () => {
        network.setting('raw_scrollback_size', 5000);
        expect(raw.setting('scrollback_size')).toBe(5000);
    });

    it('prefers a per-buffer override over the network value', () => {
        network.setting('raw_scrollback_size', 5000);
        raw.setting('scrollback_size', 100);
        expect(raw.setting('scrollback_size')).toBe(100);
    });

    it('does not apply the network value to normal buffers', () => {
        network.setting('raw_scrollback_size', 5000);
        expect(channel.setting('scrollback_size')).toBe(s.setting('buffers.scrollback_size'));
    });
});

describe('user prefixes', () => {
    it('shows fixed Twitch prefixes without marking the user as an op', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        network.isupport.PREFIX = [
            { symbol: '@', mode: 'o' },
            { symbol: '+', mode: 'v' },
        ];
        let buffer = s.addBuffer(network.id, '#alice');
        let user = network.ensureTwitchUser('alice', 'alice', 'alice.tmi.twitch.tv', {});

        network.applyTwitchUserModes(buffer, user, { vip: '1' });

        expect(buffer.userPrefixes()).toEqual([
            { symbol: '~', mode: 'q' },
            { symbol: '@', mode: 'o' },
            { symbol: '%', mode: 'h' },
            { symbol: '+', mode: 'v' },
        ]);
        expect(buffer.userModePrefix(user)).toBe('~%');
        expect(buffer.userMode(user)).toBe('q');
        expect(buffer.isUserAnOp('alice')).toBe(false);
        expect(buffer.users[user.nick]).toBeUndefined();
    });

    it('marks a Twitch channel owner as founder when they join without NAMES', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let buffer = s.addBuffer(network.id, '#alice');

        s.addUserToBuffer(buffer, {
            nick: 'alice',
            username: 'alice',
            host: 'alice.tmi.twitch.tv',
        });

        let user = s.getUser(network.id, 'alice');
        expect(buffer.userModes(user)).toEqual(['q']);
        expect(buffer.userModePrefix(user)).toBe('~');
        expect(buffer.userMode(user)).toBe('q');
        expect(buffer.isUserAnOp('alice')).toBe(false);
        expect(buffer.users.ALICE).toBe(user);
    });

    it('does not mark regular Twitch chatters as founders', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let buffer = s.addBuffer(network.id, '#alice');

        s.addUserToBuffer(buffer, {
            nick: 'bob',
            username: 'bob',
            host: 'bob.tmi.twitch.tv',
        });

        let user = s.getUser(network.id, 'bob');
        expect(buffer.userModes(user)).toEqual([]);
        expect(buffer.userModePrefix(user)).toBe('');
    });

    it('does not apply the Twitch founder prefix on other networks', () => {
        let s = state.create();
        let network = s.addNetwork('Test', 'nick', {
            server: 'irc.example.com',
        });
        let buffer = s.addBuffer(network.id, '#alice');

        s.addUserToBuffer(buffer, {
            nick: 'alice',
            username: 'alice',
            host: 'example.com',
        });

        let user = s.getUser(network.id, 'alice');
        expect(buffer.userModes(user)).toEqual([]);
        expect(buffer.userModePrefix(user)).toBe('');
    });

    it('keeps normal network prefixes unchanged', () => {
        let s = state.create();
        let network = s.addNetwork('Test', 'nick', {
            server: 'irc.example.com',
        });
        network.isupport.PREFIX = [{ symbol: '@', mode: 'o' }];
        let buffer = s.addBuffer(network.id, '#chan');
        s.addUser(network.id, { nick: 'bob' });
        let user = s.getUser(network.id, 'bob');
        user.buffers[buffer.id] = {
            modes: ['o'],
            buffer,
        };

        expect(buffer.userPrefixes()).toEqual([{ symbol: '@', mode: 'o' }]);
        expect(buffer.userModePrefix(user)).toBe('@');
        expect(buffer.userMode(user)).toBe('o');
        expect(buffer.isUserAnOp('bob')).toBe(true);
    });
});

describe('channel topics', () => {
    it('defaults a Twitch channel topic to its channel link', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let channel = s.addBuffer(network.id, '#theprimeagen');

        expect(channel.topic).toBe('https://twitch.tv/theprimeagen');
    });

    it('prefers a real Twitch topic over the channel link', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let channel = s.addBuffer(network.id, '#theprimeagen');
        channel.topic = 'A real topic';

        expect(channel.topic).toBe('A real topic');
    });

    it('does not add a default topic on other networks', () => {
        let s = state.create();
        let network = s.addNetwork('Test', 'nick', {
            server: 'irc.example.com',
        });
        let channel = s.addBuffer(network.id, '#chan');

        expect(channel.topic).toBe('');
    });

    it('does not add a default topic to Twitch queries', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let query = s.addBuffer(network.id, 'theprimeagen');

        expect(query.topic).toBe('');
    });
});

describe('query user status', () => {
    it('does not WHO a query partner on Twitch', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let query = s.addBuffer(network.id, 'alice');
        network.ircClient.who = jest.fn();

        query.initUserStatus();

        expect(network.ircClient.who).not.toHaveBeenCalled();
    });

    it('WHO a query partner on a normal network', () => {
        let s = state.create();
        let network = s.addNetwork('Test', 'nick', {
            server: 'irc.example.com',
        });
        let query = s.addBuffer(network.id, 'alice');
        network.ircClient.who = jest.fn();

        query.initUserStatus();

        expect(network.ircClient.who).toHaveBeenCalledWith('alice');
    });
});
