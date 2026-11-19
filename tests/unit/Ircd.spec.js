import state from '@/libs/state';
import isupportMiddleware, { parseIsupportTokens } from '@/libs/IsupportMiddleware';
import NetworkState from '@/libs/state/NetworkState';
import * as IrcdDiffs from '@/helpers/IrcdDiffs';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key) => key),
    };
});

const GATE_TOKEN = 'kiwi-isupport-wait';

function driveRawLine(client, command, params) {
    return new Promise((resolve, reject) => {
        client.raw_middleware.handle(
            [command, { command, params, tags: {} }, '', client],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}

function ackCaps(client, caps) {
    return driveRawLine(client, 'CAP', ['*', 'ACK', caps.join(' ')]);
}

function nakCaps(client, caps) {
    return driveRawLine(client, 'CAP', ['*', 'NAK', caps.join(' ')]);
}

function rawCalls(rawSpy, command) {
    return rawSpy.mock.calls.filter((call) => call[0] === command);
}

describe('draft/extended-isupport gate', () => {
    let s;
    let network;
    let rawSpy;

    beforeEach(() => {
        jest.useFakeTimers();
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        // Touching ircClient builds the framework client and middleware
        const client = network.ircClient;
        expect(client).toBeTruthy();

        network.state = 'connecting';
        network.password = '';
        client.network.cap.requested = [];
        client.network.cap.negotiating = false;
        rawSpy = jest.spyOn(client, 'raw').mockImplementation(() => {});
    });

    afterEach(() => {
        rawSpy.mockRestore();
        jest.useRealTimers();
    });

    it('requests draft/extended-isupport during negotiation', () => {
        const caps = network.ircClient.request_extra_caps || [];
        expect(caps).toContain('draft/extended-isupport');
        expect(caps).not.toContain('extended-isupport');
    });

    it('holds negotiation open and asks for ISUPPORT on ACK', async() => {
        const client = network.ircClient;
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/extended-isupport']);

        expect(rawCalls(rawSpy, 'ISUPPORT')).toHaveLength(1);
        expect(client.network.cap.requested).toContain(GATE_TOKEN);
        expect(rawCalls(rawSpy, 'CAP').filter((call) => call[1] === 'END')).toHaveLength(0);
    });

    it('ignores a NAK of the cap and lets the framework end negotiation', async() => {
        const client = network.ircClient;
        client.network.cap.negotiating = true;
        await nakCaps(client, ['draft/extended-isupport']);

        expect(rawCalls(rawSpy, 'ISUPPORT')).toHaveLength(0);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
    });

    it('asks for ISUPPORT without the gate when SASL credentials exist', async() => {
        const client = network.ircClient;
        network.password = 'secret';
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/extended-isupport', 'sasl']);

        expect(rawCalls(rawSpy, 'ISUPPORT')).toHaveLength(1);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
        expect(rawCalls(rawSpy, 'CAP').filter((call) => call[1] === 'END')).toHaveLength(0);
    });

    it('asks for ISUPPORT without the gate with an EXTERNAL mechanism', async() => {
        const client = network.ircClient;
        client.options.sasl_mechanism = 'EXTERNAL';
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/extended-isupport']);

        expect(rawCalls(rawSpy, 'ISUPPORT')).toHaveLength(1);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
    });

    it('does not engage once connected', async() => {
        const client = network.ircClient;
        network.state = 'connected';
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/extended-isupport']);

        expect(rawCalls(rawSpy, 'ISUPPORT')).toHaveLength(0);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
    });

    it('does not send ISUPPORT twice for repeated ACKs', async() => {
        const client = network.ircClient;
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/extended-isupport']);
        await ackCaps(client, ['draft/extended-isupport']);

        expect(rawCalls(rawSpy, 'ISUPPORT')).toHaveLength(1);
    });

    it('does not send ISUPPORT twice without the gate either', async() => {
        const client = network.ircClient;
        network.password = 'secret';
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/extended-isupport']);
        await ackCaps(client, ['draft/extended-isupport']);

        expect(rawCalls(rawSpy, 'ISUPPORT')).toHaveLength(1);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
    });

    it('ends negotiation after the 005 debounce', async() => {
        const client = network.ircClient;
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/extended-isupport']);

        client.emit('server options', { options: {} });
        jest.advanceTimersByTime(999);
        expect(rawCalls(rawSpy, 'CAP').filter((call) => call[1] === 'END')).toHaveLength(0);

        jest.advanceTimersByTime(1);
        const ends = rawCalls(rawSpy, 'CAP').filter((call) => call[1] === 'END');
        expect(ends).toHaveLength(1);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
        expect(client.network.cap.negotiating).toBe(false);
    });

    it('debounces back-to-back 005 lines into one release', async() => {
        const client = network.ircClient;
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/extended-isupport']);

        client.emit('server options', { options: {} });
        jest.advanceTimersByTime(500);
        client.emit('server options', { options: {} });
        jest.advanceTimersByTime(999);
        expect(rawCalls(rawSpy, 'CAP').filter((call) => call[1] === 'END')).toHaveLength(0);

        jest.advanceTimersByTime(1);
        const ends = rawCalls(rawSpy, 'CAP').filter((call) => call[1] === 'END');
        expect(ends).toHaveLength(1);
    });

    it('releases on the absolute timeout without any 005', async() => {
        const client = network.ircClient;
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/extended-isupport']);

        jest.advanceTimersByTime(5000);
        const ends = rawCalls(rawSpy, 'CAP').filter((call) => call[1] === 'END');
        expect(ends).toHaveLength(1);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
    });

    it('aborts the connect when draft/ACCOUNTREQUIRED is advertised', async() => {
        const client = network.ircClient;
        client.network.cap.negotiating = true;
        client.connection = { end: jest.fn() };
        await ackCaps(client, ['draft/extended-isupport']);

        client.emit('server options', { options: { 'DRAFT/ACCOUNTREQUIRED': '' } });
        jest.advanceTimersByTime(1000);

        expect(network.state).toBe('disconnected');
        expect(network.state_error).toBe('account_required');
        expect(client.connection.end).toHaveBeenCalledTimes(1);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
    });

    it('stays connected when draft/ACCOUNTREQUIRED is absent', async() => {
        const client = network.ircClient;
        client.network.cap.negotiating = true;
        client.connection = { end: jest.fn() };
        await ackCaps(client, ['draft/extended-isupport']);

        client.emit('server options', { options: { NETWORK: 'TestNet' } });
        jest.advanceTimersByTime(1000);

        expect(network.state).toBe('connecting');
        expect(network.state_error).toBe('');
        expect(client.connection.end).not.toHaveBeenCalled();
        expect(network.isupport.NETWORK).toBe('TestNet');
    });
});

describe('ISUPPORT middleware', () => {
    function install(client, network) {
        let handler = null;
        const rawEvents = {
            use: jest.fn((fn) => {
                handler = fn;
            }),
        };

        isupportMiddleware(network)(client, rawEvents);
        return handler;
    }

    test('separates advertised and negated tokens', () => {
        expect(parseIsupportTokens([
            'TestNick',
            'CHANTYPES=#',
            '-STATUSMSG',
            '-PREFIX',
            'CASEMAPPING=ascii',
        ])).toEqual({
            advertised: ['CHANTYPES', 'CASEMAPPING'],
            negated: ['STATUSMSG', 'PREFIX'],
        });
    });

    test('removes negated options and tracks advertised tokens', () => {
        const client = {
            network: {
                options: {
                    'STATUSMSG': ['@'],
                    'PREFIX': [{ symbol: '@', mode: 'o' }],
                    '-STATUSMSG': true,
                    '-PREFIX': true,
                },
            },
            on: jest.fn(),
        };
        const network = {
            isupport: {
                'STATUSMSG': ['@'],
                'PREFIX': [{ symbol: '@', mode: 'o' }],
                '-STATUSMSG': true,
                '-PREFIX': true,
            },
        };
        const handler = install(client, network);

        handler('005', {
            params: ['TestNick', '-STATUSMSG', '-PREFIX'],
        }, '', client, () => {});

        expect(client.network.options).toEqual({});
        expect(network.isupport).toEqual({});
        expect(client.advertisedIsupport.has('STATUSMSG')).toBe(false);
        expect(client.advertisedIsupport.has('PREFIX')).toBe(false);

        handler('005', {
            params: ['TestNick', 'PREFIX=(ov)@+'],
        }, '', client, () => {});
        expect(client.advertisedIsupport.has('PREFIX')).toBe(true);

        handler('005', {
            params: ['TestNick', '-PREFIX'],
        }, '', client, () => {});
        expect(client.advertisedIsupport.has('PREFIX')).toBe(false);

        const caseClient = {
            network: { options: { CASEMAPPING: 'ascii' } },
            on: jest.fn(),
        };
        const caseNetwork = {
            isupport: { CASEMAPPING: 'ascii' },
            reindexUsers: jest.fn(),
        };
        const caseHandler = install(caseClient, caseNetwork);

        caseHandler('005', {
            params: ['TestNick', '-CASEMAPPING'],
        }, '', caseClient, () => {});

        expect(caseClient.network.options).toEqual({});
        expect(caseNetwork.isupport).toEqual({});
        expect(caseNetwork.reindexUsers).toHaveBeenCalledTimes(1);
    });

    test('uses the modern PREFIX fallback', () => {
        const network = {
            isupport: {},
            supports: NetworkState.prototype.supports,
        };

        expect(network.supports('PREFIX')).toEqual([
            { symbol: '@', mode: 'o' },
            { symbol: '+', mode: 'v' },
        ]);
        expect(network.supports('CHANTYPES')).toEqual(['#', '&']);
    });
});

describe('ircd identity', () => {
    function makeNetwork() {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        return network;
    }

    it('reads the ircd name from 002 and keeps it over 004', async() => {
        let network = makeNetwork();
        await driveRawLine(network.ircClient, '002', [
            'TestNick',
            'Your host is irc.example.com, running version InspIRCd-2.0',
        ]);
        expect(network.ircd).toBe('InspIRCd-2.0');

        network = makeNetwork();
        await driveRawLine(network.ircClient, '002', [
            'TestNick',
            'Your host is irc.example.com, running version InspIRCd-2.0',
        ]);
        await driveRawLine(network.ircClient, '004', [
            'TestNick',
            'irc.example.com',
            'InspIRCd-3.14.0',
            'iors',
            'ntlk',
        ]);
        expect(network.ircd).toBe('InspIRCd-2.0');
    });

    it('falls back to the 004 version when 002 names no version', async() => {
        const network = makeNetwork();
        await driveRawLine(network.ircClient, '002', [
            'TestNick',
            'Your host is bnc.example.com',
        ]);
        expect(network.ircd).toBe('');

        await driveRawLine(network.ircClient, '004', [
            'TestNick',
            'bnc.example.com',
            'soju',
            'aiwroO',
            'OovaimnqpsrtklbeI',
        ]);
        expect(network.ircd).toBe('soju');
    });
});

describe('IrcdDiffs.js', () => {
    describe('extbanAccount', () => {
        it('should resolve the account extban for each ircd dialect', () => {
            expect(IrcdDiffs.extbanAccount({
                ircd: '',
                supports: (name) => (name === 'ACCOUNTEXTBAN' ? '$,a' : ''),
            })).toBe('$a');

            expect(IrcdDiffs.extbanAccount({
                ircd: 'InspIRCd-2.0',
                supports: (name) => (name === 'EXTBAN' ? '~,qjncrRa' : ''),
            })).toBe('~R');

            expect(IrcdDiffs.extbanAccount({
                ircd: 'UnrealIRCd-4.0',
                supports: (name) => (name === 'EXTBAN' ? '~,qjncrRa' : ''),
            })).toBe('~a');

            expect(IrcdDiffs.extbanAccount({
                ircd: 'generic',
                supports: () => '',
            })).toBe('');
        });
    });
});
