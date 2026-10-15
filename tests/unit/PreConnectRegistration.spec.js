import state from '@/libs/state';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key, vars) => (vars && vars.account ? `${key} ${vars.account}` : key)),
    };
});

const GATE_TOKEN = 'kiwi-register-wait';

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

function capEnds(rawSpy) {
    return rawCalls(rawSpy, 'CAP').filter((call) => call[1] === 'END');
}

describe('before-connect registration', () => {
    let s;
    let network;
    let rawSpy;
    let endSpy;

    beforeEach(() => {
        jest.useFakeTimers();
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        // Touching ircClient builds the framework client and middleware
        const client = network.ircClient;
        expect(client).toBeTruthy();
        expect(typeof network.armPreConnectRegistration).toBe('function');

        network.state = 'connecting';
        network.nick = 'TestNick';
        network.password = '';
        network.last_error = '';
        client.network.cap.requested = [];
        client.network.cap.negotiating = false;
        rawSpy = jest.spyOn(client, 'raw').mockImplementation(() => {});
        endSpy = jest.fn();
        client.connection = { end: endSpy };
    });

    afterEach(() => {
        rawSpy.mockRestore();
        jest.useRealTimers();
    });

    function emitUnknown(event) {
        const ircEventObj = { handled: false };
        s.$emit('irc.unknown command', event, network, ircEventObj);
        return ircEventObj;
    }

    function arm() {
        network.armPreConnectRegistration('newacct', 'new@example.org', 'hunter2');
    }

    it('sends REGISTER and holds CAP END open on ACK when armed', async() => {
        const client = network.ircClient;
        arm();
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/account-registration']);

        expect(rawSpy).toHaveBeenCalledWith('REGISTER', 'newacct', 'new@example.org', 'hunter2');
        expect(client.network.cap.requested).toContain(GATE_TOKEN);
        expect(capEnds(rawSpy)).toHaveLength(0);
        expect(network.registration.pending).toBe(true);
    });

    it('sends a verbatim * on the wire when armed with * and a stale nick exists', async() => {
        const client = network.ircClient;
        network.nick = 'StaleNick';
        network.connection.nick = 'FreshNick';
        network.armPreConnectRegistration('*', 'fresh@example.org', 'hunter2');
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/account-registration']);

        const registers = rawCalls(rawSpy, 'REGISTER');
        expect(registers).toHaveLength(1);
        expect(registers[0][1]).toBe('*');
        // Display name prefers the fresh connection nick over the stale one
        expect(network.registration.account).toBe('FreshNick');
    });

    it('does nothing on ACK when not armed', async() => {
        const client = network.ircClient;
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/account-registration']);

        expect(rawCalls(rawSpy, 'REGISTER')).toHaveLength(0);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
        expect(network.registration.pending).toBe(false);
    });

    it('ignores NAKs and ACKs once connected', async() => {
        const client = network.ircClient;
        arm();
        client.network.cap.negotiating = true;
        await nakCaps(client, ['draft/account-registration']);

        expect(rawCalls(rawSpy, 'REGISTER')).toHaveLength(0);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);

        network.state = 'connected';
        await ackCaps(client, ['draft/account-registration']);
        expect(rawCalls(rawSpy, 'REGISTER')).toHaveLength(0);
    });

    it('completes on SUCCESS and ends negotiation itself', async() => {
        const client = network.ircClient;
        arm();
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/account-registration']);

        const result = emitUnknown({
            command: 'REGISTER',
            params: ['SUCCESS', 'newacct', 'Account created'],
            tags: {},
        });
        expect(result.handled).toBe(true);
        expect(network.sasl_account).toBe('newacct');
        expect(network.registration.pending).toBe(false);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
        expect(capEnds(rawSpy)).toHaveLength(1);
        expect(client.network.cap.negotiating).toBe(false);
        expect(endSpy).not.toHaveBeenCalled();
    });

    it('waits for VERIFY and completes on VERIFY SUCCESS', async() => {
        const client = network.ircClient;
        arm();
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/account-registration']);

        emitUnknown({
            command: 'REGISTER',
            params: ['VERIFICATION_REQUIRED', 'newacct', 'Check your email'],
            tags: {},
        });
        expect(network.registration.awaitingVerify).toBe(true);
        expect(network.registration.account).toBe('newacct');
        expect(capEnds(rawSpy)).toHaveLength(0);

        network.verifyAccount('abc123');
        expect(rawSpy).toHaveBeenCalledWith('VERIFY', 'newacct', 'abc123');

        emitUnknown({
            command: 'VERIFY',
            params: ['SUCCESS', 'newacct', 'Verified'],
            tags: {},
        });
        expect(network.sasl_account).toBe('newacct');
        expect(network.registration.pending).toBe(false);
        expect(capEnds(rawSpy)).toHaveLength(1);
    });

    it('aborts the connection on FAIL REGISTER', async() => {
        const client = network.ircClient;
        arm();
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/account-registration']);

        const result = emitUnknown({
            command: 'FAIL',
            params: ['REGISTER', 'ACCOUNT_EXISTS', 'newacct', 'That name is taken'],
            tags: {},
        });
        expect(result.handled).toBe(true);
        expect(capEnds(rawSpy)).toHaveLength(0);
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
        expect(network.state).toBe('disconnected');
        expect(network.last_error).toBe('That name is taken');
        expect(network.registration.pending).toBe(false);
        expect(endSpy).toHaveBeenCalledTimes(1);
    });

    it('keeps a retriable VERIFY failure pending', async() => {
        const client = network.ircClient;
        arm();
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/account-registration']);

        emitUnknown({
            command: 'REGISTER',
            params: ['VERIFICATION_REQUIRED', 'newacct', 'Check your email'],
            tags: {},
        });
        emitUnknown({
            command: 'FAIL',
            params: ['VERIFY', 'INVALID_CODE', 'newacct', 'Wrong code'],
            tags: {},
        });

        expect(network.registration.pending).toBe(true);
        expect(network.registration.awaitingVerify).toBe(true);
        expect(network.registration.error).toBe('Wrong code');
        expect(endSpy).not.toHaveBeenCalled();
        expect(capEnds(rawSpy)).toHaveLength(0);
    });

    it('aborts on the backstop timeout', async() => {
        const client = network.ircClient;
        arm();
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/account-registration']);

        jest.advanceTimersByTime(5000);
        expect(endSpy).toHaveBeenCalledTimes(1);
        expect(network.state).toBe('disconnected');
        expect(network.last_error).toBe('registration_timeout');
        expect(client.network.cap.requested).not.toContain(GATE_TOKEN);
    });

    it('restarts the backstop while waiting for a code', async() => {
        const client = network.ircClient;
        arm();
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/account-registration']);

        jest.advanceTimersByTime(4000);
        emitUnknown({
            command: 'REGISTER',
            params: ['VERIFICATION_REQUIRED', 'newacct', 'Check your email'],
            tags: {},
        });
        jest.advanceTimersByTime(4000);
        expect(endSpy).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1100);
        expect(endSpy).toHaveBeenCalledTimes(1);
    });

    it('cancels silently on request', async() => {
        const client = network.ircClient;
        arm();
        client.network.cap.negotiating = true;
        await ackCaps(client, ['draft/account-registration']);

        network.cancelPreConnectRegistration();
        expect(endSpy).toHaveBeenCalledTimes(1);
        expect(network.last_error).toBe('');
        expect(network.registration.pending).toBe(false);
        expect(capEnds(rawSpy)).toHaveLength(0);
    });
});
