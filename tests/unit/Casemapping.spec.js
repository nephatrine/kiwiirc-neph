import getState from '@/libs/state';

describe('IRC casemapping', () => {
    let state;
    let network;

    beforeEach(() => {
        state = getState();
        state.resetState();
        network = state.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.net',
        });
        const client = network.ircClient;
        expect(client).toBeTruthy();
    });

    afterEach(() => {
        state.resetState();
    });

    test('uses rfc1459 casemapping for users and buffers', () => {
        const user = state.addUser(network.id, { nick: '[User]' });
        const sameUser = state.addUser(network.id, { nick: '{User}' });

        expect(sameUser).toBe(user);
        expect(state.getUser(network.id, '{User}')).toBe(user);

        const buffer = state.addBuffer(network.id, '#[Test]');
        expect(state.getBufferByName(network.id, '#{Test}')).toBe(buffer);
    });

    test('uses rfc1459 casemapping for channel member lookups', () => {
        const buffer = state.addBuffer(network.id, '#test');
        state.addUserToBuffer(buffer, { nick: '[User]' });

        expect(buffer.hasNick('{User}')).toBe(true);
    });

    test('respects ascii casemapping when advertised', () => {
        network.frameworkClient.network.options.CASEMAPPING = 'ascii';

        const first = state.addUser(network.id, { nick: '[User]' });
        const second = state.addUser(network.id, { nick: '{User}' });

        expect(second).not.toBe(first);
        expect(state.getUser(network.id, '{User}')).toBe(second);
    });
});
