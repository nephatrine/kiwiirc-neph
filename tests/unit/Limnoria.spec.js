import state from '@/libs/state';
import InputHandler from '@/libs/InputHandler';
import limnoriaMiddleware from '@/libs/LimnoriaMiddleware';
import {
    LIMNORIA_DEFAULT_PLUGINS,
    applyLimnoriaResponse,
    limnoriaSettings,
    parseLimnoriaPlugins,
    parseLimnoriaResponses
} from '@/libs/Limnoria';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key) => key),
    };
});

describe('Limnoria autocomplete responses', () => {
    test('applies backspaces and suffixes', () => {
        expect(applyLimnoriaResponse('frenod', '\b\b\benode')).toBe('freenode');
        expect(applyLimnoriaResponse('net', 'work')).toBe('network');
    });

    test('parses tab-separated responses and removes duplicates', () => {
        expect(parseLimnoriaResponses('net', 'work\twork\twork2'))
            .toEqual(['network', 'network2']);
        expect(parseLimnoriaResponses('net', '')).toEqual([]);
        expect(parseLimnoriaResponses('net', undefined)).toEqual([]);
    });

    test('parses comma- and space-separated plugin names', () => {
        expect(parseLimnoriaPlugins('Admin, Games misc')).toEqual([
            'admin',
            'games',
            'misc',
        ]);
        expect(parseLimnoriaPlugins(['Admin', 'Games'])).toEqual([
            'admin',
            'games',
        ]);
        expect(parseLimnoriaPlugins('Admin, admin ADMIN')).toEqual(['admin']);
        expect(parseLimnoriaPlugins('')).toEqual([]);
    });
});

describe('Limnoria middleware', () => {
    function makeNetwork() {
        return {
            appState: {
                $emit: jest.fn(),
            },
        };
    }

    test('consumes autocomplete responses and requests', () => {
        const network = makeNetwork();
        let handler = null;
        limnoriaMiddleware(network)({}, {}, {
            use: (fn) => {
                handler = fn;
            },
        });
        const next = jest.fn();
        const response = { command: 'TAGMSG', tags: { '+draft/autocomplete-response': 'work' } };
        const request = { command: 'TAGMSG', tags: { '+draft/autocomplete-request': 'net' } };

        handler('TAGMSG', response, {}, next);
        handler('TAGMSG', request, {}, next);

        expect(network.appState.$emit).toHaveBeenCalledWith(
            'limnoria.autocomplete.response',
            { network, event: response }
        );
        expect(network.appState.$emit).toHaveBeenCalledWith(
            'limnoria.autocomplete.request',
            { network, event: request }
        );
        expect(next).not.toHaveBeenCalled();
    });

    test('passes unrelated TAGMSGs through', () => {
        const network = makeNetwork();
        let handler = null;
        limnoriaMiddleware(network)({}, {}, {
            use: (fn) => {
                handler = fn;
            },
        });
        const next = jest.fn();

        handler('TAGMSG', { command: 'TAGMSG', tags: { '+typing': 'active' } }, {}, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(network.appState.$emit).not.toHaveBeenCalled();
    });
});

describe('Limnoria network defaults', () => {
    test('uses config.json defaults for new networks', () => {
        const s = state.create();
        s.settings = {
            ...s.settings,
            limnoria: {
                suggestions: true,
                prefix: '?',
                name: 'HelperBot',
                plugins: 'Admin, Games',
            },
        };
        const network = s.addNetwork('Configured', 'TestNick', {});

        expect(network.setting('limnoriaSuggestions')).toBe(true);
        expect(network.setting('limnoriaPrefix')).toBe('?');
        expect(network.setting('limnoriaName')).toBe('HelperBot');
        expect(network.setting('limnoriaPlugins')).toBe('Admin, Games');
        expect(limnoriaSettings(network).plugins).toEqual(['admin', 'games']);
    });

    test('falls back when config.json omits Limnoria settings', () => {
        const s = state.create();
        s.settings = {
            ...s.settings,
            limnoria: {},
        };
        const network = s.addNetwork('Configured', 'TestNick', {});

        expect(network.setting('limnoriaSuggestions')).toBe(false);
        expect(network.setting('limnoriaPrefix')).toBe('!');
        expect(network.setting('limnoriaName')).toBe('SupyBot');
        expect(network.setting('limnoriaPlugins'))
            .toBe(LIMNORIA_DEFAULT_PLUGINS);
    });

    test('keeps per-network overrides', () => {
        const s = state.create();
        s.settings = {
            ...s.settings,
            limnoria: {
                suggestions: true,
                prefix: '?',
                name: 'HelperBot',
                plugins: 'Admin, Games',
            },
        };
        const network = s.addNetwork('Configured', 'TestNick', {});
        network.setting('limnoriaPrefix', '#');
        network.setting('limnoriaPlugins', 'Misc');

        expect(network.setting('limnoriaPrefix')).toBe('#');
        expect(network.setting('limnoriaPlugins')).toBe('Misc');
    });
});

describe('/lim command', () => {
    let s;
    let network;
    let buffer;
    let handler;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.net',
        });
        network.nick = 'TestNick';
        buffer = s.addBuffer(network.id, '#test');
        handler = new InputHandler(s);
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function enableLimnoria(overrides = {}) {
        network.setting('limnoriaSuggestions', true);
        network.setting('limnoriaName', 'SupyBot');
        network.setting('limnoriaPrefix', '!');
        Object.keys(overrides).forEach((key) => {
            network.setting(key, overrides[key]);
        });
    }

    test('defaults the network settings', () => {
        expect(network.setting('limnoriaSuggestions')).toBe(false);
        expect(network.setting('limnoriaName')).toBe('SupyBot');
        expect(network.setting('limnoriaPrefix')).toBe('!');
    });

    test('sends unknown commands privately', () => {
        enableLimnoria();

        handler.processLine('/lim list', { network, buffer });

        expect(network.ircClient.say).toHaveBeenCalledWith('SupyBot', 'list', {});
    });

    test('normalizes non-breaking spaces after /lim', () => {
        enableLimnoria();
        s.addUserToBuffer(buffer, { nick: 'SupyBot' });
        const raw = jest.spyOn(network.ircClient, 'raw')
            .mockImplementation(() => {});

        handler.processLine('/lim\u00A0EIGHTBALL Am I cool?', { network, buffer });

        expect(network.ircClient.say).toHaveBeenCalledWith(
            '#test',
            '!EIGHTBALL Am I cool?',
            {}
        );
        expect(raw).not.toHaveBeenCalled();
    });

    test('errors when suggestions are disabled', () => {
        const addMessage = jest.spyOn(s, 'addMessage');

        handler.processLine('/lim list', { network, buffer });

        const error = addMessage.mock.calls.find((call) => call[1].type === 'error');
        expect(error[1].message).toBe('limnoria_disabled');
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });

    test('errors when the bot name is blank', () => {
        enableLimnoria({ limnoriaName: '  ' });
        const addMessage = jest.spyOn(s, 'addMessage');

        handler.processLine('/lim list', { network, buffer });

        const error = addMessage.mock.calls.find((call) => call[1].type === 'error');
        expect(error[1].message).toBe('limnoria_name_required');
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });

    test('errors when no command is supplied', () => {
        enableLimnoria();
        const addMessage = jest.spyOn(s, 'addMessage');

        handler.processLine('/lim', { network, buffer });

        const error = addMessage.mock.calls.find((call) => call[1].type === 'error');
        expect(error[1].message).toBe('limnoria_command_required');
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });

    test('uses the prefix for channel-specific config config', () => {
        enableLimnoria();
        s.addUserToBuffer(buffer, { nick: 'SupyBot' });

        handler.processLine('/lim config config foo bar', { network, buffer });

        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!config config foo bar', {});
    });

    test('uses the prefix for other channel-context commands', () => {
        enableLimnoria();
        s.addUserToBuffer(buffer, { nick: 'SupyBot' });

        handler.processLine('/lim config channel #test foo', { network, buffer });
        handler.processLine('/lim reset channel foo', { network, buffer });
        handler.processLine('/lim more', { network, buffer });
        handler.processLine('/lim misc last', { network, buffer });
        handler.processLine('/lim completenick a', { network, buffer });
        handler.processLine('/lim channel mode +m', { network, buffer });
        handler.processLine('/lim channel capability add Nick op', { network, buffer });
        handler.processLine('/lim channel disable Foo', { network, buffer });
        handler.processLine('/lim games dice 2d6', { network, buffer });
        handler.processLine('/lim games roulette spin', { network, buffer });
        handler.processLine('/lim seen seen Nick', { network, buffer });
        handler.processLine('/lim seen user Name', { network, buffer });
        handler.processLine('/lim seen last', { network, buffer });
        handler.processLine('/lim channelstats stats', { network, buffer });
        handler.processLine('/lim ctcp version', { network, buffer });
        handler.processLine('/lim debug channeldb', { network, buffer });
        handler.processLine('/lim factoids learn foo is bar', { network, buffer });
        handler.processLine('/lim factoids random', { network, buffer });
        handler.processLine('/lim factoids lock foo', { network, buffer });
        handler.processLine('/lim herald default hi', { network, buffer });
        handler.processLine('/lim herald add Nick hi', { network, buffer });
        handler.processLine('/lim karma load file', { network, buffer });
        handler.processLine('/lim lart lart Nick', { network, buffer });
        handler.processLine('/lim messageparser show foo', { network, buffer });
        handler.processLine('/lim moobotfactoids most recent', { network, buffer });
        handler.processLine('/lim news news', { network, buffer });
        handler.processLine('/lim poll add "Best?" A B', { network, buffer });
        handler.processLine('/lim poll list', { network, buffer });
        handler.processLine('/lim praise praise Nick nice', { network, buffer });
        handler.processLine('/lim quote random', { network, buffer });
        handler.processLine('/lim quote replace Nick 1 fixed', { network, buffer });
        handler.processLine('/lim quotegrabs grab Nick', { network, buffer });
        handler.processLine('/lim quotegrabs say 1', { network, buffer });
        handler.processLine('/lim quotegrabs get 1', { network, buffer });
        handler.processLine('/lim quotegrabs search text', { network, buffer });
        handler.processLine('/lim rss announce add feed', { network, buffer });
        handler.processLine('/lim rss announce list', { network, buffer });
        handler.processLine('/lim rss announce remove feed', { network, buffer });
        handler.processLine('/lim relay join #test', { network, buffer });
        handler.processLine('/lim relay part #test', { network, buffer });
        handler.processLine('/lim relay nicks #test', { network, buffer });
        handler.processLine('/lim scheduler add 60 ping', { network, buffer });
        handler.processLine('/lim scheduler remind 60 hi', { network, buffer });
        handler.processLine('/lim scheduler remove 1', { network, buffer });
        handler.processLine('/lim scheduler repeat --delay 5 job 60 ping', {
            network,
            buffer,
        });
        handler.processLine('/lim scheduler list', { network, buffer });
        handler.processLine('/lim services op #test', { network, buffer });
        handler.processLine('/lim services voice #test', { network, buffer });
        handler.processLine('/lim services unban #test', { network, buffer });
        handler.processLine('/lim services invite #test', { network, buffer });
        handler.processLine('/lim channel op #test', { network, buffer });
        handler.processLine('/lim channel nicks #test', { network, buffer });
        handler.processLine('/lim success add hi', { network, buffer });
        handler.processLine('/lim success get 1', { network, buffer });
        handler.processLine('/lim success stats', { network, buffer });
        handler.processLine('/lim dunno add hi', { network, buffer });
        handler.processLine('/lim dunno stats', { network, buffer });
        handler.processLine('/lim lart add hi', { network, buffer });
        handler.processLine('/lim lart get 1', { network, buffer });
        handler.processLine('/lim praise change 1 s/a/b/', { network, buffer });
        handler.processLine('/lim quote stats', { network, buffer });
        handler.processLine('/lim topic topic', { network, buffer });
        handler.processLine('/lim topic add hi', { network, buffer });
        handler.processLine('/lim topic replace 1 hi', { network, buffer });
        handler.processLine('/lim topic shuffle', { network, buffer });
        handler.processLine('/lim topic set hi', { network, buffer });
        handler.processLine('/lim topic undo', { network, buffer });
        handler.processLine('/lim topic default', { network, buffer });
        handler.processLine('/lim url stats', { network, buffer });
        handler.processLine('/lim url last', { network, buffer });

        expect(network.ircClient.say).toHaveBeenCalledWith(
            '#test',
            '!config channel #test foo',
            {}
        );
        expect(network.ircClient.say).toHaveBeenCalledWith(
            '#test',
            '!reset channel foo',
            {}
        );
        expect(network.ircClient.say).toHaveBeenCalledWith('#test', '!more', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!misc last', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!completenick a', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!channel mode +m', {});
        expect(network.ircClient.say).toHaveBeenCalledWith(
            '#test',
            '!channel capability add Nick op',
            {}
        );
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!channel disable Foo', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!games dice 2d6', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!games roulette spin', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!seen seen Nick', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!seen user Name', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!seen last', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!channelstats stats', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!ctcp version', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!debug channeldb', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!factoids learn foo is bar', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!factoids random', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!factoids lock foo', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!herald default hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!herald add Nick hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!karma load file', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!lart lart Nick', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!messageparser show foo', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!moobotfactoids most recent', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!news news', {});
        expect(network.ircClient.say).toHaveBeenCalledWith(
            '#test',
            '!poll add "Best?" A B',
            {}
        );
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!poll list', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!praise praise Nick nice', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!quote random', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!quote replace Nick 1 fixed', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!quotegrabs grab Nick', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!quotegrabs say 1', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!quotegrabs get 1', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!quotegrabs search text', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!rss announce add feed', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!rss announce list', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!rss announce remove feed', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!relay join #test', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!relay part #test', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!relay nicks #test', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!scheduler add 60 ping', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!scheduler remind 60 hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!scheduler remove 1', {});
        expect(network.ircClient.say).toHaveBeenCalledWith(
            '#test',
            '!scheduler repeat --delay 5 job 60 ping',
            {}
        );
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!scheduler list', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!services op #test', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!services voice #test', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!services unban #test', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!services invite #test', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!channel op #test', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!channel nicks #test', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!success add hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!success get 1', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!success stats', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!dunno add hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!dunno stats', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!lart add hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!lart get 1', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!praise change 1 s/a/b/', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!quote stats', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!topic topic', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!topic add hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!topic replace 1 hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!topic shuffle', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!topic set hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!topic undo', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!topic default', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!url stats', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('#test', '!url last', {});
    });

    test('keeps private-preferred commands private even when the bot is present', () => {
        enableLimnoria();
        s.addUserToBuffer(buffer, { nick: 'SupyBot' });

        handler.processLine('/lim config list', { network, buffer });
        handler.processLine('/lim config reset network foo', { network, buffer });
        handler.processLine('/lim ping', { network, buffer });
        handler.processLine('/lim admin join #other', { network, buffer });
        handler.processLine('/lim owner load Misc', { network, buffer });
        handler.processLine('/lim channel lobotomy', { network, buffer });
        handler.processLine('/lim network connect TestNet', { network, buffer });
        handler.processLine('/lim nickauth auth', { network, buffer });
        handler.processLine('/lim user identify Name Pass', { network, buffer });
        handler.processLine('/lim owner disable Foo', { network, buffer });
        handler.processLine('/lim admin capability add Nick op', { network, buffer });
        handler.processLine('/lim ddg search cats', { network, buffer });
        handler.processLine('/lim geography localtime Paris', { network, buffer });
        handler.processLine('/lim hashes sha256 text', { network, buffer });
        handler.processLine('/lim math calc 1+1', { network, buffer });
        handler.processLine('/lim time time', { network, buffer });
        handler.processLine('/lim note note 5', { network, buffer });
        handler.processLine('/lim plugin plugin join', { network, buffer });
        handler.processLine('/lim string md5 text', { network, buffer });
        handler.processLine('/lim aka add foo bar', { network, buffer });
        handler.processLine('/lim alias add foo bar', { network, buffer });
        handler.processLine('/lim anonymous say #test hi', { network, buffer });
        handler.processLine('/lim badwords add foo', { network, buffer });
        handler.processLine('/lim conditional cif true foo bar', { network, buffer });
        handler.processLine('/lim debug eval 1+1', { network, buffer });
        handler.processLine('/lim user stats', { network, buffer });
        handler.processLine('/lim misc version', { network, buffer });
        handler.processLine('/lim dict random', { network, buffer });
        handler.processLine('/lim dict dict test', { network, buffer });
        handler.processLine('/lim fediverse status https://example.social/@a/1', {
            network,
            buffer,
        });
        handler.processLine('/lim internet whois example.com', { network, buffer });
        handler.processLine('/lim network whois example.com', { network, buffer });
        handler.processLine('/lim config default foo', { network, buffer });
        handler.processLine('/lim later tell Nick hello', { network, buffer });
        handler.processLine('/lim nickometer Nick', { network, buffer });
        handler.processLine('/lim format replace Nick hello', { network, buffer });
        handler.processLine('/lim rss add feed url', { network, buffer });
        handler.processLine('/lim rss remove feed', { network, buffer });
        handler.processLine('/lim rss rss feed', { network, buffer });
        handler.processLine('/lim rss info feed', { network, buffer });
        handler.processLine('/lim rss announce channels feed', { network, buffer });
        handler.processLine('/lim reply private hello', { network, buffer });
        handler.processLine('/lim reply action waves', { network, buffer });
        handler.processLine('/lim reply notice hi', { network, buffer });
        handler.processLine('/lim reply reply hi', { network, buffer });
        handler.processLine('/lim reply replies a b', { network, buffer });
        handler.processLine('/lim owner announce hi', { network, buffer });
        handler.processLine('/lim note reply hi', { network, buffer });
        handler.processLine('/lim services identify', { network, buffer });
        handler.processLine('/lim services ghost Nick', { network, buffer });
        handler.processLine('/lim services nickserv REGISTER pass', {
            network,
            buffer,
        });
        handler.processLine('/lim services chanserv REGISTER #test', {
            network,
            buffer,
        });
        handler.processLine('/lim services password Nick pass', {
            network,
            buffer,
        });
        handler.processLine('/lim services nicks', { network, buffer });
        handler.processLine('/lim services register pass email', {
            network,
            buffer,
        });
        handler.processLine('/lim services verify account code', {
            network,
            buffer,
        });
        handler.processLine('/lim shrinkurl tiny https://example.com', {
            network,
            buffer,
        });
        handler.processLine('/lim shrinkurl ur1 https://example.com', {
            network,
            buffer,
        });
        handler.processLine('/lim shrinkurl x0 https://example.com', {
            network,
            buffer,
        });
        handler.processLine('/lim status status', { network, buffer });
        handler.processLine('/lim status threads', { network, buffer });
        handler.processLine('/lim status processes', { network, buffer });
        handler.processLine('/lim status net', { network, buffer });
        handler.processLine('/lim status cpu', { network, buffer });
        handler.processLine('/lim status cmd', { network, buffer });
        handler.processLine('/lim status commands', { network, buffer });
        handler.processLine('/lim status uptime', { network, buffer });
        handler.processLine('/lim status server', { network, buffer });
        handler.processLine('/lim status network', { network, buffer });
        handler.processLine('/lim todo todo', { network, buffer });
        handler.processLine('/lim todo add hi', { network, buffer });
        handler.processLine('/lim todo remove 1', { network, buffer });
        handler.processLine('/lim todo search hi', { network, buffer });
        handler.processLine('/lim todo setpriority 1 2', { network, buffer });
        handler.processLine('/lim todo change 1 s/a/b/', { network, buffer });
        handler.processLine('/lim unix ping example.com', { network, buffer });
        handler.processLine('/lim unix shell uname -a', { network, buffer });
        handler.processLine('/lim utilities ignore', { network, buffer });
        handler.processLine('/lim utilities success done', { network, buffer });
        handler.processLine('/lim utilities last a b', { network, buffer });
        handler.processLine('/lim utilities shuffle a b', { network, buffer });
        handler.processLine('/lim utilities sort b a', { network, buffer });
        handler.processLine('/lim web title https://example.com', {
            network,
            buffer,
        });
        handler.processLine('/lim web fetch https://example.com', {
            network,
            buffer,
        });
        handler.processLine('/lim plugindownloader repolist', { network, buffer });
        handler.processLine('/lim plugindownloader install repo plugin', {
            network,
            buffer,
        });
        handler.processLine('/lim plugindownloader info repo plugin', {
            network,
            buffer,
        });
        handler.processLine('/lim later undo Nick', { network, buffer });
        handler.processLine('/lim aka set foo bar', { network, buffer });
        handler.processLine('/lim filter reverse hello', { network, buffer });
        handler.processLine('/lim format bold hello', { network, buffer });
        handler.processLine('/lim gpg key list', { network, buffer });
        handler.processLine('/lim google translate en fr hello', { network, buffer });
        handler.processLine('/lim note search cats', { network, buffer });
        handler.processLine('/lim search cats', { network, buffer });

        expect(network.ircClient.say).toHaveBeenCalledWith('SupyBot', 'config list', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'config reset network foo', {});
        expect(network.ircClient.say).toHaveBeenCalledWith('SupyBot', 'ping', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'channel lobotomy', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'network connect TestNet', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'nickauth auth', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'user identify Name Pass', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'owner disable Foo', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'admin capability add Nick op', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'ddg search cats', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'geography localtime Paris', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'hashes sha256 text', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'math calc 1+1', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'time time', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'note note 5', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'plugin plugin join', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'string md5 text', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'aka add foo bar', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'alias add foo bar', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'anonymous say #test hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'badwords add foo', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'conditional cif true foo bar', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'debug eval 1+1', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'user stats', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'misc version', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'dict random', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'dict dict test', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith(
                'SupyBot',
                'fediverse status https://example.social/@a/1',
                {}
            );
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'internet whois example.com', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'network whois example.com', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'config default foo', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'later tell Nick hello', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'nickometer Nick', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'format replace Nick hello', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'rss add feed url', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'rss remove feed', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'rss rss feed', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'rss info feed', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'rss announce channels feed', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'reply private hello', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'reply action waves', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'reply notice hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'reply reply hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'reply replies a b', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'owner announce hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'note reply hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'services identify', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'services ghost Nick', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'services nickserv REGISTER pass', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'services chanserv REGISTER #test', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'services password Nick pass', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'services nicks', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'services register pass email', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'services verify account code', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'shrinkurl tiny https://example.com', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'shrinkurl ur1 https://example.com', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'shrinkurl x0 https://example.com', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'status status', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'status threads', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'status processes', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'status net', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'status cpu', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'status cmd', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'status commands', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'status uptime', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'status server', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'status network', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'todo todo', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'todo add hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'todo remove 1', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'todo search hi', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'todo setpriority 1 2', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'todo change 1 s/a/b/', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'unix ping example.com', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'unix shell uname -a', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'utilities ignore', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'utilities success done', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'utilities last a b', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'utilities shuffle a b', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'utilities sort b a', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'web title https://example.com', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'web fetch https://example.com', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'plugindownloader repolist', {});
        expect(network.ircClient.say).toHaveBeenCalledWith(
            'SupyBot',
            'plugindownloader install repo plugin',
            {}
        );
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'plugindownloader info repo plugin', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'later undo Nick', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'aka set foo bar', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'filter reverse hello', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'format bold hello', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'gpg key list', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'google translate en fr hello', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'note search cats', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'search cats', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'admin join #other', {});
        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'owner load Misc', {});
    });

    test('uses private messaging for prefix commands when the prefix is unset', () => {
        enableLimnoria({ limnoriaPrefix: '' });

        handler.processLine('/lim config config foo bar', { network, buffer });

        expect(network.ircClient.say)
            .toHaveBeenCalledWith('SupyBot', 'config config foo bar', {});
    });

    test('errors when a prefix command cannot reach the bot in the channel', () => {
        enableLimnoria();
        const addMessage = jest.spyOn(s, 'addMessage');

        handler.processLine('/lim config config foo bar', { network, buffer });

        const error = addMessage.mock.calls.find((call) => call[1].type === 'error');
        expect(error[1].message).toBe('limnoria_prefix_unavailable');
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });

    test('errors when a prefix command is used outside a channel', () => {
        enableLimnoria();
        const query = s.addBuffer(network.id, 'SupyBot');
        const addMessage = jest.spyOn(s, 'addMessage');

        handler.processLine('/lim config config foo bar', { network, buffer: query });

        const error = addMessage.mock.calls.find((call) => call[1].type === 'error');
        expect(error[1].message).toBe('limnoria_prefix_unavailable');
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });
});
