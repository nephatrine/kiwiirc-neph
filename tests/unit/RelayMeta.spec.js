import Vue from 'vue';
import state from '@/libs/state';
import UserState from '@/libs/state/UserState';
import SidebarState from '@/components/SidebarState';
import * as RelayMeta from '@/libs/RelayMeta';
import { MAX_ATTEMPTS, PUMP_MS, RESPONSE_TIMEOUT } from '@/libs/RelayMeta';
import { rememberUser } from '@/libs/MetadataCache';

jest.mock('@/libs/MetadataCache', () => ({
    ...jest.requireActual('@/libs/MetadataCache'),
    rememberUser: jest.fn(),
}));

const BOT = 'DiscordBot';
const SPOOF = 'x2Tuff4Ux/bridged';

let netSeq = 0;

function makeNet(users) {
    netSeq += 1;
    let id = 'relaynet-' + netSeq;
    let store = {};
    Object.keys(users || {}).forEach((nick) => {
        store[String(nick).toUpperCase()] = users[nick];
    });
    let net = {
        id,
        raw: { id },
        userByNick: (nick) => store[String(nick).toUpperCase()] || null,
        ctcpRequest: jest.fn(),
    };
    net.addUser = (nick, user) => {
        store[String(nick).toUpperCase()] = user;
    };
    return net;
}

function botUser() {
    return { nick: BOT, metadata: {} };
}

function spoofUser() {
    return { nick: SPOOF, metadata: {} };
}

function advertise(timelyNet) {
    return RelayMeta.handleCtcp(timelyNet, timelyNet.id, {
        nick: BOT,
        type: 'CLIENTINFO',
        message: 'CLIENTINFO ACTION RELAYMETA VERSION',
    });
}

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
});

describe('relaymeta', () => {
    test('probes with CLIENTINFO then requests all relay metadata keys', () => {
        let net = makeNet({ [BOT]: botUser(), [SPOOF]: spoofUser() });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(1);
        expect(net.ctcpRequest).toHaveBeenCalledWith(BOT, 'CLIENTINFO');

        expect(advertise(net)).toBe(true);
        jest.advanceTimersByTime(PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledWith(
            BOT,
            'RELAYMETA',
            'GET',
            SPOOF,
            'avatar',
            'display-name',
            'bot',
            'color'
        );
    });

    test('DATA applies display-name, avatar, bot, and color and is never re-requested', () => {
        let spoof = spoofUser();
        let net = makeNet({ [BOT]: botUser(), [SPOOF]: spoof });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        advertise(net);
        jest.advanceTimersByTime(PUMP_MS);

        let consumed = RelayMeta.handleCtcp(net, net.id, {
            nick: BOT,
            type: 'RELAYMETA',
            message: 'RELAYMETA DATA ' + SPOOF +
                ' display-name=Some\\sOne avatar=https://cdn.example/a.png' +
                ' bot=Sopel\\s8.0 color=#FF00AA',
        });
        expect(consumed).toBe(true);
        expect(spoof.metadata['display-name']).toBe('Some One');
        expect(spoof.metadata.avatar).toBe('https://cdn.example/a.png');
        expect(spoof.metadata.bot).toBe('Sopel 8.0');
        expect(spoof.metadata.color).toBe('#ff00aa');
        expect(rememberUser).toHaveBeenCalledWith(net.raw, spoof);

        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS + RESPONSE_TIMEOUT * MAX_ATTEMPTS + PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(2);
    });

    test('ignores invalid relay color values', () => {
        let spoof = spoofUser();
        let net = makeNet({ [BOT]: botUser(), [SPOOF]: spoof });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        advertise(net);
        jest.advanceTimersByTime(PUMP_MS);

        RelayMeta.handleCtcp(net, net.id, {
            nick: BOT,
            type: 'RELAYMETA',
            message: 'RELAYMETA DATA ' + SPOOF + ' bot=Sopel color=red',
        });

        expect(spoof.metadata.bot).toBe('Sopel');
        expect(spoof.metadata.color).toBeUndefined();
    });

    test('strips control characters from relay bot and color values', () => {
        let spoof = spoofUser();
        let net = makeNet({ [BOT]: botUser(), [SPOOF]: spoof });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        advertise(net);
        jest.advanceTimersByTime(PUMP_MS);

        RelayMeta.handleCtcp(net, net.id, {
            nick: BOT,
            type: 'RELAYMETA',
            message: 'RELAYMETA DATA ' + SPOOF +
                ' bot=Sopel\x018.0 color=\x01#00FF00',
        });

        expect(spoof.metadata.bot).toBe('Sopel8.0');
        expect(spoof.metadata.color).toBe('#00ff00');
    });

    test('ERR marks the target done without further requests', () => {
        let net = makeNet({ [BOT]: botUser(), [SPOOF]: spoofUser() });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        advertise(net);
        jest.advanceTimersByTime(PUMP_MS);

        let consumed = RelayMeta.handleCtcp(net, net.id, {
            nick: BOT,
            type: 'RELAYMETA',
            message: 'RELAYMETA ERR ' + SPOOF + ' UNKNOWN_TARGET no such user',
        });
        expect(consumed).toBe(true);

        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS + RESPONSE_TIMEOUT * MAX_ATTEMPTS + PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(2);
    });

    test('a bot that never answers CLIENTINFO is marked unsupported', () => {
        let net = makeNet({ [BOT]: botUser(), [SPOOF]: spoofUser() });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(RESPONSE_TIMEOUT);
        jest.advanceTimersByTime(PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(RESPONSE_TIMEOUT);
        jest.advanceTimersByTime(PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(2);

        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS * 4);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(2);
    });

    test('unanswered GETs go blank after two attempts', () => {
        let net = makeNet({ [BOT]: botUser(), [SPOOF]: spoofUser() });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        advertise(net);
        jest.advanceTimersByTime(PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(RESPONSE_TIMEOUT);
        jest.advanceTimersByTime(PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(3);

        jest.advanceTimersByTime(RESPONSE_TIMEOUT);
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS * 4);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(3);
    });

    test('offline bots are parked until they come online', () => {
        let net = makeNet({ [SPOOF]: spoofUser() });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS + RESPONSE_TIMEOUT + PUMP_MS);
        expect(net.ctcpRequest).not.toHaveBeenCalled();

        net.addUser(BOT, botUser());
        RelayMeta.noteBotOnline(net, net.id, BOT);
        expect(net.ctcpRequest).toHaveBeenCalledWith(BOT, 'CLIENTINFO');
    });

    test('unescaped spaces drop the pair instead of truncating it', () => {
        let spoof = spoofUser();
        let net = makeNet({ [BOT]: botUser(), [SPOOF]: spoof });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        advertise(net);
        jest.advanceTimersByTime(PUMP_MS);

        let consumed = RelayMeta.handleCtcp(net, net.id, {
            nick: BOT,
            type: 'RELAYMETA',
            message: 'DATA ' + SPOOF + ' display-name=Some One avatar=https://cdn.example/a.png',
        });
        expect(consumed).toBe(true);
        expect(spoof.metadata['display-name']).toBeUndefined();
        expect(spoof.metadata.avatar).toBe('https://cdn.example/a.png');
        expect(rememberUser).toHaveBeenCalledWith(net.raw, spoof);
    });

    test('escapes unescape in order without manufacturing new ones', () => {
        let spoof = spoofUser();
        let net = makeNet({ [BOT]: botUser(), [SPOOF]: spoof });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        advertise(net);
        jest.advanceTimersByTime(PUMP_MS);

        RelayMeta.handleCtcp(net, net.id, {
            nick: BOT,
            type: 'RELAYMETA',
            message: 'RELAYMETA DATA ' + SPOOF + ' display-name=A\\:\\\\sB',
        });
        expect(spoof.metadata['display-name']).toBe('A;\\sB');
    });

    test('unrelated CLIENTINFO traffic is not consumed', () => {
        let net = makeNet({ [BOT]: botUser() });
        let consumed = RelayMeta.handleCtcp(net, net.id, {
            nick: BOT,
            type: 'CLIENTINFO',
            message: 'CLIENTINFO ACTION VERSION',
        });
        expect(consumed).toBe(false);
    });

    test('duplicate relay messages produce a single probe and GET', () => {
        let net = makeNet({ [BOT]: botUser(), [SPOOF]: spoofUser() });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(1);

        advertise(net);
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(2);
    });

    test('echoes of our own machine CTCPs are recognized', () => {
        let own = { nick: BOT, type: 'CLIENTINFO', message: '\x01CLIENTINFO\x01' };
        expect(RelayMeta.isOwnMachineCtcp('Me', own)).toBe(false);
        expect(RelayMeta.isOwnMachineCtcp('Me', {
            nick: 'Me',
            type: 'RELAYMETA',
            message: 'x',
        })).toBe(true);
        expect(RelayMeta.isOwnMachineCtcp('Me', {
            nick: 'Me',
            type: 'VERSION',
            message: 'x',
        })).toBe(false);
    });
});

describe('draft/relaymsg', () => {
    function makeSidebar(activeBuffer) {
        Vue.prototype.listen = () => {};
        Vue.prototype.$state = {
            setting: () => false,
            ui: { app_width: 1024 },
            getActiveBuffer: () => activeBuffer,
        };
        let sidebar = new SidebarState();
        sidebar.sidebarOpen = true;
        sidebar.sidebarSection = 'user';
        return sidebar;
    }

    function channelBuffer(hasNick) {
        return {
            id: 1,
            isQuery: () => false,
            isChannel: () => true,
            hasNick: () => hasNick,
        };
    }

    test('keeps the relayer nick on the spoofed user', () => {
        let user = new UserState(1, {
            nick: 'x2Tuff4Ux/bridged',
            relayed_by: 'DiscordBot',
        });
        expect(user.nick).toBe('x2Tuff4Ux/bridged');
        expect(user.relayed_by).toBe('DiscordBot');

        user = new UserState(1, { nick: 'Someone' });
        expect(user.relayed_by).toBe('');
    });

    test('keeps the user section while relaying and falls back to the nicklist', () => {
        let sidebar = makeSidebar(channelBuffer(false));
        sidebar.sidebarUser = { nick: 'x2Tuff4Ux/bridged', relayed_by: 'DiscordBot' };
        expect(sidebar.section()).toBe('user');
        expect(sidebar.sidebarSection).toBe('user');

        sidebar = makeSidebar(channelBuffer(false));
        sidebar.sidebarUser = { nick: 'Someone', relayed_by: '' };
        expect(sidebar.section()).toBe('nicklist');

        sidebar = makeSidebar(channelBuffer(true));
        sidebar.sidebarUser = { nick: 'Someone', relayed_by: '' };
        expect(sidebar.section()).toBe('user');
    });
});

describe('relayed nick tracking', () => {
    let s;
    let network;
    let buffer;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        buffer = s.addBuffer(network.id, '#channel');
    });

    afterEach(() => {
        s.$destroy();
    });

    test('records relayed authors per buffer and ignores ordinary ones', () => {
        s.addMessage(buffer, {
            time: Date.now(),
            nick: 'nephatrine/bridged',
            message: 'hello',
            tags: {
                'draft/relaymsg': 'DiscordBot',
            },
            type: 'privmsg',
        });

        expect(buffer.relayNicks['NEPHATRINE/BRIDGED'])
            .toBe('nephatrine/bridged');
        expect(Object.keys(buffer)).not.toContain('relayNicks');

        const exported = JSON.parse(s.exportState(true, false));
        const exportedBuffer = exported.networks[0].buffers.find((item) => (
            item.name === '#channel'
        ));
        expect(exportedBuffer.relayNicks).toBeUndefined();

        s.addMessage(buffer, {
            time: Date.now(),
            nick: 'ordinary',
            message: 'hello',
            tags: {},
            type: 'privmsg',
        });

        expect(buffer.relayNicks.ORDINARY).toBeUndefined();
        expect(buffer.relayNicks['NEPHATRINE/BRIDGED'])
            .toBe('nephatrine/bridged');
    });
});
