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
    function makeNetwork() {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        return network;
    }

    it('reads the ircd name from 002 and keeps it over 004', async() => {
        let network = makeNetwork();
        await emitRawLine(network.ircClient, '002', [
            'TestNick',
            'Your host is irc.example.com, running version InspIRCd-2.0',
        ]);
        expect(network.ircd).toBe('InspIRCd-2.0');

        network = makeNetwork();
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

    it('falls back to the 004 version when 002 names no version', async() => {
        const network = makeNetwork();
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
});
