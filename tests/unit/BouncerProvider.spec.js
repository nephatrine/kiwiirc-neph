import BouncerProvider from '@/libs/BouncerProvider';
import state from '@/libs/state';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key, vars) => (vars && vars.reason ? `${key}: ${vars.reason}` : key)),
    };
});

function flushPromises() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

describe('BouncerProvider network saving', () => {
    let s;
    let provider;
    let controller;
    let addNetwork;
    let saveNetwork;

    beforeEach(() => {
        s = state.create();
        provider = new BouncerProvider(s);

        addNetwork = jest.fn();
        saveNetwork = jest.fn();

        controller = {
            id: 'bnc-controller',
            showServerBuffer: jest.fn(),
            serverBuffer: () => ({}),
            ircClient: {
                bnc: {
                    hasNetwork: () => true,
                    addNetwork,
                    saveNetwork,
                },
            },
        };

        provider.getController = () => controller;
        s.addMessage = jest.fn();
    });

    it('never saves the bouncer control connection as a network', () => {
        let control = s.addNetwork('BNC', 'nick', {
            server: 'bnc.example.com',
            port: 6697,
        });
        control.is_bnc = true;
        control.connection.bncnetid = '';

        provider.saveState();
        expect(addNetwork).not.toHaveBeenCalled();
        expect(saveNetwork).not.toHaveBeenCalled();

        // A disconnected controller leaves getController() empty; the control
        // connection must still never be sent to the bouncer.
        provider.getController = () => null;
        provider.saveState();
        expect(addNetwork).not.toHaveBeenCalled();
        expect(saveNetwork).not.toHaveBeenCalled();
    });

    it('does not create a placeholder network when the bouncer has none', () => {
        s.getActiveBuffer = () => null;
        provider.addNetworkToState = jest.fn();

        let bound = s.addNetwork('Existing', 'nick', {
            server: 'irc.example.com',
            port: 6697,
            bncnetid: '1',
        });
        bound.showServerBuffer = jest.fn();

        let addNetworkSpy = jest.fn();
        s.addNetwork = addNetworkSpy;

        // A bouncer with networks still selects the first real network.
        provider.onBouncerNetworks([{ netid: '1', name: 'Existing' }]);
        expect(addNetworkSpy).not.toHaveBeenCalled();
        expect(bound.showServerBuffer).toHaveBeenCalledWith('settings');

        // A bouncer with none opens the control connection's buffer instead of
        // fabricating a placeholder network.
        provider.onBouncerNetworks([]);
        expect(addNetworkSpy).not.toHaveBeenCalled();
        expect(controller.showServerBuffer).toHaveBeenCalledWith('messages');
    });

    it('removes stale control connections left over from a previous login', () => {
        let stale = s.addNetwork('Bouncer', 'nick', {
            server: 'bnc.example.com',
            port: 6697,
        });
        stale.is_bnc = true;
        stale.connection.bncnetid = '';

        let bound = s.addNetwork('Existing', 'nick', {
            server: 'irc.example.com',
            port: 6697,
            bncnetid: '1',
        });

        let control = s.addNetwork('BNC', 'nick', {
            server: 'bnc.example.com',
            port: 6697,
        });
        control.frameworkClient = {
            bnc: {
                hasNetwork: () => false,
                getNetworks: () => Promise.resolve([]),
            },
        };

        provider.initAndAddNetworks(control);

        expect(s.networks).toContain(control);
        expect(s.networks).toContain(bound);
        expect(s.networks).not.toContain(stale);
        expect(control.name).toBe('BNC');
        expect(control.is_bnc).toBe(true);
        expect(control.hidden).toBe(false);
    });

    it('reports a failed ADDNETWORK once and does not resend the same request', async() => {
        addNetwork.mockReturnValue(Promise.reject({
            error: 'UNKNOWN_ERROR',
            reason: 'attempt to write a readonly database',
        }));

        let network = s.addNetwork('NewNet', 'nick', {
            server: 'irc.example.com',
            port: 6697,
            tls: true,
        });

        provider.saveState();
        await flushPromises();

        expect(addNetwork).toHaveBeenCalledTimes(1);
        expect(addNetwork.mock.calls[0][0]).toMatchObject({
            host: 'irc.example.com',
            port: 6697,
            nickname: 'nick',
        });

        expect(s.addMessage).toHaveBeenCalledTimes(1);
        expect(s.addMessage.mock.calls[0][0]).toBe(network.serverBuffer());
        expect(s.addMessage.mock.calls[0][1].type).toBe('error');
        expect(s.addMessage.mock.calls[0][1].message).toContain('attempt to write a readonly database');

        // The debounced watcher fires repeatedly, but identical retries are
        // skipped now that we know they fail.
        provider.saveState();
        await flushPromises();
        expect(addNetwork).toHaveBeenCalledTimes(1);
        expect(s.addMessage).toHaveBeenCalledTimes(1);

        // Changing the network gives us a new request worth trying.
        network.connection.nick = 'othernick';
        provider.saveState();
        await flushPromises();
        expect(addNetwork).toHaveBeenCalledTimes(2);
    });

    it('forgets a failed request once a save succeeds', async() => {
        addNetwork.mockReturnValueOnce(Promise.reject({ error: 'X', reason: 'nope' }));

        let network = s.addNetwork('Net', 'nick', {
            server: 'irc.example.com',
            port: 6697,
        });

        provider.saveState();
        await flushPromises();
        expect(addNetwork).toHaveBeenCalledTimes(1);

        addNetwork.mockReturnValueOnce(Promise.resolve({ netid: 'netid-1' }));
        network.connection.nick = 'othernick';
        provider.saveState();
        await flushPromises();

        expect(addNetwork).toHaveBeenCalledTimes(2);
        expect(network.connection.bncnetid).toBe('netid-1');
        expect(provider.failedSaves[network.id]).toBeUndefined();
    });

    it('reports a failed SAVENETWORK for an already saved network', async() => {
        saveNetwork.mockReturnValue(Promise.reject({ error: 'UNKNOWN_ERROR', reason: 'boom' }));

        s.addNetwork('Net', 'nick', {
            server: 'irc.example.com',
            port: 6697,
            bncnetid: 'abc123',
        });
        provider.networksSnapshot = {
            abc123: {
                bncnetid: 'abc123',
                name: 'OldName',
                host: 'irc.example.com',
                port: 6697,
                nickname: 'nick',
            },
        };

        provider.saveState();
        await flushPromises();

        expect(saveNetwork).toHaveBeenCalledTimes(1);
        expect(saveNetwork.mock.calls[0][0]).toBe('abc123');
        expect(s.addMessage).toHaveBeenCalledTimes(1);
        expect(s.addMessage.mock.calls[0][1].message).toContain('boom');
    });

    it('sends the server password as pass and never the SASL password', async() => {
        addNetwork.mockReturnValue(Promise.resolve({ netid: 'netid-1' }));

        let network = s.addNetwork('Net', 'nick', {
            server: 'irc.example.com',
            port: 6697,
            password: 'server-pass',
            account_password: 'sasl-pass',
            account: 'account',
        });
        network.username = 'ident';

        provider.saveState();
        await flushPromises();

        expect(addNetwork).toHaveBeenCalledTimes(1);
        expect(addNetwork.mock.calls[0][0]).toMatchObject({
            username: 'ident',
            pass: 'server-pass',
        });
        expect(addNetwork.mock.calls[0][0].pass).not.toBe(network.password);
        expect(network.connection.account).toBe('account');
    });

    it('restores the bouncer pass into the server password field', () => {
        let network = provider.addNetworkToState({
            netid: '5',
            name: 'Libera',
            nickname: 'nick',
            host: 'irc.example.com',
            port: '6697',
            tls: true,
            username: 'account',
            realname: 'Real Name',
            pass: 'server-pass',
        });

        expect(network.username).toBe('account');
        expect(network.gecos).toBe('Real Name');
        expect(network.connection.password).toBe('server-pass');
        expect(network.password).toBe('');
        expect(network.connection.account).toBe('');
    });

    it('snapshots the server password rather than the SASL password', () => {
        let network = s.addNetwork('Net', 'nick', {
            server: 'irc.example.com',
            port: 6697,
            bncnetid: 'abc',
        });
        network.connection.password = 'server-pass';
        network.password = 'sasl-pass';
        network.username = 'ident';
        network.gecos = 'Real Name';

        provider.snapshotCurrentNetworks();

        expect(provider.networksSnapshot.abc.pass).toBe('server-pass');
        expect(provider.networksSnapshot.abc.username).toBe('ident');
        expect(provider.networksSnapshot.abc.realname).toBe('Real Name');
    });

    it('applies an explicit save to one network only and re-snapshots it', async() => {
        let netA = s.addNetwork('NetA', 'nicka', {
            server: 'a.example.com',
            port: 6697,
            bncnetid: 'a1',
        });
        s.addNetwork('NetB', 'nickb', {
            server: 'b.example.com',
            port: 6697,
            bncnetid: 'b1',
        });
        provider.networksSnapshot = {
            a1: {
                bncnetid: 'a1',
                name: 'NetA',
                host: 'a.example.com',
                port: 6697,
                nickname: 'nicka',
            },
            b1: {
                bncnetid: 'b1',
                name: 'NetB',
                host: 'b.example.com',
                port: 6697,
                nickname: 'nickb',
            },
        };

        saveNetwork.mockReturnValue(Promise.resolve());

        netA.connection.server = 'new.example.com';
        provider.saveNetworkChanges(netA);
        await flushPromises();

        expect(saveNetwork).toHaveBeenCalledTimes(1);
        expect(saveNetwork.mock.calls[0][0]).toBe('a1');
        expect(saveNetwork.mock.calls[0][1]).toMatchObject({
            host: 'new.example.com',
        });

        // The snapshot was refreshed, so applying the same edit again is a
        // no-op and the untouched network was never sent.
        expect(provider.networksSnapshot.a1.host).toBe('new.example.com');
        expect(provider.networksSnapshot.b1.host).toBe('b.example.com');
        provider.saveNetworkChanges(netA);
        await flushPromises();
        expect(saveNetwork).toHaveBeenCalledTimes(1);
    });

    it('does not save edits until they are applied explicitly', async() => {
        let network = s.addNetwork('Net', 'nick', {
            server: 'irc.example.com',
            port: 6697,
            bncnetid: 'x1',
        });
        provider.networksSnapshot = {
            x1: {
                bncnetid: 'x1',
                name: 'Net',
                host: 'irc.example.com',
                port: 6697,
                nickname: 'nick',
            },
        };

        saveNetwork.mockReturnValue(Promise.resolve());

        provider.monitorNetworkChanges();

        network.connection.server = 'elsewhere.example.com';
        network.name = 'Renamed';
        await flushPromises();

        expect(addNetwork).not.toHaveBeenCalled();
        expect(saveNetwork).not.toHaveBeenCalled();

        provider.saveNetworkChanges(network);
        await flushPromises();
        expect(saveNetwork).toHaveBeenCalledTimes(1);
    });

    it('creates a new network on the bouncer when it is applied', async() => {
        addNetwork.mockReturnValue(Promise.resolve({ netid: 'fresh-1' }));

        let network = s.addNetwork('Fresh', 'nick', {
            server: 'irc.example.com',
            port: 6697,
        });

        provider.saveNetworkChanges(network);
        await flushPromises();

        expect(addNetwork).toHaveBeenCalledTimes(1);
        expect(addNetwork.mock.calls[0][0]).toMatchObject({
            host: 'irc.example.com',
            port: 6697,
            nickname: 'nick',
        });
        expect(network.connection.bncnetid).toBe('fresh-1');
    });

    it('applies pending changes just before connecting', async() => {
        provider.listenToState();

        let network = s.addNetwork('Fresh', 'nick', {
            server: 'irc.example.com',
            port: 6697,
        });
        addNetwork.mockReturnValue(Promise.resolve({ netid: 'n1' }));

        s.$emit('network.connecting', { network });
        await flushPromises();

        expect(addNetwork).toHaveBeenCalledTimes(1);
        expect(addNetwork.mock.calls[0][0]).toMatchObject({
            host: 'irc.example.com',
            port: 6697,
            nickname: 'nick',
        });
    });

    it('keeps the bouncer upstream state and error on the network', () => {
        let network = provider.addNetworkToState({
            netid: '9',
            name: 'Failed',
            nickname: 'nick',
            host: 'irc.example.com',
            port: '6697',
            state: 'disconnected',
            error: 'certificate error',
        });

        expect(network.bnc_state).toBe('disconnected');
        expect(network.bnc_error).toBe('certificate error');
        expect(network.bouncerState()).toBe('disconnected');

        // A later healthy report clears the error again.
        provider.addNetworkToState({
            netid: '9',
            name: 'Failed',
            nickname: 'nick',
            host: 'irc.example.com',
            port: '6697',
            state: 'connected',
            error: '',
        });

        expect(network.bnc_error).toBe('');
        expect(network.bouncerState()).toBe('connected');
    });

    it('reads control credentials, never a bound network\'s upstream login', () => {
        let bound = s.addNetwork('Bound', 'nick', {
            server: 'irc.example.com',
            account: 'upstream-account',
        });
        bound.is_bnc = true;
        bound.connection.bncnetid = '1';
        bound.password = 'upstream-password';

        let control = s.addNetwork('BNC', 'nick', {
            server: 'bnc.example.com',
            account: 'bouncer-account',
        });
        control.is_bnc = true;
        control.password = 'bouncer-password';

        provider.enable('bnc.example.com', 6697, true, false, '');

        expect(provider.bnc.username).toBe('bouncer-account');
        expect(provider.bnc.password).toBe('bouncer-password');
    });
});
