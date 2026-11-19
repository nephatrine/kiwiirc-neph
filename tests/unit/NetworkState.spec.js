import Vue from 'vue';
import state from '@/libs/state';
import NetworkState from '@/libs/state/NetworkState';
import StatePersistence from '@/libs/StatePersistence';

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

    it('uses built-in icons and prefers DRAFT/ICON', () => {
        let s = state.create();
        let twitch = s.addNetwork('Twitch', 'nick', {
            server: 'irc.chat.twitch.tv',
        });
        expect(twitch.iconUrl).toBe('/static/twitch.svg');
        twitch.isupport['DRAFT/ICON'] = 'https://example.com/icon-{size}.png';
        expect(twitch.iconUrl).toBe('https://example.com/icon-64.png');

        let libera = s.addNetwork('Libera.Chat', 'nick', {
            server: 'irc.libera.chat',
        });
        expect(libera.iconUrl).toBe('/static/libera.svg');
        libera.isupport['DRAFT/ICON'] = 'https://example.com/icon-{size}.png';
        expect(libera.iconUrl).toBe('https://example.com/icon-64.png');

        let renamed = s.addNetwork('Work', 'nick', {
            server: 'irc.example.com',
        });
        renamed.isupport.NETWORK = 'Libera.Chat';
        expect(renamed.iconUrl).toBe('/static/libera.svg');

        let rekt = s.addNetwork('Work', 'nick', {
            server: 'irc.example.com',
        });
        rekt.isupport.NETWORK = 'RektNetwork';
        expect(rekt.iconUrl).toBe('/static/nightride.webp');

        let oftc = s.addNetwork('Work', 'nick', {
            server: 'irc.example.com',
        });
        oftc.isupport.NETWORK = 'OFTC';
        expect(oftc.supports('NETWORK')).toBe('OFTC');
        expect(oftc.iconUrl).toBe('/static/oftc.svg');
        oftc.isupport['DRAFT/ICON'] = 'https://example.com/icon-{size}.png';
        expect(oftc.iconUrl).toBe('https://example.com/icon-64.png');
    });

    it('lets a valid user icon override fallbacks and ignores invalid ones', () => {
        let s = state.create();
        let network = s.addNetwork('Libera.Chat', 'nick', {
            server: 'irc.libera.chat',
        });

        network.isupport['DRAFT/ICON'] = 'https://example.com/icon-{size}.png';
        network.setting('network_icon_url', 'https://example.com/custom.png');
        expect(network.iconUrl).toBe('https://example.com/custom.png');

        network.setting('network_icon_url', 'kiwi-icon://network-icon/custom.png');
        expect(network.iconUrl).toBe('kiwi-icon://network-icon/custom.png');

        delete network.isupport['DRAFT/ICON'];
        network.setting('network_icon_url', 'data:image/png;base64,AAAA');
        expect(network.iconUrl).toBe('/static/libera.svg');
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

    it('parses advertised ISUPPORT limits', () => {
        let s = state.create();
        let network = s.addNetwork('TestNetwork', 'nick', {});

        network.isupport.NICKLEN = '30';
        network.isupport.TOPICLEN = '390';
        network.isupport.AWAYLEN = true;
        network.isupport.KICKLEN = '';

        expect(network.isupportLimit('NICKLEN')).toBe(30);
        expect(network.isupportLimit('TOPICLEN')).toBe(390);
        expect(network.isupportLimit('AWAYLEN')).toBe(0);
        expect(network.isupportLimit('KICKLEN')).toBe(0);
        expect(network.isupportLimit('CHANNELLEN')).toBe(0);
    });
});

describe('Network ordering', () => {
    function makeNetworks() {
        const s = state.create();
        s.settings.startupOptions = {};
        const first = s.addNetwork('First', 'FirstNick', {});
        const second = s.addNetwork('Second', 'SecondNick', {});
        const third = s.addNetwork('Third', 'ThirdNick', {});
        return {
            s, first, second, third,
        };
    }

    it('moves networks up and down and rejects out-of-range moves', () => {
        let {
            s, first, second, third,
        } = makeNetworks();
        s.setActiveBuffer(third.id, '*');

        expect(s.moveNetworkUp(third.id)).toBe(true);

        expect(s.networks.map((network) => network.name)).toEqual([
            'First',
            'Third',
            'Second',
        ]);
        expect(s.ui.active_network).toBe(third.id);
        expect(s.moveNetworkUp(first.id)).toBe(false);

        ({ s, first, second, third } = makeNetworks());

        expect(s.moveNetwork(first.id, 1)).toBe(true);
        expect(s.networks.map((network) => network.name)).toEqual([
            'Second',
            'First',
            'Third',
        ]);
        expect(s.moveNetwork(third.id, 1)).toBe(false);
        expect(s.moveNetwork(second.id, -1)).toBe(false);
    });

    it('persists the reordered list directly and through the watcher', async() => {
        let { s, third } = makeNetworks();
        s.moveNetworkUp(third.id);
        let storage = {
            get: jest.fn(),
            set: jest.fn(async() => {}),
        };
        let persistence = new StatePersistence('test-key', s, storage);

        await persistence.saveStateNow();

        let saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks.map((network) => network.name)).toEqual([
            'First',
            'Third',
            'Second',
        ]);

        jest.useFakeTimers();
        ({ s, third } = makeNetworks());
        storage = {
            get: jest.fn(),
            set: jest.fn(async() => {}),
        };
        persistence = new StatePersistence('test-key', s, storage);
        persistence.watchStateForChanges();

        s.moveNetworkUp(third.id);
        await Vue.nextTick();
        jest.advanceTimersByTime(1000);

        expect(storage.set).toHaveBeenCalledTimes(1);
        saved = JSON.parse(storage.set.mock.calls[0][1]);
        expect(saved.networks.map((network) => network.name)).toEqual([
            'First',
            'Third',
            'Second',
        ]);

        persistence.stopWatchingState();
        jest.useRealTimers();
    });
});

describe('network.isService', () => {
    let s;
    let network;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
    });

    it('recognises common network services case-insensitively', () => {
        [
            'NickServ', 'ChanServ', 'MemoServ', 'HostServ',
            'OperServ', 'BotServ', 'RootServ', 'HelpServ',
            'StatServ', 'HistServ',
        ].forEach((service) => {
            expect(network.isService(service)).toBe(true);
        });

        expect(network.isService('HISTserv')).toBe(true);
        expect(network.isService('histserv')).toBe(true);
    });

    it('rejects regular nicks and honours network-specific services', () => {
        expect(network.isService('SomeUser')).toBe(false);
        expect(network.isService('')).toBe(false);
        expect(network.isService(null)).toBe(false);
        expect(network.isService(undefined)).toBe(false);

        network.services = ['CustomServ'];
        expect(network.isService('customserv')).toBe(true);
        expect(network.isService('SomeUser')).toBe(false);
    });
});

describe('IRC casemapping', () => {
    let s;
    let network;

    beforeEach(() => {
        s = state();
        s.resetState();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.net',
        });
        const client = network.ircClient;
        expect(client).toBeTruthy();
    });

    afterEach(() => {
        s.resetState();
    });

    test('uses rfc1459 casemapping for users, buffers, and channel members', () => {
        const user = s.addUser(network.id, { nick: '[User]' });
        const sameUser = s.addUser(network.id, { nick: '{User}' });

        expect(sameUser).toBe(user);
        expect(s.getUser(network.id, '{User}')).toBe(user);

        const buffer = s.addBuffer(network.id, '#[Test]');
        expect(s.getBufferByName(network.id, '#{Test}')).toBe(buffer);

        const channel = s.addBuffer(network.id, '#test');
        s.addUserToBuffer(channel, { nick: '[User]' });

        expect(channel.hasNick('{User}')).toBe(true);
    });

    test('respects ascii casemapping when advertised', () => {
        network.frameworkClient.network.options.CASEMAPPING = 'ascii';

        const first = s.addUser(network.id, { nick: '[User]' });
        const second = s.addUser(network.id, { nick: '{User}' });

        expect(second).not.toBe(first);
        expect(s.getUser(network.id, '{User}')).toBe(second);
    });
});
