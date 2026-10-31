import {
    LIMNORIA_COMMANDS,
    LIMNORIA_COMMAND_CONFLICTS,
    LIMNORIA_COMMAND_DELIVERY,
    LIMNORIA_PLUGIN_COMMAND_CONFLICTS,
    limnoriaCommandDelivery,
    limnoriaCommandPath,
    limnoriaCommandSuggestions,
    limnoriaCommandSyntax
} from '@/libs/LimnoriaCommands';

function suggestionTexts(input, plugins) {
    return limnoriaCommandSuggestions(input, plugins).map((item) => item.text);
}

describe('Limnoria command data', () => {
    test('contains the initial core plugin commands', () => {
        const names = LIMNORIA_COMMANDS.map((command) => command.name);

        expect(names).toEqual(expect.arrayContaining([
            'join',
            'channels',
            'nick',
            'capability',
            'ignore',
            'clearq',
            'acmd',
            'list',
            'search',
            'searchhelp',
            'searchvalues',
            'channel',
            'network',
            'config',
            'help',
            'default',
            'reload',
            'export',
            'setdefault',
            'reset',
            'apropos',
            'version',
            'source',
            'more',
            'last',
            'tell',
            'noticetell',
            'ping',
            'completenick',
            'clearmores',
            'logmark',
            'announce',
            'defaultplugin',
            'ircquote',
            'quit',
            'flush',
            'upkeep',
            'load',
            'unload',
            'defaultcapability',
            'disable',
            'enable',
            'rename',
            'unrename',
            'reloadlocale',
            'mode',
            'limit',
            'moderate',
            'unmoderate',
            'key',
            'op',
            'halfop',
            'voice',
            'deop',
            'dehalfop',
            'devoice',
            'cycle',
            'kick',
            'kban',
            'iban',
            'unban',
            'listbans',
            'invite',
            'nicks',
            'alert',
            'part',
            'lobotomy',
            'ban',
            'connect',
            'disconnect',
            'reconnect',
            'command',
            'cmdall',
            'whois',
            'whowas',
            'networks',
            'latency',
            'driver',
            'uptime',
            'capabilities',
            'authenticate',
            'auth',
            'register',
            'unregister',
            'changename',
            'username',
            'set',
            'hostmask',
            'identify',
            'unidentify',
            'whoami',
            'stats',
            'coin',
            'dice',
            'eightball',
            'roulette',
            'monologue',
            'localtime',
            'timezone',
            'md5',
            'sha',
            'sha256',
            'sha512',
            'algorithms',
            'mkhash',
            'base',
            'calc',
            'icalc',
            'rpn',
            'convert',
            'units',
            'seconds',
            'at',
            'until',
            'ctime',
            'time',
            'elapsed',
            'tztime',
            'ddate',
            'send',
            'reply',
            'unsend',
            'note',
            'next',
            'plugin',
            'plugins',
            'path',
            'author',
            'contributors',
            'seen',
            'any',
            'user',
            'since',
            'ord',
            'chr',
            'unicodename',
            'unicodesearch',
            'encode',
            'decode',
            'levenshtein',
            'soundex',
            'len',
            're',
            'xor',
            'add',
            'remove',
            'lock',
            'unlock',
            'show',
            'importaliasdatabase',
            'say',
            'do',
            'react',
            'rank',
            'channelstats',
            'cif',
            'cand',
            'cor',
            'cxor',
            'ceq',
            'ne',
            'gt',
            'ge',
            'lt',
            'le',
            'match',
            'nceq',
            'nne',
            'ngt',
            'nge',
            'nlt',
            'nle',
            'cerror',
            'eval',
            'exec',
            'simpleeval',
            'exn',
            'sendquote',
            'settrace',
            'unsettrace',
            'channeldb',
            'collect',
            'environ',
            'dictionaries',
            'random',
            'dict',
            'synonym',
            'learn',
            'whatis',
            'alias',
            'rank',
            'forget',
            'info',
            'change',
            'profile',
            'featured',
            'statuses',
            'status',
            'outfilter',
            'hebrew',
            'squish',
            'undup',
            'binary',
            'unbinary',
            'hexlify',
            'unhexlify',
            'rot13',
            'leet',
            'supa1337',
            'scramble',
            'unmorse',
            'morse',
            'reverse',
            'colorize',
            'rainbow',
            'stripformatting',
            'stripcolor',
            'aol',
            'jeffk',
            'spellit',
            'gnu',
            'shrink',
            'uniud',
            'capwords',
            'caps',
            'vowelrot',
            'uwu',
            'bold',
            'underline',
            'color',
            'join',
            'translate',
            'replace',
            'upper',
            'lower',
            'capitalize',
            'title',
            'repr',
            'concat',
            'cut',
            'field',
            'format',
            'key',
            'signing',
            'default',
            'get',
            'dns',
            'whois',
            'hexip',
            'karma',
            'most',
            'clear',
            'dump',
            'lart',
            'notes',
            'undo',
            'vacuum',
            'literal',
            'factinfo',
            'listauth',
            'listkeys',
            'listvalues',
            'news',
            'old',
            'nickometer',
            'close',
            'vote',
            'results',
            'praise',
            'grab',
            'ungrab',
            'quote',
            'rss',
            'private',
            'action',
            'notice',
            'replies',
            'remind',
            'repeat',
            'ghost',
            'nickserv',
            'chanserv',
            'password',
            'verify',
            'tiny',
            'ur1',
            'x0',
            'threads',
            'processes',
            'net',
            'cpu',
            'cmd',
            'commands',
            'server',
            'todo',
            'setpriority',
            'topic',
            'fit',
            'insert',
            'shuffle',
            'reorder',
            'restore',
            'refresh',
            'redo',
            'swap',
            'save',
            'separator',
            'errno',
            'progstats',
            'pid',
            'crypt',
            'spell',
            'fortune',
            'wtf',
            'ping6',
            'sysuptime',
            'sysuname',
            'call',
            'shell',
            'success',
            'echo',
            'sort',
            'sample',
            'countargs',
            'apply',
            'let',
            'headers',
            'location',
            'doctype',
            'size',
            'title',
            'urlquote',
            'urlunquote',
            'fetch',
            'repolist',
            'install',
        ]));
    });

    test('keeps every conflicting plugin command', () => {
        expect(LIMNORIA_COMMAND_CONFLICTS).toEqual([
            'add',
            'announce',
            'capabilities',
            'capability',
            'change',
            'default',
            'disable',
            'enable',
            'get',
            'help',
            'identify',
            'ignore',
            'info',
            'invite',
            'join',
            'key',
            'last',
            'list',
            'load',
            'lock',
            'md5',
            'most',
            'network',
            'nick',
            'nicks',
            'op',
            'part',
            'ping',
            'random',
            'rank',
            'register',
            'reload',
            'remove',
            'replace',
            'reply',
            'reverse',
            'say',
            'search',
            'set',
            'sha',
            'show',
            'shuffle',
            'stats',
            'status',
            'tell',
            'title',
            'translate',
            'unban',
            'undo',
            'unlock',
            'uptime',
            'version',
            'voice',
            'whois',
        ]);
        expect(LIMNORIA_PLUGIN_COMMAND_CONFLICTS)
            .toEqual([
                'alias',
                'channel',
                'channelstats',
                'config',
                'dict',
                'format',
                'karma',
                'lart',
                'network',
                'news',
                'nickometer',
                'note',
                'plugin',
                'praise',
                'quote',
                'reply',
                'rss',
                'seen',
                'status',
                'success',
                'time',
                'todo',
                'topic',
                'user',
            ]);

        const pluginsFor = (name) => LIMNORIA_COMMANDS
            .filter((command) => command.name === name)
            .map((command) => command.plugin)
            .sort();

        expect(pluginsFor('add')).toEqual([
            'Aka',
            'Alias',
            'BadWords',
            'Dunno',
            'Herald',
            'Lart',
            'MessageParser',
            'News',
            'Poll',
            'Praise',
            'Quote',
            'RSS',
            'Scheduler',
            'Success',
            'Todo',
            'Topic',
        ]);
        expect(pluginsFor('list')).toEqual([
            'Aka',
            'Alias',
            'BadWords',
            'Config',
            'MessageParser',
            'Misc',
            'Note',
            'Poll',
            'QuoteGrabs',
            'Scheduler',
            'Topic',
            'User',
        ]);
        expect(pluginsFor('capabilities')).toEqual(['Network', 'User']);
        expect(pluginsFor('capability')).toEqual(['Admin', 'Channel']);
        expect(pluginsFor('change')).toEqual([
            'Dunno',
            'Factoids',
            'Herald',
            'Lart',
            'News',
            'Praise',
            'Quote',
            'Success',
            'Todo',
            'Topic',
        ]);
        expect(pluginsFor('default'))
            .toEqual(['Config', 'Herald', 'Topic']);
        expect(pluginsFor('announce')).toEqual(['Owner', 'RSS']);
        expect(pluginsFor('info')).toEqual([
            'Factoids',
            'MessageParser',
            'PluginDownloader',
            'RSS',
        ]);
        expect(pluginsFor('get')).toEqual([
            'Dunno',
            'Herald',
            'Lart',
            'Praise',
            'Quote',
            'QuoteGrabs',
            'Success',
            'Topic',
        ]);
        expect(pluginsFor('say')).toEqual(['Anonymous', 'QuoteGrabs']);
        expect(pluginsFor('show')).toEqual(['Aka', 'MessageParser']);
        expect(pluginsFor('shuffle')).toEqual(['Topic', 'Utilities']);
        expect(pluginsFor('disable')).toEqual(['Channel', 'Owner']);
        expect(pluginsFor('enable')).toEqual(['Channel', 'Owner']);
        expect(pluginsFor('help')).toEqual(['Config', 'Misc', 'Plugin']);
        expect(pluginsFor('identify')).toEqual(['Services', 'User']);
        expect(pluginsFor('ignore'))
            .toEqual(['Admin', 'Channel', 'Utilities']);
        expect(pluginsFor('invite')).toEqual(['Channel', 'Services']);
        expect(pluginsFor('join')).toEqual(['Admin', 'Format', 'Relay']);
        expect(pluginsFor('key')).toEqual(['Channel', 'GPG']);
        expect(pluginsFor('last'))
            .toEqual(['Misc', 'Seen', 'URL', 'Utilities']);
        expect(pluginsFor('load')).toEqual(['Karma', 'Owner']);
        expect(pluginsFor('lock')).toEqual([
            'Aka',
            'Alias',
            'Factoids',
            'MessageParser',
            'MoobotFactoids',
            'Topic',
        ]);
        expect(pluginsFor('md5')).toEqual(['Hashes', 'String']);
        expect(pluginsFor('most')).toEqual(['Karma', 'MoobotFactoids']);
        expect(pluginsFor('network')).toEqual(['Config', 'Status']);
        expect(pluginsFor('nick')).toEqual(['Admin', 'NickAuth']);
        expect(pluginsFor('nicks'))
            .toEqual(['Channel', 'Relay', 'Services']);
        expect(pluginsFor('op')).toEqual(['Channel', 'Services']);
        expect(pluginsFor('part')).toEqual(['Channel', 'Relay']);
        expect(pluginsFor('ping')).toEqual(['Misc', 'Unix']);
        expect(pluginsFor('random')).toEqual([
            'Dict',
            'Factoids',
            'MoobotFactoids',
            'Quote',
            'QuoteGrabs',
        ]);
        expect(pluginsFor('rank'))
            .toEqual(['ChannelStats', 'Factoids', 'MessageParser']);
        expect(pluginsFor('register')).toEqual(['Services', 'User']);
        expect(pluginsFor('reload')).toEqual(['Config', 'Owner']);
        expect(pluginsFor('remove')).toEqual([
            'Aka',
            'Alias',
            'BadWords',
            'Dunno',
            'Herald',
            'Lart',
            'Later',
            'MessageParser',
            'MoobotFactoids',
            'News',
            'Praise',
            'Quote',
            'RSS',
            'Scheduler',
            'Success',
            'Todo',
            'Topic',
        ]);
        expect(pluginsFor('replace'))
            .toEqual(['Format', 'Quote', 'Topic']);
        expect(pluginsFor('reply')).toEqual(['Note', 'Reply']);
        expect(pluginsFor('reverse')).toEqual(['Filter', 'Format']);
        expect(pluginsFor('search')).toEqual([
            'Aka',
            'Config',
            'DDG',
            'Dunno',
            'Factoids',
            'Lart',
            'Note',
            'Praise',
            'Quote',
            'QuoteGrabs',
            'Success',
            'Todo',
        ]);
        expect(pluginsFor('set')).toEqual(['Aka', 'Topic', 'User']);
        expect(pluginsFor('sha')).toEqual(['Hashes', 'String']);
        expect(pluginsFor('stats')).toEqual([
            'ChannelStats',
            'Dunno',
            'Lart',
            'Praise',
            'Quote',
            'Success',
            'URL',
            'User',
        ]);
        expect(pluginsFor('title')).toEqual(['Format', 'Web']);
        expect(pluginsFor('status')).toEqual(['Fediverse', 'Status']);
        expect(pluginsFor('tell')).toEqual(['Anonymous', 'Later', 'Misc']);
        expect(pluginsFor('translate')).toEqual(['Format', 'Google']);
        expect(pluginsFor('unban')).toEqual(['Channel', 'Services']);
        expect(pluginsFor('undo')).toEqual(['Later', 'Topic']);
        expect(pluginsFor('unlock')).toEqual([
            'Aka',
            'Alias',
            'Factoids',
            'MessageParser',
            'MoobotFactoids',
            'Topic',
        ]);
        expect(pluginsFor('uptime')).toEqual(['Network', 'Status']);
        expect(pluginsFor('version')).toEqual(['Ctcp', 'Misc']);
        expect(pluginsFor('voice')).toEqual(['Channel', 'Services']);
        expect(pluginsFor('whois')).toEqual(['Internet', 'Network']);
    });

    test('provides syntax and help for every command and subcommand', () => {
        LIMNORIA_COMMANDS.forEach((command) => {
            expect(command.syntax).toBeTruthy();
            expect(command.help).toBeTruthy();
            (command.subcommands || []).forEach((subcommand) => {
                expect(subcommand.syntax).toBeTruthy();
                expect(subcommand.help).toBeTruthy();
            });
        });
    });

    test('covers nested Admin and Config commands', () => {
        const capability = LIMNORIA_COMMANDS.find((command) => command.name === 'capability');
        const ignore = LIMNORIA_COMMANDS.find((command) => command.name === 'ignore');
        const reset = LIMNORIA_COMMANDS.find((command) => command.name === 'reset');

        expect(capability.subcommands.map((command) => command.name))
            .toEqual(['add', 'remove']);
        expect(ignore.subcommands.map((command) => command.name))
            .toEqual(['add', 'remove', 'list']);
        expect(reset.subcommands.map((command) => command.name))
            .toEqual(['channel', 'network']);
    });

    test('covers nested Channel, NickAuth, and User commands', () => {
        const find = (plugin, name) => LIMNORIA_COMMANDS
            .find((command) => command.plugin === plugin && command.name === name);

        expect(find('Channel', 'lobotomy').subcommands.map((command) => command.name))
            .toEqual(['add', 'remove', 'list']);
        expect(find('Channel', 'ban').subcommands.map((command) => command.name))
            .toEqual(['hostmask', 'add', 'remove', 'list']);
        expect(find('Channel', 'capability').subcommands.map((command) => command.name))
            .toEqual(['add', 'remove', 'setdefault', 'set', 'unset', 'list']);
        expect(find('NickAuth', 'nick').subcommands.map((command) => command.name))
            .toEqual(['add', 'remove', 'list']);
        expect(find('User', 'set').subcommands.map((command) => command.name))
            .toEqual(['password', 'secure']);
        expect(find('User', 'hostmask').subcommands.map((command) => command.name))
            .toEqual(['hostmask', 'list', 'add', 'remove']);
    });
});

describe('Limnoria command delivery', () => {
    test('defines a preference for every command and subcommand', () => {
        const paths = [];
        LIMNORIA_COMMANDS.forEach((command) => {
            const base = [command.plugin.toLowerCase(), command.name.toLowerCase()];
            paths.push(base.join(' '));
            (command.subcommands || []).forEach((subcommand) => {
                paths.push(base.concat(subcommand.name.toLowerCase()).join(' '));
            });
        });

        expect(Object.keys(LIMNORIA_COMMAND_DELIVERY).sort()).toEqual(paths.sort());
        paths.forEach((path) => {
            expect(['prefix', 'private'])
                .toContain(LIMNORIA_COMMAND_DELIVERY[path]);
        });
    });

    test('uses prefix only for the approved commands', () => {
        const prefixCommands = Object.keys(LIMNORIA_COMMAND_DELIVERY)
            .filter((path) => LIMNORIA_COMMAND_DELIVERY[path] === 'prefix');

        expect(prefixCommands).toEqual(expect.arrayContaining([
            'config channel',
            'config config',
            'config reset channel',
            'misc completenick',
            'misc last',
            'misc more',
            'channel mode',
            'channel capability add',
            'channel ban list',
            'games coin',
            'games dice',
            'games roulette',
            'seen seen',
            'seen any',
            'seen last',
            'seen user',
            'seen since',
            'channelstats stats',
            'channelstats rank',
            'channelstats channelstats',
            'ctcp version',
            'debug channeldb',
            'factoids learn',
            'factoids whatis',
            'factoids alias',
            'factoids rank',
            'factoids lock',
            'factoids unlock',
            'factoids forget',
            'factoids random',
            'factoids info',
            'factoids change',
            'factoids search',
            'herald default',
            'herald get',
            'herald add',
            'herald remove',
            'herald change',
            'karma karma',
            'karma most',
            'karma clear',
            'karma dump',
            'karma load',
            'lart lart',
            'messageparser add',
            'messageparser remove',
            'messageparser lock',
            'messageparser unlock',
            'messageparser show',
            'messageparser info',
            'messageparser list',
            'messageparser rank',
            'messageparser vacuum',
            'moobotfactoids literal',
            'moobotfactoids factinfo',
            'moobotfactoids lock',
            'moobotfactoids unlock',
            'moobotfactoids most',
            'moobotfactoids listauth',
            'moobotfactoids listkeys',
            'moobotfactoids listvalues',
            'moobotfactoids remove',
            'moobotfactoids random',
            'news add',
            'news news',
            'news remove',
            'news change',
            'news old',
            'poll add',
            'poll close',
            'poll vote',
            'poll results',
            'poll list',
            'praise praise',
            'quote random',
            'quote replace',
            'quotegrabs grab',
            'quotegrabs ungrab',
            'quotegrabs quote',
            'quotegrabs list',
            'quotegrabs random',
            'quotegrabs say',
            'quotegrabs get',
            'quotegrabs search',
            'rss announce list',
            'rss announce add',
            'rss announce remove',
            'relay join',
            'relay part',
            'relay nicks',
            'scheduler add',
            'scheduler remind',
            'scheduler remove',
            'scheduler repeat',
            'scheduler list',
            'services op',
            'services voice',
            'services unban',
            'services invite',
            'success add',
            'success remove',
            'success search',
            'success get',
            'success change',
            'success stats',
            'topic topic',
            'topic add',
            'topic fit',
            'topic replace',
            'topic insert',
            'topic shuffle',
            'topic reorder',
            'topic list',
            'topic get',
            'topic change',
            'topic set',
            'topic remove',
            'topic lock',
            'topic unlock',
            'topic restore',
            'topic refresh',
            'topic undo',
            'topic redo',
            'topic swap',
            'topic save',
            'topic default',
            'topic separator',
            'url stats',
            'url last',
            'dunno add',
            'dunno remove',
            'dunno search',
            'dunno get',
            'dunno change',
            'dunno stats',
            'lart add',
            'lart remove',
            'lart search',
            'lart get',
            'lart change',
            'lart stats',
            'praise add',
            'praise remove',
            'praise search',
            'praise get',
            'praise change',
            'praise stats',
            'quote add',
            'quote remove',
            'quote search',
            'quote get',
            'quote change',
            'quote stats',
        ]));

        expect(prefixCommands).not.toContain('channel lobotomy');
        expect(prefixCommands).not.toContain('channel lobotomy add');
        expect(prefixCommands).not.toContain('channel lobotomy remove');
        expect(prefixCommands).not.toContain('channel lobotomy list');

        ['aka', 'alias', 'anonymous', 'badwords', 'conditional', 'ddg',
            'dict', 'fediverse', 'filter', 'format', 'geography', 'google',
            'gpg', 'hashes', 'internet', 'later', 'math', 'network', 'nickauth',
            'nickometer', 'note', 'plugin', 'plugindownloader', 'reply',
            'shrinkurl', 'status', 'string', 'time', 'todo', 'unix', 'user',
            'utilities', 'web']
            .forEach((plugin) => {
                const paths = prefixCommands.filter(
                    (path) => path.indexOf(plugin + ' ') === 0
                );
                expect(paths).toEqual([]);
            });

        expect(prefixCommands.filter((path) => path.indexOf('debug ') === 0))
            .toEqual(['debug channeldb']);

        Object.keys(LIMNORIA_COMMAND_DELIVERY).forEach((path) => {
            if (path.indexOf('channel ') === 0) {
                const expected = path.indexOf('channel lobotomy') === 0 ?
                    'private' :
                    'prefix';
                expect(LIMNORIA_COMMAND_DELIVERY[path]).toBe(expected);
            }
        });
    });

    test('resolves canonical command paths', () => {
        expect(limnoriaCommandPath('config config'))
            .toEqual(['config', 'config']);
        expect(limnoriaCommandPath('config list'))
            .toEqual(['config', 'list']);
        expect(limnoriaCommandPath('config reset channel'))
            .toEqual(['config', 'reset', 'channel']);
        expect(limnoriaCommandPath('reset channel'))
            .toEqual(['config', 'reset', 'channel']);
        expect(limnoriaCommandPath('config channel'))
            .toEqual(['config', 'channel']);
        expect(limnoriaCommandPath('channel mode'))
            .toEqual(['channel', 'mode']);
        expect(limnoriaCommandPath('channel capability add'))
            .toEqual(['channel', 'capability', 'add']);
        expect(limnoriaCommandPath('channel lobotomy add'))
            .toEqual(['channel', 'lobotomy', 'add']);
        expect(limnoriaCommandPath('network connect'))
            .toEqual(['network', 'connect']);
        expect(limnoriaCommandPath('nickauth nick add'))
            .toEqual(['nickauth', 'nick', 'add']);
        expect(limnoriaCommandPath('user hostmask add'))
            .toEqual(['user', 'hostmask', 'add']);
        expect(limnoriaCommandPath('ddg search'))
            .toEqual(['ddg', 'search']);
        expect(limnoriaCommandPath('games dice'))
            .toEqual(['games', 'dice']);
        expect(limnoriaCommandPath('geography localtime'))
            .toEqual(['geography', 'localtime']);
        expect(limnoriaCommandPath('hashes sha256'))
            .toEqual(['hashes', 'sha256']);
        expect(limnoriaCommandPath('math calc'))
            .toEqual(['math', 'calc']);
        expect(limnoriaCommandPath('time time'))
            .toEqual(['time', 'time']);
        expect(limnoriaCommandPath('time seconds'))
            .toEqual(['time', 'seconds']);
        expect(limnoriaCommandPath('note send'))
            .toEqual(['note', 'send']);
        expect(limnoriaCommandPath('note note'))
            .toEqual(['note', 'note']);
        expect(limnoriaCommandPath('plugin plugin'))
            .toEqual(['plugin', 'plugin']);
        expect(limnoriaCommandPath('seen seen'))
            .toEqual(['seen', 'seen']);
        expect(limnoriaCommandPath('seen user'))
            .toEqual(['seen', 'user']);
        expect(limnoriaCommandPath('string md5'))
            .toEqual(['string', 'md5']);
        expect(limnoriaCommandPath('aka add'))
            .toEqual(['aka', 'add']);
        expect(limnoriaCommandPath('alias add'))
            .toEqual(['alias', 'add']);
        expect(limnoriaCommandPath('anonymous say'))
            .toEqual(['anonymous', 'say']);
        expect(limnoriaCommandPath('badwords add'))
            .toEqual(['badwords', 'add']);
        expect(limnoriaCommandPath('channelstats stats'))
            .toEqual(['channelstats', 'stats']);
        expect(limnoriaCommandPath('channelstats channelstats'))
            .toEqual(['channelstats', 'channelstats']);
        expect(limnoriaCommandPath('ctcp version'))
            .toEqual(['ctcp', 'version']);
        expect(limnoriaCommandPath('debug channeldb'))
            .toEqual(['debug', 'channeldb']);
        expect(limnoriaCommandPath('channeldb'))
            .toEqual(['debug', 'channeldb']);
        expect(limnoriaCommandPath('factoids learn'))
            .toEqual(['factoids', 'learn']);
        expect(limnoriaCommandPath('factoids alias'))
            .toEqual(['factoids', 'alias']);
        expect(limnoriaCommandPath('factoids random'))
            .toEqual(['factoids', 'random']);
        expect(limnoriaCommandPath('dict dict'))
            .toEqual(['dict', 'dict']);
        expect(limnoriaCommandPath('dict random'))
            .toEqual(['dict', 'random']);
        expect(limnoriaCommandPath('fediverse status'))
            .toEqual(['fediverse', 'status']);
        expect(limnoriaCommandPath('filter reverse'))
            .toEqual(['filter', 'reverse']);
        expect(limnoriaCommandPath('format reverse'))
            .toEqual(['format', 'reverse']);
        expect(limnoriaCommandPath('format join'))
            .toEqual(['format', 'join']);
        expect(limnoriaCommandPath('format translate'))
            .toEqual(['format', 'translate']);
        expect(limnoriaCommandPath('google translate'))
            .toEqual(['google', 'translate']);
        expect(limnoriaCommandPath('gpg key add'))
            .toEqual(['gpg', 'key', 'add']);
        expect(limnoriaCommandPath('gpg signing auth'))
            .toEqual(['gpg', 'signing', 'auth']);
        expect(limnoriaCommandPath('herald add'))
            .toEqual(['herald', 'add']);
        expect(limnoriaCommandPath('herald default'))
            .toEqual(['herald', 'default']);
        expect(limnoriaCommandPath('internet whois'))
            .toEqual(['internet', 'whois']);
        expect(limnoriaCommandPath('karma load'))
            .toEqual(['karma', 'load']);
        expect(limnoriaCommandPath('karma karma'))
            .toEqual(['karma', 'karma']);
        expect(limnoriaCommandPath('lart lart'))
            .toEqual(['lart', 'lart']);
        expect(limnoriaCommandPath('later tell'))
            .toEqual(['later', 'tell']);
        expect(limnoriaCommandPath('messageparser show'))
            .toEqual(['messageparser', 'show']);
        expect(limnoriaCommandPath('messageparser list'))
            .toEqual(['messageparser', 'list']);
        expect(limnoriaCommandPath('moobotfactoids most'))
            .toEqual(['moobotfactoids', 'most']);
        expect(limnoriaCommandPath('news news'))
            .toEqual(['news', 'news']);
        expect(limnoriaCommandPath('nickometer nickometer'))
            .toEqual(['nickometer', 'nickometer']);
        expect(limnoriaCommandPath('poll add'))
            .toEqual(['poll', 'add']);
        expect(limnoriaCommandPath('poll list'))
            .toEqual(['poll', 'list']);
        expect(limnoriaCommandPath('praise praise'))
            .toEqual(['praise', 'praise']);
        expect(limnoriaCommandPath('quote random'))
            .toEqual(['quote', 'random']);
        expect(limnoriaCommandPath('quote replace'))
            .toEqual(['quote', 'replace']);
        expect(limnoriaCommandPath('grab'))
            .toEqual(['quotegrabs', 'grab']);
        expect(limnoriaCommandPath('quotegrabs ungrab'))
            .toEqual(['quotegrabs', 'ungrab']);
        expect(limnoriaCommandPath('quotegrabs quote'))
            .toEqual(['quotegrabs', 'quote']);
        expect(limnoriaCommandPath('quotegrabs say'))
            .toEqual(['quotegrabs', 'say']);
        expect(limnoriaCommandPath('rss rss'))
            .toEqual(['rss', 'rss']);
        expect(limnoriaCommandPath('rss announce add'))
            .toEqual(['rss', 'announce', 'add']);
        expect(limnoriaCommandPath('rss announce channels'))
            .toEqual(['rss', 'announce', 'channels']);
        expect(limnoriaCommandPath('relay join'))
            .toEqual(['relay', 'join']);
        expect(limnoriaCommandPath('reply reply'))
            .toEqual(['reply', 'reply']);
        expect(limnoriaCommandPath('private'))
            .toEqual(['reply', 'private']);
        expect(limnoriaCommandPath('replies'))
            .toEqual(['reply', 'replies']);
        expect(limnoriaCommandPath('scheduler add'))
            .toEqual(['scheduler', 'add']);
        expect(limnoriaCommandPath('scheduler repeat'))
            .toEqual(['scheduler', 'repeat']);
        expect(limnoriaCommandPath('remind'))
            .toEqual(['scheduler', 'remind']);
        expect(limnoriaCommandPath('services op'))
            .toEqual(['services', 'op']);
        expect(limnoriaCommandPath('services identify'))
            .toEqual(['services', 'identify']);
        expect(limnoriaCommandPath('services nicks'))
            .toEqual(['services', 'nicks']);
        expect(limnoriaCommandPath('shrinkurl tiny'))
            .toEqual(['shrinkurl', 'tiny']);
        expect(limnoriaCommandPath('tiny'))
            .toEqual(['shrinkurl', 'tiny']);
        expect(limnoriaCommandPath('status status'))
            .toEqual(['status', 'status']);
        expect(limnoriaCommandPath('status network'))
            .toEqual(['status', 'network']);
        expect(limnoriaCommandPath('status uptime'))
            .toEqual(['status', 'uptime']);
        expect(limnoriaCommandPath('threads'))
            .toEqual(['status', 'threads']);
        expect(limnoriaCommandPath('success add'))
            .toEqual(['success', 'add']);
        expect(limnoriaCommandPath('success stats'))
            .toEqual(['success', 'stats']);
        expect(limnoriaCommandPath('dunno add'))
            .toEqual(['dunno', 'add']);
        expect(limnoriaCommandPath('lart get'))
            .toEqual(['lart', 'get']);
        expect(limnoriaCommandPath('praise change'))
            .toEqual(['praise', 'change']);
        expect(limnoriaCommandPath('quote stats'))
            .toEqual(['quote', 'stats']);
        expect(limnoriaCommandPath('todo todo'))
            .toEqual(['todo', 'todo']);
        expect(limnoriaCommandPath('todo add'))
            .toEqual(['todo', 'add']);
        expect(limnoriaCommandPath('topic topic'))
            .toEqual(['topic', 'topic']);
        expect(limnoriaCommandPath('topic replace'))
            .toEqual(['topic', 'replace']);
        expect(limnoriaCommandPath('topic undo'))
            .toEqual(['topic', 'undo']);
        expect(limnoriaCommandPath('url stats'))
            .toEqual(['url', 'stats']);
        expect(limnoriaCommandPath('url last'))
            .toEqual(['url', 'last']);
        expect(limnoriaCommandPath('unix ping'))
            .toEqual(['unix', 'ping']);
        expect(limnoriaCommandPath('unix ping6'))
            .toEqual(['unix', 'ping6']);
        expect(limnoriaCommandPath('unix shell'))
            .toEqual(['unix', 'shell']);
        expect(limnoriaCommandPath('utilities success'))
            .toEqual(['utilities', 'success']);
        expect(limnoriaCommandPath('utilities shuffle'))
            .toEqual(['utilities', 'shuffle']);
        expect(limnoriaCommandPath('web title'))
            .toEqual(['web', 'title']);
        expect(limnoriaCommandPath('plugindownloader install'))
            .toEqual(['plugindownloader', 'install']);
        expect(limnoriaCommandPath('plugindownloader info'))
            .toEqual(['plugindownloader', 'info']);
        expect(limnoriaCommandPath('news')).toBeNull();
        expect(limnoriaCommandPath('quote')).toBeNull();
        expect(limnoriaCommandPath('announce')).toBeNull();
        expect(limnoriaCommandPath('get')).toBeNull();
        expect(limnoriaCommandPath('say')).toBeNull();
        expect(limnoriaCommandPath('nicks')).toBeNull();
        expect(limnoriaCommandPath('part')).toBeNull();
        expect(limnoriaCommandPath('reply')).toBeNull();
        expect(limnoriaCommandPath('rss')).toBeNull();
        expect(limnoriaCommandPath('status')).toBeNull();
        expect(limnoriaCommandPath('todo')).toBeNull();
        expect(limnoriaCommandPath('topic')).toBeNull();
        expect(limnoriaCommandPath('undo')).toBeNull();
        expect(limnoriaCommandPath('ping')).toBeNull();
        expect(limnoriaCommandPath('shuffle')).toBeNull();
        expect(limnoriaCommandPath('title')).toBeNull();
        expect(limnoriaCommandPath('success')).toBeNull();
        expect(limnoriaCommandPath('op')).toBeNull();
        expect(limnoriaCommandPath('voice')).toBeNull();
        expect(limnoriaCommandPath('unban')).toBeNull();
        expect(limnoriaCommandPath('invite')).toBeNull();
        expect(limnoriaCommandPath('identify')).toBeNull();
        expect(limnoriaCommandPath('register')).toBeNull();
        expect(limnoriaCommandPath('uptime')).toBeNull();
        expect(limnoriaCommandPath('nickometer')).toBeNull();
        expect(limnoriaCommandPath('praise')).toBeNull();
        expect(limnoriaCommandPath('replace')).toBeNull();
        expect(limnoriaCommandPath('change')).toBeNull();
        expect(limnoriaCommandPath('default')).toBeNull();
        expect(limnoriaCommandPath('load')).toBeNull();
        expect(limnoriaCommandPath('whois')).toBeNull();
        expect(limnoriaCommandPath('karma')).toBeNull();
        expect(limnoriaCommandPath('lart')).toBeNull();
        expect(limnoriaCommandPath('format')).toBeNull();
        expect(limnoriaCommandPath('join')).toBeNull();
        expect(limnoriaCommandPath('key')).toBeNull();
        expect(limnoriaCommandPath('reverse')).toBeNull();
        expect(limnoriaCommandPath('translate')).toBeNull();
        expect(limnoriaCommandPath('alias')).toBeNull();
        expect(limnoriaCommandPath('dict')).toBeNull();
        expect(limnoriaCommandPath('random')).toBeNull();
        expect(limnoriaCommandPath('rank')).toBeNull();
        expect(limnoriaCommandPath('stats')).toBeNull();
        expect(limnoriaCommandPath('version')).toBeNull();
        expect(limnoriaCommandPath('channelstats')).toBeNull();
        expect(limnoriaCommandPath('add')).toBeNull();
        expect(limnoriaCommandPath('remove')).toBeNull();
        expect(limnoriaCommandPath('lock')).toBeNull();
        expect(limnoriaCommandPath('unlock')).toBeNull();
        expect(limnoriaCommandPath('set')).toBeNull();
        expect(limnoriaCommandPath('tell')).toBeNull();
        expect(limnoriaCommandPath('search')).toBeNull();
        expect(limnoriaCommandPath('time')).toBeNull();
        expect(limnoriaCommandPath('note')).toBeNull();
        expect(limnoriaCommandPath('plugin')).toBeNull();
        expect(limnoriaCommandPath('seen')).toBeNull();
        expect(limnoriaCommandPath('user')).toBeNull();
        expect(limnoriaCommandPath('more'))
            .toEqual(['misc', 'more']);
        expect(limnoriaCommandPath('admin capability add'))
            .toEqual(['admin', 'capability', 'add']);
        expect(limnoriaCommandPath('capability add')).toBeNull();
        expect(limnoriaCommandPath('list')).toBeNull();
        expect(limnoriaCommandPath('capabilities')).toBeNull();
        expect(limnoriaCommandPath('nick')).toBeNull();
        expect(limnoriaCommandPath('channel')).toBeNull();
        expect(limnoriaCommandPath('network')).toBeNull();
        expect(limnoriaCommandPath('config')).toBeNull();
        expect(limnoriaCommandPath('unknown')).toBeNull();
    });

    test('returns syntax for resolved command paths', () => {
        expect(limnoriaCommandSyntax('time ctime'))
            .toBe('time ctime [<seconds since epoch>]');
        expect(limnoriaCommandSyntax('channel capability add'))
            .toBe('channel capability add [<channel>] <nick|username> ' +
                '<capability> [<capability> ...]');
        expect(limnoriaCommandSyntax('bold')).toBe('format bold <text>');
        expect(limnoriaCommandSyntax('time')).toBe('');
        expect(limnoriaCommandSyntax('unknown command')).toBe('');
    });

    test('looks up delivery by canonical path', () => {
        expect(limnoriaCommandDelivery(['config', 'config'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['config', 'reset', 'channel']))
            .toBe('prefix');
        expect(limnoriaCommandDelivery(['misc', 'more'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['channel', 'mode'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['channel', 'capability', 'add']))
            .toBe('prefix');
        expect(limnoriaCommandDelivery(['channel', 'lobotomy', 'add']))
            .toBe('private');
        expect(limnoriaCommandDelivery(['network', 'connect'])).toBe('private');
        expect(limnoriaCommandDelivery(['nickauth', 'nick', 'add']))
            .toBe('private');
        expect(limnoriaCommandDelivery(['user', 'hostmask', 'add']))
            .toBe('private');
        expect(limnoriaCommandDelivery(['games', 'dice'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['ddg', 'search'])).toBe('private');
        expect(limnoriaCommandDelivery(['geography', 'localtime']))
            .toBe('private');
        expect(limnoriaCommandDelivery(['hashes', 'sha256'])).toBe('private');
        expect(limnoriaCommandDelivery(['math', 'calc'])).toBe('private');
        expect(limnoriaCommandDelivery(['time', 'time'])).toBe('private');
        expect(limnoriaCommandDelivery(['time', 'seconds'])).toBe('private');
        expect(limnoriaCommandDelivery(['note', 'note'])).toBe('private');
        expect(limnoriaCommandDelivery(['plugin', 'plugin'])).toBe('private');
        expect(limnoriaCommandDelivery(['seen', 'seen'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['seen', 'user'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['string', 'md5'])).toBe('private');
        expect(limnoriaCommandDelivery(['aka', 'add'])).toBe('private');
        expect(limnoriaCommandDelivery(['alias', 'add'])).toBe('private');
        expect(limnoriaCommandDelivery(['anonymous', 'say'])).toBe('private');
        expect(limnoriaCommandDelivery(['badwords', 'add'])).toBe('private');
        expect(limnoriaCommandDelivery(['channelstats', 'stats'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['channelstats', 'channelstats']))
            .toBe('prefix');
        expect(limnoriaCommandDelivery(['ctcp', 'version'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['conditional', 'cif'])).toBe('private');
        expect(limnoriaCommandDelivery(['debug', 'channeldb'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['debug', 'eval'])).toBe('private');
        expect(limnoriaCommandDelivery(['dict', 'dict'])).toBe('private');
        expect(limnoriaCommandDelivery(['factoids', 'learn'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['factoids', 'random'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['fediverse', 'status'])).toBe('private');
        expect(limnoriaCommandDelivery(['filter', 'reverse'])).toBe('private');
        expect(limnoriaCommandDelivery(['format', 'join'])).toBe('private');
        expect(limnoriaCommandDelivery(['format', 'translate'])).toBe('private');
        expect(limnoriaCommandDelivery(['channel', 'key'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['gpg', 'key'])).toBe('private');
        expect(limnoriaCommandDelivery(['gpg', 'key', 'add'])).toBe('private');
        expect(limnoriaCommandDelivery(['gpg', 'signing', 'auth']))
            .toBe('private');
        expect(limnoriaCommandDelivery(['google', 'translate'])).toBe('private');
        expect(limnoriaCommandDelivery(['herald', 'add'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['herald', 'default'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['internet', 'whois'])).toBe('private');
        expect(limnoriaCommandDelivery(['karma', 'load'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['lart', 'lart'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['later', 'tell'])).toBe('private');
        expect(limnoriaCommandDelivery(['messageparser', 'show'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['moobotfactoids', 'most']))
            .toBe('prefix');
        expect(limnoriaCommandDelivery(['news', 'news'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['nickometer', 'nickometer']))
            .toBe('private');
        expect(limnoriaCommandDelivery(['poll', 'add'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['poll', 'list'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['praise', 'praise'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['quote', 'random'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['quote', 'replace'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['quotegrabs', 'grab'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['quotegrabs', 'say'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['rss', 'add'])).toBe('private');
        expect(limnoriaCommandDelivery(['rss', 'rss'])).toBe('private');
        expect(limnoriaCommandDelivery(['rss', 'announce', 'add']))
            .toBe('prefix');
        expect(limnoriaCommandDelivery(['rss', 'announce', 'channels']))
            .toBe('private');
        expect(limnoriaCommandDelivery(['relay', 'join'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['reply', 'reply'])).toBe('private');
        expect(limnoriaCommandDelivery(['scheduler', 'add'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['scheduler', 'list'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['services', 'op'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['services', 'identify']))
            .toBe('private');
        expect(limnoriaCommandDelivery(['services', 'nicks'])).toBe('private');
        expect(limnoriaCommandDelivery(['shrinkurl', 'tiny'])).toBe('private');
        expect(limnoriaCommandDelivery(['status', 'status'])).toBe('private');
        expect(limnoriaCommandDelivery(['status', 'network'])).toBe('private');
        expect(limnoriaCommandDelivery(['success', 'add'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['dunno', 'add'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['lart', 'get'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['praise', 'change'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['quote', 'stats'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['todo', 'add'])).toBe('private');
        expect(limnoriaCommandDelivery(['topic', 'undo'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['url', 'last'])).toBe('prefix');
        expect(limnoriaCommandDelivery(['unix', 'ping'])).toBe('private');
        expect(limnoriaCommandDelivery(['utilities', 'success']))
            .toBe('private');
        expect(limnoriaCommandDelivery(['web', 'title'])).toBe('private');
        expect(limnoriaCommandDelivery(['plugindownloader', 'install']))
            .toBe('private');
        expect(limnoriaCommandDelivery(['config', 'list'])).toBe('private');
        expect(limnoriaCommandDelivery(['admin', 'join'])).toBe('private');
        expect(limnoriaCommandDelivery(['owner', 'load'])).toBe('private');
        expect(limnoriaCommandDelivery(null)).toBe('private');
        expect(limnoriaCommandDelivery(['unknown', 'command'])).toBe('private');
    });
});

describe('limnoriaCommandSuggestions', () => {
    test('suggests next tokens instead of multi-word commands', () => {
        const first = limnoriaCommandSuggestions('/lim ');
        expect(first.map((item) => item.text))
            .toEqual(expect.arrayContaining(['admin', 'time', 'bold']));
        expect(first.every((item) => !/\s/.test(item.text))).toBe(true);

        ['/lim ', '/lim time ', '/lim channel ', '/lim channel capability ',
            '/lim rss announce '].forEach((input) => {
            expect(limnoriaCommandSuggestions(input)
                .every((item) => !/\s/.test(item.text))).toBe(true);
        });

        expect(suggestionTexts('/lim bold')).toEqual(['bold']);
        expect(suggestionTexts('/lim bold ')).toEqual([]);
        expect(suggestionTexts('/lim time ')).toEqual([
            'at',
            'ctime',
            'ddate',
            'elapsed',
            'seconds',
            'time',
            'tztime',
            'until',
        ]);
        expect(suggestionTexts('/lim time c')).toEqual(['ctime']);
        expect(suggestionTexts('/lim time ctime ')).toEqual([]);
        expect(suggestionTexts('/lim channel capability ')).toEqual([
            'add',
            'list',
            'remove',
            'set',
            'setdefault',
            'unset',
        ]);
        expect(suggestionTexts('/lim channel capability a')).toEqual(['add']);
        expect(suggestionTexts('/lim rss announce ')).toEqual([
            'add',
            'channels',
            'list',
            'remove',
        ]);
    });

    test('does not suggest ambiguous command shortcuts', () => {
        expect(suggestionTexts('/lim capability')).toEqual([]);
        expect(suggestionTexts('/lim list')).toEqual([
            'listauth',
            'listbans',
            'listkeys',
            'listvalues',
        ]);
        expect(suggestionTexts('/lim ignore')).toEqual([]);
        expect(suggestionTexts('/lim join')).toEqual([]);
        expect(suggestionTexts('/lim help')).toEqual([]);
    });

    test('gives plugin names precedence over matching command names', () => {
        expect(suggestionTexts('/lim config')).toEqual(['config']);
        expect(suggestionTexts('/lim channel')).toEqual(
            expect.arrayContaining(['channel', 'channels', 'channelstats'])
        );
        expect(suggestionTexts('/lim network')).toEqual(
            expect.arrayContaining(['network', 'networks'])
        );
        expect(suggestionTexts('/lim time')).toEqual(['time', 'timezone']);
        expect(suggestionTexts('/lim config ')).toEqual(
            expect.arrayContaining(['channel', 'config', 'network'])
        );
        expect(suggestionTexts('/lim time ')).toContain('ctime');
    });

    test('returns next-token command items with help metadata', () => {
        const [plugin] = limnoriaCommandSuggestions('/lim admin');
        expect(plugin).toEqual(expect.objectContaining({
            text: 'admin',
            description: 'Plugin',
            type: 'command',
            plugin: 'Admin',
            command: '',
        }));

        const [shortcut] = limnoriaCommandSuggestions('/lim bold');
        expect(shortcut).toEqual(expect.objectContaining({
            text: 'bold',
            description: 'format bold <text>',
            type: 'command',
            plugin: 'Format',
            command: 'bold',
        }));

        const [command] = limnoriaCommandSuggestions('/lim time c');
        expect(command).toEqual(expect.objectContaining({
            text: 'ctime',
            description: 'time ctime [<seconds since epoch>]',
            type: 'command',
            plugin: 'Time',
            command: 'ctime',
        }));
    });

    test('suggests commands after an explicit plugin prefix', () => {
        expect(suggestionTexts('/lim owner '))
            .toEqual(expect.arrayContaining(['load', 'reload', 'quit', 'flush']));
        expect(suggestionTexts('/lim config '))
            .toEqual(expect.arrayContaining(['list', 'help', 'reload', 'config']));
        expect(suggestionTexts('/lim admin '))
            .toEqual(expect.arrayContaining(['join', 'capability', 'ignore']));
        expect(suggestionTexts('/lim misc '))
            .toEqual(expect.arrayContaining(['list', 'help', 'last', 'tell']));
        expect(suggestionTexts('/lim channel '))
            .toEqual(expect.arrayContaining(['mode', 'lobotomy', 'ban', 'capability']));
        expect(suggestionTexts('/lim network '))
            .toEqual(expect.arrayContaining(['connect', 'capabilities', 'authenticate']));
        expect(suggestionTexts('/lim nickauth '))
            .toEqual(expect.arrayContaining(['nick', 'auth']));
        expect(suggestionTexts('/lim user '))
            .toEqual(expect.arrayContaining(['register', 'hostmask', 'identify']));
        expect(suggestionTexts('/lim ddg ')).toEqual(['search']);
        expect(suggestionTexts('/lim games '))
            .toEqual(['coin', 'dice', 'eightball', 'monologue', 'roulette']);
        expect(suggestionTexts('/lim geography '))
            .toEqual(['localtime', 'timezone']);
        expect(suggestionTexts('/lim hashes ')).toEqual([
            'algorithms',
            'md5',
            'mkhash',
            'sha',
            'sha256',
            'sha512',
        ]);
        expect(suggestionTexts('/lim math '))
            .toEqual(['base', 'calc', 'convert', 'icalc', 'rpn', 'units']);
        expect(suggestionTexts('/lim time ')).toEqual([
            'at',
            'ctime',
            'ddate',
            'elapsed',
            'seconds',
            'time',
            'tztime',
            'until',
        ]);
        expect(suggestionTexts('/lim note '))
            .toEqual(['list', 'next', 'note', 'reply', 'search', 'send', 'unsend']);
        expect(suggestionTexts('/lim plugin ')).toEqual([
            'author',
            'contributors',
            'help',
            'path',
            'plugin',
            'plugins',
        ]);
        expect(suggestionTexts('/lim seen '))
            .toEqual(['any', 'last', 'seen', 'since', 'user']);
        expect(suggestionTexts('/lim string ')).toEqual([
            'chr',
            'decode',
            'encode',
            'len',
            'levenshtein',
            'md5',
            'ord',
            're',
            'sha',
            'soundex',
            'unicodename',
            'unicodesearch',
            'xor',
        ]);
        expect(suggestionTexts('/lim aka ')).toEqual([
            'add',
            'importaliasdatabase',
            'list',
            'lock',
            'remove',
            'search',
            'set',
            'show',
            'unlock',
        ]);
        expect(suggestionTexts('/lim alias '))
            .toEqual(['add', 'list', 'lock', 'remove', 'unlock']);
        expect(suggestionTexts('/lim anonymous '))
            .toEqual(['do', 'react', 'say', 'tell']);
        expect(suggestionTexts('/lim badwords '))
            .toEqual(['add', 'list', 'remove']);
        expect(suggestionTexts('/lim channelstats '))
            .toEqual(['channelstats', 'rank', 'stats']);
        expect(suggestionTexts('/lim conditional ')).toEqual([
            'cand',
            'ceq',
            'cerror',
            'cif',
            'cor',
            'cxor',
            'ge',
            'gt',
            'le',
            'lt',
            'match',
            'nceq',
            'ne',
            'nge',
            'ngt',
            'nle',
            'nlt',
            'nne',
        ]);
        expect(suggestionTexts('/lim ctcp ')).toEqual(['version']);
        expect(suggestionTexts('/lim debug ')).toEqual([
            'channeldb',
            'collect',
            'environ',
            'eval',
            'exec',
            'exn',
            'sendquote',
            'settrace',
            'simpleeval',
            'unsettrace',
        ]);
        expect(suggestionTexts('/lim dict '))
            .toEqual(['dict', 'dictionaries', 'random', 'synonym']);
        expect(suggestionTexts('/lim dunno '))
            .toEqual(['add', 'change', 'get', 'remove', 'search', 'stats']);
        expect(suggestionTexts('/lim factoids ')).toEqual([
            'alias',
            'change',
            'forget',
            'info',
            'learn',
            'lock',
            'random',
            'rank',
            'search',
            'unlock',
            'whatis',
        ]);
        expect(suggestionTexts('/lim fediverse '))
            .toEqual(['featured', 'profile', 'status', 'statuses']);
        expect(suggestionTexts('/lim filter ')).toEqual([
            'aol',
            'binary',
            'caps',
            'capwords',
            'colorize',
            'gnu',
            'hebrew',
            'hexlify',
            'jeffk',
            'leet',
            'morse',
            'outfilter',
            'rainbow',
            'reverse',
            'rot13',
            'scramble',
            'shrink',
            'spellit',
            'squish',
            'stripcolor',
            'stripformatting',
            'supa1337',
            'unbinary',
            'undup',
            'unhexlify',
            'uniud',
            'unmorse',
            'uwu',
            'vowelrot',
        ]);
        expect(suggestionTexts('/lim format ')).toEqual([
            'bold',
            'capitalize',
            'color',
            'concat',
            'cut',
            'field',
            'format',
            'join',
            'lower',
            'replace',
            'repr',
            'reverse',
            'title',
            'translate',
            'underline',
            'upper',
        ]);
        expect(suggestionTexts('/lim gpg ')).toEqual(['key', 'signing']);
        expect(suggestionTexts('/lim gpg key '))
            .toEqual(['add', 'list', 'remove']);
        expect(suggestionTexts('/lim gpg signing '))
            .toEqual(['auth', 'gettoken']);
        expect(suggestionTexts('/lim google ')).toEqual(['translate']);
        expect(suggestionTexts('/lim herald '))
            .toEqual(['add', 'change', 'default', 'get', 'remove']);
        expect(suggestionTexts('/lim internet '))
            .toEqual(['dns', 'hexip', 'whois']);
        expect(suggestionTexts('/lim karma '))
            .toEqual(['clear', 'dump', 'karma', 'load', 'most']);
        expect(suggestionTexts('/lim dunno '))
            .toEqual(['add', 'change', 'get', 'remove', 'search', 'stats']);
        expect(suggestionTexts('/lim lart ')).toEqual([
            'add',
            'change',
            'get',
            'lart',
            'remove',
            'search',
            'stats',
        ]);
        expect(suggestionTexts('/lim later '))
            .toEqual(['notes', 'remove', 'tell', 'undo']);
        expect(suggestionTexts('/lim messageparser ')).toEqual([
            'add',
            'info',
            'list',
            'lock',
            'rank',
            'remove',
            'show',
            'unlock',
            'vacuum',
        ]);
        expect(suggestionTexts('/lim moobotfactoids ')).toEqual([
            'factinfo',
            'listauth',
            'listkeys',
            'listvalues',
            'literal',
            'lock',
            'most',
            'random',
            'remove',
            'unlock',
        ]);
        expect(suggestionTexts('/lim news '))
            .toEqual(['add', 'change', 'news', 'old', 'remove']);
        expect(suggestionTexts('/lim nickometer ')).toEqual(['nickometer']);
        expect(suggestionTexts('/lim poll '))
            .toEqual(['add', 'close', 'list', 'results', 'vote']);
        expect(suggestionTexts('/lim praise ')).toEqual([
            'add',
            'change',
            'get',
            'praise',
            'remove',
            'search',
            'stats',
        ]);
        expect(suggestionTexts('/lim quote ')).toEqual([
            'add',
            'change',
            'get',
            'random',
            'remove',
            'replace',
            'search',
            'stats',
        ]);
        expect(suggestionTexts('/lim quotegrabs ')).toEqual([
            'get',
            'grab',
            'list',
            'quote',
            'random',
            'say',
            'search',
            'ungrab',
        ]);
        expect(suggestionTexts('/lim rss '))
            .toEqual(['add', 'announce', 'info', 'remove', 'rss']);
        expect(suggestionTexts('/lim rss announce '))
            .toEqual(['add', 'channels', 'list', 'remove']);
        expect(suggestionTexts('/lim relay '))
            .toEqual(['join', 'nicks', 'part']);
        expect(suggestionTexts('/lim reply '))
            .toEqual(['action', 'notice', 'private', 'replies', 'reply']);
        expect(suggestionTexts('/lim scheduler '))
            .toEqual(['add', 'list', 'remind', 'remove', 'repeat']);
        expect(suggestionTexts('/lim services ')).toEqual([
            'chanserv',
            'ghost',
            'identify',
            'invite',
            'nicks',
            'nickserv',
            'op',
            'password',
            'register',
            'unban',
            'verify',
            'voice',
        ]);
        expect(suggestionTexts('/lim shrinkurl ')).toEqual(['tiny', 'ur1', 'x0']);
        expect(suggestionTexts('/lim status ')).toEqual([
            'cmd',
            'commands',
            'cpu',
            'net',
            'network',
            'processes',
            'server',
            'status',
            'threads',
            'uptime',
        ]);
        expect(suggestionTexts('/lim success '))
            .toEqual(['add', 'change', 'get', 'remove', 'search', 'stats']);
        expect(suggestionTexts('/lim todo '))
            .toEqual(['add', 'change', 'remove', 'search', 'setpriority', 'todo']);
        expect(suggestionTexts('/lim topic ')).toEqual([
            'add',
            'change',
            'default',
            'fit',
            'get',
            'insert',
            'list',
            'lock',
            'redo',
            'refresh',
            'remove',
            'reorder',
            'replace',
            'restore',
            'save',
            'separator',
            'set',
            'shuffle',
            'swap',
            'topic',
            'undo',
            'unlock',
        ]);
        expect(suggestionTexts('/lim url ')).toEqual(['last', 'stats']);
        expect(suggestionTexts('/lim unix ')).toEqual([
            'call',
            'crypt',
            'errno',
            'fortune',
            'pid',
            'ping',
            'ping6',
            'progstats',
            'shell',
            'spell',
            'sysuname',
            'sysuptime',
            'wtf',
        ]);
        expect(suggestionTexts('/lim utilities ')).toEqual([
            'apply',
            'countargs',
            'echo',
            'ignore',
            'last',
            'let',
            'sample',
            'shuffle',
            'sort',
            'success',
        ]);
        expect(suggestionTexts('/lim web ')).toEqual([
            'doctype',
            'fetch',
            'headers',
            'location',
            'size',
            'title',
            'urlquote',
            'urlunquote',
        ]);
        expect(suggestionTexts('/lim plugindownloader '))
            .toEqual(['info', 'install', 'repolist']);
    });

    test('filters commands inside a plugin prefix', () => {
        expect(suggestionTexts('/lim owner l').sort()).toEqual(['load', 'logmark']);
        expect(suggestionTexts('/lim config l')).toEqual(['list']);
        expect(suggestionTexts('/lim admin cap')).toEqual(['capability']);
    });

    test('suggests nested subcommands for both forms', () => {
        expect(suggestionTexts('/lim channel capability ')).toEqual([
            'add',
            'list',
            'remove',
            'set',
            'setdefault',
            'unset',
        ]);
        expect(suggestionTexts('/lim channel capability a')).toEqual(['add']);
        expect(suggestionTexts('/lim admin capability ')).toEqual(['add', 'remove']);
        expect(suggestionTexts('/lim admin capability a')).toEqual(['add']);
        expect(suggestionTexts('/lim channel lobotomy '))
            .toEqual(['add', 'list', 'remove']);
        expect(suggestionTexts('/lim nickauth nick '))
            .toEqual(['add', 'list', 'remove']);
        expect(suggestionTexts('/lim user set ')).toEqual(['password', 'secure']);
        expect(suggestionTexts('/lim user hostmask '))
            .toEqual(['add', 'hostmask', 'list', 'remove']);
        expect(suggestionTexts('/lim reset ')).toEqual(['channel', 'network']);
        expect(suggestionTexts('/lim config reset ')).toEqual(['channel', 'network']);
        expect(suggestionTexts('/lim config reset c')).toEqual(['channel']);
    });

    test('filters suggestions by the enabled plugin list', () => {
        const defaultPlugins = [
            'admin',
            'channel',
            'config',
            'misc',
            'owner',
            'user',
        ];
        const texts = suggestionTexts('/lim ', defaultPlugins);

        expect(texts).toEqual(expect.arrayContaining([
            'admin',
            'channel',
            'config',
            'misc',
            'owner',
            'user',
        ]));
        expect(texts).toContain('channels');
        expect(texts).not.toContain('games');
        expect(texts).not.toContain('ddg');
        expect(texts).not.toContain('string');

        expect(suggestionTexts('/lim games ', ['games']))
            .toEqual(['coin', 'dice', 'eightball', 'monologue', 'roulette']);
        expect(suggestionTexts('/lim games ', ['admin'])).toEqual([]);
    });

    test('keeps global ambiguity suppression when a plugin is disabled', () => {
        expect(suggestionTexts('/lim capability', ['admin'])).toEqual([]);
        expect(suggestionTexts('/lim capability', ['channel'])).toEqual([]);
        expect(suggestionTexts('/lim admin cap', ['admin']))
            .toEqual(['capability']);
    });

    test('disables all local suggestions with an empty plugin list', () => {
        expect(suggestionTexts('/lim ', [])).toEqual([]);
        expect(suggestionTexts('/lim games ', [])).toEqual([]);
    });

    test('does not suggest commands after entering arguments', () => {
        expect(suggestionTexts('/lim capability add ')).toEqual([]);
        expect(suggestionTexts('/lim admin capability add ')).toEqual([]);
        expect(suggestionTexts('/lim channel lobotomy add ')).toEqual([]);
        expect(suggestionTexts('/lim nickauth nick add ')).toEqual([]);
        expect(suggestionTexts('/lim user hostmask add ')).toEqual([]);
        expect(suggestionTexts('/lim network connect ')).toEqual([]);
        expect(suggestionTexts('/lim join ')).toEqual([]);
        expect(suggestionTexts('/lim list ')).toEqual([]);
        expect(suggestionTexts('/lim config list ')).toEqual([]);
        expect(suggestionTexts('/lim owner load ')).toEqual([]);
        expect(suggestionTexts('/lim reset channel ')).toEqual([]);
    });

    test('does not trigger outside /lim', () => {
        expect(suggestionTexts('/lim')).toEqual([]);
        expect(suggestionTexts('/msg SupyBot net')).toEqual([]);
        expect(suggestionTexts('!net')).toEqual([]);
        expect(suggestionTexts('hello')).toEqual([]);
        expect(suggestionTexts(null)).toEqual([]);
    });

    test('returns plugin-prefixed command items with full syntax', () => {
        const [item] = limnoriaCommandSuggestions('/lim owner load');

        expect(item).toEqual(expect.objectContaining({
            text: 'load',
            description: 'owner load [--deprecated] <plugin>',
            type: 'command',
            plugin: 'Owner',
        }));
    });

    test('does not produce duplicate suggestion text', () => {
        const texts = suggestionTexts('/lim ');
        expect(new Set(texts).size).toBe(texts.length);
    });
});
