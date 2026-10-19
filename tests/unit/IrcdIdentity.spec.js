import state from '@/libs/state';

function emitRawLine(client, command, params) {
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

describe('ircd identity', () => {
    let s;
    let network;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
    });

    it('reads the ircd name out of the 002 reply', async() => {
        await emitRawLine(network.ircClient, '002', [
            'TestNick',
            'Your host is irc.example.com, running version InspIRCd-2.0',
        ]);
        expect(network.ircd).toBe('InspIRCd-2.0');
    });

    it('falls back to the 004 version when 002 names no version', async() => {
        await emitRawLine(network.ircClient, '002', [
            'TestNick',
            'Your host is bnc.example.com',
        ]);
        expect(network.ircd).toBe('');

        await emitRawLine(network.ircClient, '004', [
            'TestNick',
            'bnc.example.com',
            'soju',
            'aiwroO',
            'OovaimnqpsrtklbeI',
        ]);
        expect(network.ircd).toBe('soju');
    });

    it('keeps the 002 version when 004 also reports one', async() => {
        await emitRawLine(network.ircClient, '002', [
            'TestNick',
            'Your host is irc.example.com, running version InspIRCd-2.0',
        ]);
        await emitRawLine(network.ircClient, '004', [
            'TestNick',
            'irc.example.com',
            'InspIRCd-3.14.0',
            'iors',
            'ntlk',
        ]);
        expect(network.ircd).toBe('InspIRCd-2.0');
    });
});
