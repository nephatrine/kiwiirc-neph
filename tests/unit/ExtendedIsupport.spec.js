import state from '@/libs/state';

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
