import state from '@/libs/state';
import {
    nickservSubcommands,
    NICKSERV_SUBCOMMANDS,
    NICKSERV_OPER_SUBCOMMANDS,
    isNickservSubcommandPosition
} from '@/libs/ErgoServices';

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

function emitParsedMode(client, event) {
    return new Promise((resolve, reject) => {
        client.parsed_middleware.handle(
            ['MODE', event, client],
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

describe('oper tracking', () => {
    let s;
    let network;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        expect(network.ircClient).toBeTruthy();
        jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('defaults is_oper to false', () => {
        expect(network.is_oper).toBe(false);
    });

    it('sets is_oper on numeric 381', async() => {
        await emitRawLine(network.ircClient, '381', ['TestNick', 'You are now an IRC operator']);
        expect(network.is_oper).toBe(true);
    });

    it('clears is_oper on connecting', async() => {
        await emitRawLine(network.ircClient, '381', ['TestNick', 'You are now an IRC operator']);
        expect(network.is_oper).toBe(true);
        network.ircClient.emit('connecting');
        expect(network.is_oper).toBe(false);
    });

    it('sets is_oper on self MODE +o', async() => {
        await emitParsedMode(network.ircClient, {
            command: 'MODE',
            nick: 'Server',
            target: 'TestNick',
            modes: [{ mode: '+o' }],
            params: [],
            tags: {},
        });
        expect(network.is_oper).toBe(true);
    });

    it('clears is_oper on self MODE -o', async() => {
        network.is_oper = true;
        await emitParsedMode(network.ircClient, {
            command: 'MODE',
            nick: 'Server',
            target: 'TestNick',
            modes: [{ mode: '-o' }],
            params: [],
            tags: {},
        });
        expect(network.is_oper).toBe(false);
    });

    it('ignores channel MODE +o', async() => {
        await emitParsedMode(network.ircClient, {
            command: 'MODE',
            nick: 'Oper',
            target: '#chan',
            modes: [{ mode: '+o', param: 'Someone' }],
            params: [],
            tags: {},
        });
        expect(network.is_oper).toBe(false);
    });

    it('filters oper subcommands via selector', () => {
        const base = nickservSubcommands({ oper: false, authenticated: true });
        NICKSERV_SUBCOMMANDS.forEach((cmd) => {
            expect(base).toContain(cmd);
        });
        NICKSERV_OPER_SUBCOMMANDS.forEach((cmd) => {
            expect(base).not.toContain(cmd);
        });
        const withOper = nickservSubcommands({ oper: true, authenticated: true });
        NICKSERV_OPER_SUBCOMMANDS.forEach((cmd) => {
            expect(withOper).toContain(cmd);
        });
    });

    it('hides auth-gated subcommands when logged out', () => {
        const loggedOut = nickservSubcommands({ oper: false, authenticated: false });
        ['DROP', 'GHOST', 'GROUP', 'GET', 'SET'].forEach((cmd) => {
            expect(loggedOut).not.toContain(cmd);
        });
        const loggedIn = nickservSubcommands({ oper: false, authenticated: true });
        ['DROP', 'GHOST', 'GROUP', 'GET', 'SET'].forEach((cmd) => {
            expect(loggedIn).toContain(cmd);
        });
    });

    it('offers only valid bare subcommands', () => {
        const base = nickservSubcommands({ oper: false });
        // PASSWORD is a working alias of PASSWD; ENFORCE is hidden and not
        // a valid bare subcommand, SESSIONS/VERIFYEMAIL are hidden too.
        expect(base).toContain('PASSWORD');
        expect(base).not.toContain('ENFORCE');
        expect(base).not.toContain('SESSIONS');
        expect(base).not.toContain('VERIFYEMAIL');
        const withOper = nickservSubcommands({ oper: true });
        expect(withOper).not.toContain('ENFORCE');
    });

    it('limits subcommand completion to the subcommand token', () => {
        expect(isNickservSubcommandPosition('/ns ')).toBe(true);
        expect(isNickservSubcommandPosition('/ns e')).toBe(true);
        expect(isNickservSubcommandPosition('/ns IDENT')).toBe(true);
        expect(isNickservSubcommandPosition('/NS ver')).toBe(true);
        expect(isNickservSubcommandPosition('/msg NickServ ')).toBe(true);
        expect(isNickservSubcommandPosition('/msg NickServ VER')).toBe(true);
        expect(isNickservSubcommandPosition('/ns IDENTIFY ')).toBe(false);
        expect(isNickservSubcommandPosition('/ns IDENTIFY us')).toBe(false);
        expect(isNickservSubcommandPosition('/msg NickServ VERIFY bob ')).toBe(false);
        expect(isNickservSubcommandPosition('/ns')).toBe(false);
        expect(isNickservSubcommandPosition('/msg NickServ')).toBe(false);
        expect(isNickservSubcommandPosition('/query NickServ HELP')).toBe(false);
        expect(isNickservSubcommandPosition('')).toBe(false);
        expect(isNickservSubcommandPosition(null)).toBe(false);
    });

    it('detects ergo servers via isErgo', () => {
        network.ircd = 'Ergo-2.14.0';
        expect(network.isErgo()).toBe(true);
        network.ircd = 'ergo-2.14.0';
        expect(network.isErgo()).toBe(true);
        network.ircd = 'InspIRCd-2.0';
        expect(network.isErgo()).toBe(false);
        network.ircd = '';
        expect(network.isErgo()).toBe(false);
    });
});
