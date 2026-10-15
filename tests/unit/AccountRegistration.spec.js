import state from '@/libs/state';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key, vars) => (vars && vars.account ? `${key} ${vars.account}` : key)),
    };
});

describe('account registration', () => {
    let s;
    let network;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.state = 'connected';
        network.nick = 'TestNick';
        network.sasl_account = '';
        network.enabled_caps = ['draft/account-registration'];
        network.cap_values = {};
        // Instantiate the framework client so the middleware helpers exist
        const client = network.ircClient;
        expect(client).toBeTruthy();
        expect(typeof network.registerAccount).toBe('function');
    });

    function emitUnknown(event) {
        const ircEventObj = { handled: false };
        s.$emit('irc.unknown command', event, network, ircEventObj);
        return ircEventObj;
    }

    it('parses capability tokens', () => {
        expect(network.accountRegistration()).toEqual({
            beforeConnect: false,
            customAccountName: false,
            emailRequired: false,
            minPasswordLength: 0,
            maxPasswordLength: 0,
        });

        network.cap_values = {
            'draft/account-registration': 'before-connect,custom-account-name,email-required,min-password-length=8,max-password-length=300',
        };
        expect(network.accountRegistration()).toEqual({
            beforeConnect: true,
            customAccountName: true,
            emailRequired: true,
            minPasswordLength: 8,
            maxPasswordLength: 300,
        });
    });

    it('returns null when the capability is not enabled', () => {
        network.enabled_caps = ['server-time'];
        expect(network.accountRegistration()).toBe(null);
    });

    it('sends REGISTER and tracks the pending registration', () => {
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        network.registerAccount('*', 'tester@example.org', 'hunter2');
        expect(rawSpy).toHaveBeenCalledWith('REGISTER', '*', 'tester@example.org', 'hunter2');
        expect(network.registration.pending).toBe(true);
        expect(network.registration.awaitingVerify).toBe(false);
        expect(network.registration.account).toBe('TestNick');
        expect(network.registration.error).toBe('');
        rawSpy.mockRestore();
    });

    it('does not send REGISTER when disconnected or unsupported', () => {
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        network.state = 'disconnected';
        network.registerAccount('*', '*', 'hunter2');
        expect(rawSpy).not.toHaveBeenCalled();
        expect(network.registration.pending).toBe(false);

        network.state = 'connected';
        network.enabled_caps = ['server-time'];
        network.registerAccount('*', '*', 'hunter2');
        expect(rawSpy).not.toHaveBeenCalled();
        expect(network.registration.pending).toBe(false);
        rawSpy.mockRestore();
    });

    it('completes on REGISTER SUCCESS and keeps session credentials', () => {
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        network.registerAccount('*', 'tester@example.org', 'hunter2');

        const result = emitUnknown({
            command: 'REGISTER',
            params: ['SUCCESS', 'TestNick', 'Account successfully registered'],
        });
        expect(result.handled).toBe(true);
        expect(network.sasl_account).toBe('TestNick');
        expect(network.registration.pending).toBe(false);
        expect(network.registration.error).toBe('');
        // Session fields are always written so reconnects reuse them, even
        // with no persistence watcher running. Reaching disk still requires
        // the Remember Me watcher; nothing here writes to storage.
        expect(network.password).toBe('hunter2');
        expect(network.connection.account).toBe('TestNick');
        rawSpy.mockRestore();
    });

    it('persists credentials on success when state is being remembered', () => {
        s.persistence = { isPersisting: true };
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        network.registerAccount('*', '*', 'hunter2');

        emitUnknown({
            command: 'REGISTER',
            params: ['SUCCESS', 'TestNick', 'Account successfully registered'],
        });
        expect(network.sasl_account).toBe('TestNick');
        expect(network.connection.account).toBe('TestNick');
        expect(network.password).toBe('hunter2');
        rawSpy.mockRestore();
    });

    it('moves to verification on VERIFICATION_REQUIRED', () => {
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        network.registerAccount('test', 'tester@example.org', 'hunter2');

        const result = emitUnknown({
            command: 'REGISTER',
            params: ['VERIFICATION_REQUIRED', 'test', 'Pending verification'],
        });
        expect(result.handled).toBe(true);
        expect(network.registration.pending).toBe(true);
        expect(network.registration.awaitingVerify).toBe(true);
        expect(network.sasl_account).toBe('');
        rawSpy.mockRestore();
    });

    it('sends VERIFY only while awaiting verification', () => {
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        const verifyCalls = () => rawSpy.mock.calls.filter((call) => call[0] === 'VERIFY');

        network.verifyAccount('abc123');
        expect(verifyCalls()).toHaveLength(0);

        network.registerAccount('*', 'tester@example.org', 'hunter2');
        network.verifyAccount('abc123');
        expect(verifyCalls()).toHaveLength(0);

        emitUnknown({
            command: 'REGISTER',
            params: ['VERIFICATION_REQUIRED', 'TestNick', 'Pending verification'],
        });
        network.verifyAccount('abc123');
        expect(rawSpy).toHaveBeenCalledWith('VERIFY', 'TestNick', 'abc123');
        rawSpy.mockRestore();
    });

    it('completes on VERIFY SUCCESS', () => {
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        network.registerAccount('*', 'tester@example.org', 'hunter2');
        emitUnknown({
            command: 'REGISTER',
            params: ['VERIFICATION_REQUIRED', 'TestNick', 'Pending verification'],
        });

        const result = emitUnknown({
            command: 'VERIFY',
            params: ['SUCCESS', 'TestNick', 'Account successfully registered'],
        });
        expect(result.handled).toBe(true);
        expect(network.sasl_account).toBe('TestNick');
        expect(network.registration.pending).toBe(false);
        expect(network.registration.awaitingVerify).toBe(false);
        rawSpy.mockRestore();
    });

    it('surfaces FAIL codes on the pending registration', () => {
        network.registerAccount('*', 'tester@example.org', 'weak');
        const result = emitUnknown({
            command: 'FAIL',
            params: ['REGISTER', 'WEAK_PASSWORD', 'TestNick', 'Password is too weak'],
        });
        expect(result.handled).toBe(true);
        expect(network.registration.pending).toBe(true);
        expect(network.registration.error).toBe('Password is too weak');
        expect(network.sasl_account).toBe('');
    });

    it('ignores FAIL REGISTER without a pending registration', () => {
        const result = emitUnknown({
            command: 'FAIL',
            params: ['REGISTER', 'WEAK_PASSWORD', 'TestNick', 'Password is too weak'],
        });
        expect(result.handled).toBe(false);
        expect(network.registration.error).toBe('');
    });

    it('clears the form on ALREADY_AUTHENTICATED', () => {
        network.registerAccount('*', '*', 'hunter2');
        const result = emitUnknown({
            command: 'FAIL',
            params: ['REGISTER', 'ALREADY_AUTHENTICATED', 'TestNick', 'Already logged in'],
        });
        expect(result.handled).toBe(true);
        expect(network.registration.pending).toBe(false);
        expect(network.registration.error).toBe('');
    });

    it('clears pending state on disconnect', () => {
        network.registerAccount('*', '*', 'hunter2');
        expect(network.registration.pending).toBe(true);
        network.ircClient.emit('socket close');
        expect(network.registration.pending).toBe(false);
        expect(network.registration.error).toBe('');
    });
});
