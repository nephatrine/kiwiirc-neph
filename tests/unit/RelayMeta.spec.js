import * as RelayMeta from '@/libs/RelayMeta';
import { MAX_ATTEMPTS, PUMP_MS, RESPONSE_TIMEOUT } from '@/libs/RelayMeta';
import { rememberUser } from '@/libs/MetadataCache';

jest.mock('@/libs/MetadataCache', () => ({ rememberUser: jest.fn() }));

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
    test('probes with CLIENTINFO then requests avatar and display-name', () => {
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
            'display-name'
        );
    });

    test('DATA applies display-name and avatar and is never re-requested', () => {
        let spoof = spoofUser();
        let net = makeNet({ [BOT]: botUser(), [SPOOF]: spoof });
        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS);
        advertise(net);
        jest.advanceTimersByTime(PUMP_MS);

        let consumed = RelayMeta.handleCtcp(net, net.id, {
            nick: BOT,
            type: 'RELAYMETA',
            message: 'DATA ' + SPOOF + ' display-name=Some\\sOne avatar=https://cdn.example/a.png',
        });
        expect(consumed).toBe(true);
        expect(spoof.metadata['display-name']).toBe('Some One');
        expect(spoof.metadata.avatar).toBe('https://cdn.example/a.png');
        expect(rememberUser).toHaveBeenCalledWith(net.raw, spoof);

        RelayMeta.noteRelay(net, net.id, BOT, SPOOF);
        jest.advanceTimersByTime(PUMP_MS + RESPONSE_TIMEOUT * MAX_ATTEMPTS + PUMP_MS);
        expect(net.ctcpRequest).toHaveBeenCalledTimes(2);
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
            message: 'ERR ' + SPOOF + ' UNKNOWN_TARGET no such user',
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
            message: 'DATA ' + SPOOF + ' display-name=A\\:\\\\sB',
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
