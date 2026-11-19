import isupportMiddleware, { parseIsupportTokens } from '@/libs/IsupportMiddleware';
import NetworkState from '@/libs/state/NetworkState';

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

describe('ISUPPORT middleware', () => {
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
});

describe('ISUPPORT defaults', () => {
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
