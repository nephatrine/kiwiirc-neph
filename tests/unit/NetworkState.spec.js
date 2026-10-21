import state from '@/libs/state';
import NetworkState from '@/libs/state/NetworkState';

describe('NetworkState', () => {
    it('should return a network state object', () => {
        let s = state.create();
        let network = s.addNetwork('TestNetwork', 'TestNick', {});
        expect(network).toBeInstanceOf(NetworkState);
        expect(network.name).toBe('TestNetwork');
        expect(network.connection.nick).toBe('TestNick');
        expect(network.appState).toBe(s);
    });

    it('should add a NetworkState to the global state', () => {
        let s = state.create();
        let network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.irc.com',
        });
        expect(s.networks.length).toEqual(1);
        expect(s.networks[0]).toEqual(network);
    });

    it('should retrieve a NetworkState from the global state', () => {
        let s = state.create();
        let network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.irc.com',
        });
        expect(s.getNetwork(network.id)).toEqual(network);
        expect(s.getNetworkFromAddress('irc.irc.com')).toEqual(network);
        expect(s.getNetworkFromAddress('definitely.not.irc.irc.com')).toEqual(undefined);
    });

    it('automatically has a server buffer', () => {
        let s = state.create();
        let network = s.addNetwork('TestNetwork', 'TestNick', {});
        expect(s.networks[0].buffers.length).toEqual(1);
        expect(s.networks[0].buffers[0]).toEqual(network.serverBuffer());
        expect(network.bufferByName('*')).toEqual(network.serverBuffer());
    });

    it('correctly adds buffers', () => {
        let s = state.create();
        let network = s.addNetwork('TestNetwork', 'TestNick', {});
        let buffer = s.addBuffer(network.id, '#channel');
        expect(s.networks[0].buffers.length).toEqual(2);
        expect(network.buffers.length).toEqual(2);
        expect(network.bufferByName('#channel')).toEqual(buffer);
    });

    it('correctly stores local network settings', () => {
        let s = state.create();
        let network = s.addNetwork('TestNetwork', 'TestNick', {});
        expect(network.setting('setting_key')).toEqual(undefined);

        network.setting('setting_key', 'some value');
        expect(network.setting('setting_key')).toEqual('some value');
    });

    it('reports the bouncer state for a bound network', () => {
        let s = state.create();
        let network = s.addNetwork('Bound', 'nick', {
            server: 'irc.example.com',
            bncnetid: '1',
        });
        network.state = 'connected';
        expect(network.bouncerState()).toBe('connected');

        // Our socket to the bouncer is up, but the upstream link is not.
        network.bnc_state = 'disconnected';
        expect(network.bouncerState()).toBe('disconnected');
        expect(network.state).toBe('connected');
    });

    it('keeps the transport state for plain and control connections', () => {
        let s = state.create();
        let plain = s.addNetwork('Plain', 'nick', {
            server: 'irc.example.com',
        });
        plain.state = 'connected';
        plain.bnc_state = 'disconnected';
        expect(plain.bouncerState()).toBe('connected');

        let control = s.addNetwork('BNC', 'nick', {
            server: 'bnc.example.com',
        });
        control.is_bnc = true;
        control.state = 'connected';
        control.bnc_state = 'disconnected';
        expect(control.bouncerState()).toBe('connected');
    });

    it('detects Twitch by host or capability', () => {
        let s = state.create();
        let twitch = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let other = s.addNetwork('Other', 'nick', {
            server: 'irc.example.com',
        });

        expect(twitch.isTwitch()).toBe(true);
        expect(other.isTwitch()).toBe(false);

        other.advertised_caps = ['twitch.tv/commands'];
        expect(other.isTwitch()).toBe(true);
    });

    it('gates Twitch replies on twitch.tv/tags', () => {
        let s = state.create();
        let twitch = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });

        expect(twitch.replyTagName()).toBe('');

        twitch.enabled_caps = ['twitch.tv/tags'];
        expect(twitch.replyTagName()).toBe('reply-parent-msg-id');
    });

    it('keeps normal IRC reply tags gated on message-tags', () => {
        let s = state.create();
        let network = s.addNetwork('Other', 'nick', {
            server: 'irc.example.com',
        });

        expect(network.replyTagName()).toBe('');

        network.enabled_caps = ['message-tags'];
        expect(network.replyTagName()).toBe('+reply');
    });

    it('uses the Twitch icon unless DRAFT/ICON is advertised', () => {
        let s = state.create();
        let twitch = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });

        expect(twitch.iconUrl).toBe('/static/twitch.svg');

        twitch.isupport['DRAFT/ICON'] = 'https://example.com/icon-{size}.png';
        expect(twitch.iconUrl).toBe('https://example.com/icon-64.png');
    });

    it('reports Twitch as the IRCd type', () => {
        let s = state.create();
        let twitch = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let other = s.addNetwork('Other', 'nick', {
            server: 'irc.example.com',
        });
        other.ircd = 'Ergo-2.14.0';

        expect(twitch.ircdType).toBe('Twitch');
        expect(other.ircdType).toBe('Ergo-2.14.0');
    });

    it('does not request a channel list on Twitch', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        network.ircClient.raw = jest.fn();
        network.connected_at = Date.now() - 60000;

        network.maybeUpdateChannelList(true);

        expect(network.ircClient.raw).not.toHaveBeenCalled();
        expect(network.channel_list_state).toBe('unsupported');
    });

    it('maps Twitch user tags to metadata and user-id lookup', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        s.addUser(network.id, { nick: 'Alice' });
        let user = s.getUser(network.id, 'Alice');

        network.applyTwitchUserTags(user, {
            'user-id': '1234',
            'display-name': 'AliceDisplay',
            'color': '#ff00aa',
            'badges': 'subscriber/1',
            'emote-sets': '0,1',
            'turbo': '0',
        });

        expect(network.userByTwitchId('1234')).toBe(user);
        expect(user.metadata['display-name']).toBe('AliceDisplay');
        expect(user.metadata.color).toBe('#ff00aa');
        expect(user.metadata.badges).toBeUndefined();
        expect(user.metadata['emote-sets']).toBeUndefined();
        expect(user.metadata.turbo).toBeUndefined();
    });

    it('creates a user for unknown Twitch senders', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });

        let user = network.ensureTwitchUser(
            'pigeon',
            'pigeon',
            'pigeon.tmi.twitch.tv',
            {
                'user-id': '136317432',
                'display-name': 'pigeonGuidedMissile',
                'color': '#62ff00',
            }
        );

        expect(network.userByName('pigeon')).toBe(user);
        expect(user.username).toBe('pigeon');
        expect(user.host).toBe('pigeon.tmi.twitch.tv');
        expect(user.metadata['display-name']).toBe('pigeonGuidedMissile');
        expect(user.metadata.color).toBe('#62ff00');
        expect(network.userByTwitchId('136317432')).toBe(user);

        let again = network.ensureTwitchUser(
            'pigeon',
            'pigeon',
            'pigeon.tmi.twitch.tv',
            {
                'user-id': '136317432',
                'display-name': 'pigeonUpdated',
                'color': '#ff00aa',
            }
        );
        expect(again).toBe(user);
        expect(user.metadata['display-name']).toBe('pigeonUpdated');
        expect(user.metadata.color).toBe('#ff00aa');

        let buffer = s.addBuffer(network.id, '#channel');
        let message = s.addMessage(buffer, {
            nick: 'pigeon',
            message: 'hello',
            type: 'privmsg',
        });
        expect(message.user).toBe(user);
    });

    it('stores display-only Twitch modes per buffer', () => {
        let s = state.create();
        let network = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        let buffer = s.addBuffer(network.id, '#channel');
        let user = network.ensureTwitchUser('alice', 'alice', 'alice.tmi.twitch.tv', {});

        network.applyTwitchUserModes(buffer, user, {
            mod: '1',
            subscriber: '1',
        });

        expect(user.buffers[buffer.id].twitch_modes).toEqual(['o', 'v']);
        expect(user.buffers[buffer.id].modes).toEqual([]);
        expect(buffer.users[user.nick]).toBeUndefined();

        network.applyTwitchUserModes(buffer, user, { mod: '0' });
        expect(user.buffers[buffer.id].twitch_modes).toEqual([]);
        expect(user.buffers[buffer.id].modes).toEqual([]);
    });
});
