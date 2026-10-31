'kiwi public';

// Limnoria core command data, transcribed from the upstream plugin sources:
// plugins/Admin, plugins/Config, plugins/Misc, and plugins/Owner.
//
// This table is deliberately static. It is used only for /lim completion and
// is offered even when the corresponding plugin is disabled or unloaded.
// Commands shared by multiple plugins are kept here; the suggestion helpers
// suppress their ambiguous shortcut forms.

export const LIMNORIA_COMMANDS = [
    {
        name: 'join',
        plugin: 'Admin',
        syntax: 'join <channel> [<key>]',
        help: 'Tells the bot to join the given channel, optionally using a key.',
    },
    {
        name: 'channels',
        plugin: 'Admin',
        syntax: 'channels',
        help: 'Returns the channels the bot is on.',
    },
    {
        name: 'nick',
        plugin: 'Admin',
        syntax: 'nick [<nick>] [<network>]',
        help: 'Changes the bot nick, or returns the current nick when none is given.',
    },
    {
        name: 'capability',
        plugin: 'Admin',
        syntax: 'capability <add|remove> <name|hostmask> <capability>',
        help: 'Adds or removes a capability from a user.',
        subcommands: [
            {
                name: 'add',
                syntax: 'capability add <name|hostmask> <capability>',
                help: 'Gives the specified user the specified capability.',
            },
            {
                name: 'remove',
                syntax: 'capability remove <name|hostmask> <capability>',
                help: 'Takes the specified capability from the specified user.',
            },
        ],
    },
    {
        name: 'ignore',
        plugin: 'Admin',
        syntax: 'ignore <add|remove|list> ...',
        help: 'Manages the persistent global ignore list.',
        subcommands: [
            {
                name: 'add',
                syntax: 'ignore add <hostmask|nick> [<expires>]',
                help: 'Adds a persistent ignore, optionally expiring after a number of seconds.',
            },
            {
                name: 'remove',
                syntax: 'ignore remove <hostmask|nick>',
                help: 'Removes the persistent ignore for a hostmask or nick.',
            },
            {
                name: 'list',
                syntax: 'ignore list',
                help: 'Lists the hostmasks that the bot is ignoring.',
            },
        ],
    },
    {
        name: 'clearq',
        plugin: 'Admin',
        syntax: 'clearq',
        help: 'Clears the current send queue for this network.',
    },
    {
        name: 'acmd',
        plugin: 'Admin',
        syntax: 'acmd <command> [<arg> ...]',
        help: 'Runs a command with its arguments on every channel on the current network.',
    },
    {
        name: 'list',
        plugin: 'Config',
        syntax: 'list <group>',
        help: 'Returns the configuration variables available under the given group.',
    },
    {
        name: 'search',
        plugin: 'Config',
        syntax: 'search <word>',
        help: 'Searches the current configuration variable names for a word.',
    },
    {
        name: 'searchhelp',
        plugin: 'Config',
        syntax: 'searchhelp <phrase>',
        help: 'Searches the help of configuration variables for a phrase.',
    },
    {
        name: 'searchvalues',
        plugin: 'Config',
        syntax: 'searchvalues <word>',
        help: 'Searches the values of configuration variables for a word.',
    },
    {
        name: 'channel',
        plugin: 'Config',
        syntax: 'channel [<network>] [<channel>] <name> [<value>]',
        help: 'Gets or sets a channel-specific configuration value.',
    },
    {
        name: 'network',
        plugin: 'Config',
        syntax: 'network [<network>] <name> [<value>]',
        help: 'Gets or sets a network-specific configuration value.',
    },
    {
        name: 'config',
        plugin: 'Config',
        syntax: 'config <name> [<value>]',
        help: 'Gets or sets a configuration value, with the leading supybot. optional.',
    },
    {
        name: 'help',
        plugin: 'Config',
        syntax: 'help <name>',
        help: 'Returns the description of the configuration variable <name>.',
    },
    {
        name: 'default',
        plugin: 'Config',
        syntax: 'default <name>',
        help: 'Returns the default value of a configuration variable.',
    },
    {
        name: 'reload',
        plugin: 'Config',
        syntax: 'reload',
        help: 'Reloads configuration files, the user database, the channel database, and the registry.',
    },
    {
        name: 'export',
        plugin: 'Config',
        syntax: 'export <filename>',
        help: 'Exports the public configuration values to a sanitized file.',
    },
    {
        name: 'setdefault',
        plugin: 'Config',
        syntax: 'setdefault <name>',
        help: 'Resets a configuration variable to its default value.',
    },
    {
        name: 'reset',
        plugin: 'Config',
        syntax: 'reset <channel|network> ...',
        help: 'Resets channel- or network-specific configuration values.',
        subcommands: [
            {
                name: 'channel',
                syntax: 'reset channel [<network>] [<channel>] <name>',
                help: 'Resets a channel-specific value so it inherits the network or global value.',
            },
            {
                name: 'network',
                syntax: 'reset network [<network>] <name>',
                help: 'Resets a network-specific value so it inherits the global value.',
            },
        ],
    },
    {
        name: 'list',
        plugin: 'Misc',
        syntax: 'list [--private] [--unloaded] [<plugin>]',
        help: 'Lists available plugins, or the commands in a given plugin.',
    },
    {
        name: 'apropos',
        plugin: 'Misc',
        syntax: 'apropos <string>',
        help: 'Searches the commands currently offered by the bot for a string.',
    },
    {
        name: 'help',
        plugin: 'Misc',
        syntax: 'help [<plugin>] [<command>]',
        help: 'Shows help for a command, or general help when no command is given.',
    },
    {
        name: 'version',
        plugin: 'Misc',
        syntax: 'version',
        help: 'Returns the version of the running bot.',
    },
    {
        name: 'source',
        plugin: 'Misc',
        syntax: 'source',
        help: 'Returns a URL for the bot source code.',
    },
    {
        name: 'more',
        plugin: 'Misc',
        syntax: 'more [<nick>]',
        help: 'Returns the next chunk of a truncated command response.',
    },
    {
        name: 'last',
        plugin: 'Misc',
        syntax: 'last [--{from,in,on,with,without,regexp} <value>] [--nolimit]',
        help: 'Returns the last message matching the given criteria.',
    },
    {
        name: 'tell',
        plugin: 'Misc',
        syntax: 'tell <nick> <text>',
        help: 'Tells the given nick a message the next time they speak.',
    },
    {
        name: 'noticetell',
        plugin: 'Misc',
        syntax: 'noticetell <nick> <text>',
        help: 'Like tell, but delivers the message as a notice.',
    },
    {
        name: 'ping',
        plugin: 'Misc',
        syntax: 'ping',
        help: 'Checks whether the bot is alive.',
    },
    {
        name: 'completenick',
        plugin: 'Misc',
        syntax: 'completenick [<channel>] <beginning> [--match-case]',
        help: 'Returns a nick on the channel that begins with the given text.',
    },
    {
        name: 'clearmores',
        plugin: 'Misc',
        syntax: 'clearmores',
        help: 'Clears all stored command continuations for the current network.',
    },
    {
        name: 'logmark',
        plugin: 'Owner',
        syntax: 'logmark <text>',
        help: 'Writes a critical-priority marker to the bot log.',
    },
    {
        name: 'announce',
        plugin: 'Owner',
        syntax: 'announce <text>',
        help: 'Sends a message to every non-lobotomized channel the bot is on.',
    },
    {
        name: 'defaultplugin',
        plugin: 'Owner',
        syntax: 'defaultplugin [--remove] <command> [<plugin>]',
        help: 'Gets or sets the default plugin for a command.',
    },
    {
        name: 'ircquote',
        plugin: 'Owner',
        syntax: 'ircquote <string to be sent to the server>',
        help: 'Sends a raw IRC line to the server.',
    },
    {
        name: 'quit',
        plugin: 'Owner',
        syntax: 'quit [<text>]',
        help: 'Exits the bot with the given quit message.',
    },
    {
        name: 'flush',
        plugin: 'Owner',
        syntax: 'flush',
        help: 'Runs all periodic flushers, including logs and configuration changes.',
    },
    {
        name: 'upkeep',
        plugin: 'Owner',
        syntax: 'upkeep [<level>]',
        help: 'Runs standard upkeep, optionally at the high level.',
    },
    {
        name: 'load',
        plugin: 'Owner',
        syntax: 'load [--deprecated] <plugin>',
        help: 'Loads a plugin and remembers it for future restarts.',
    },
    {
        name: 'reload',
        plugin: 'Owner',
        syntax: 'reload <plugin>',
        help: 'Unloads and reloads the named plugin.',
    },
    {
        name: 'unload',
        plugin: 'Owner',
        syntax: 'unload <plugin>',
        help: 'Unloads the named plugin and remembers not to load it again.',
    },
    {
        name: 'defaultcapability',
        plugin: 'Owner',
        syntax: 'defaultcapability {add|remove} <capability>',
        help: 'Adds or removes a capability from the default user capabilities.',
    },
    {
        name: 'disable',
        plugin: 'Owner',
        syntax: 'disable [<plugin>] <command>',
        help: 'Disables a command for all users.',
    },
    {
        name: 'enable',
        plugin: 'Owner',
        syntax: 'enable [<plugin>] <command>',
        help: 'Enables a previously disabled command for all users.',
    },
    {
        name: 'rename',
        plugin: 'Owner',
        syntax: 'rename <plugin> <command> <new name>',
        help: 'Renames a command in a plugin.',
    },
    {
        name: 'unrename',
        plugin: 'Owner',
        syntax: 'unrename <plugin>',
        help: 'Removes all command renames in a plugin and reloads it.',
    },
    {
        name: 'reloadlocale',
        plugin: 'Owner',
        syntax: 'reloadlocale',
        help: 'Reloads the bot locale.',
    },
    {
        name: 'mode',
        plugin: 'Channel',
        syntax: 'mode [<channel>] <mode> [<arg> ...]',
        help: 'Sets a channel mode and its arguments.',
    },
    {
        name: 'limit',
        plugin: 'Channel',
        syntax: 'limit [<channel>] [<limit>]',
        help: 'Sets or removes the channel user limit.',
    },
    {
        name: 'moderate',
        plugin: 'Channel',
        syntax: 'moderate [<channel>]',
        help: 'Sets +m so only ops and voiced users can speak.',
    },
    {
        name: 'unmoderate',
        plugin: 'Channel',
        syntax: 'unmoderate [<channel>]',
        help: 'Removes +m from the channel.',
    },
    {
        name: 'key',
        plugin: 'Channel',
        syntax: 'key [<channel>] [<key>]',
        help: 'Sets or removes the channel keyword.',
    },
    {
        name: 'op',
        plugin: 'Channel',
        syntax: 'op [<channel>] [<nick> ...]',
        help: 'Gives operator status to the given nicks, or to you.',
    },
    {
        name: 'halfop',
        plugin: 'Channel',
        syntax: 'halfop [<channel>] [<nick> ...]',
        help: 'Gives half-operator status to the given nicks, or to you.',
    },
    {
        name: 'voice',
        plugin: 'Channel',
        syntax: 'voice [<channel>] [<nick> ...]',
        help: 'Gives voice to the given nicks, or to you.',
    },
    {
        name: 'deop',
        plugin: 'Channel',
        syntax: 'deop [<channel>] [<nick> ...]',
        help: 'Removes operator status from the given nicks, or from you.',
    },
    {
        name: 'dehalfop',
        plugin: 'Channel',
        syntax: 'dehalfop [<channel>] [<nick> ...]',
        help: 'Removes half-operator status from the given nicks, or from you.',
    },
    {
        name: 'devoice',
        plugin: 'Channel',
        syntax: 'devoice [<channel>] [<nick> ...]',
        help: 'Removes voice from the given nicks, or from you.',
    },
    {
        name: 'cycle',
        plugin: 'Channel',
        syntax: 'cycle [<channel>] [<reason>]',
        help: 'Parts and rejoins the channel.',
    },
    {
        name: 'kick',
        plugin: 'Channel',
        syntax: 'kick [<channel>] <nick>[, <nick>, ...] [<reason>]',
        help: 'Kicks one or more nicks from the channel.',
    },
    {
        name: 'kban',
        plugin: 'Channel',
        syntax: 'kban [<channel>] [--{exact,nick,user,host,account}] <nick> [<seconds>] [<reason>]',
        help: 'Kicks and bans a nick for an optional duration.',
    },
    {
        name: 'iban',
        plugin: 'Channel',
        syntax: 'iban [<channel>] [--{exact,nick,user,host}] <nick> [<seconds>]',
        help: 'Bans a nick for an optional duration without kicking.',
    },
    {
        name: 'unban',
        plugin: 'Channel',
        syntax: 'unban [<channel>] [<hostmask|--all>]',
        help: 'Removes a channel ban.',
    },
    {
        name: 'listbans',
        plugin: 'Channel',
        syntax: 'listbans [<channel>]',
        help: 'Lists channel bans.',
    },
    {
        name: 'invite',
        plugin: 'Channel',
        syntax: 'invite [<channel>] <nick>',
        help: 'Invites a nick to the channel.',
    },
    {
        name: 'disable',
        plugin: 'Channel',
        syntax: 'disable [<channel>] [<plugin>] [<command>]',
        help: 'Disables a command in the channel.',
    },
    {
        name: 'enable',
        plugin: 'Channel',
        syntax: 'enable [<channel>] [<plugin>] [<command>]',
        help: 'Enables a previously disabled command in the channel.',
    },
    {
        name: 'nicks',
        plugin: 'Channel',
        syntax: 'nicks [<channel>] [--count]',
        help: 'Lists the nicks in the channel.',
    },
    {
        name: 'alert',
        plugin: 'Channel',
        syntax: 'alert [<channel>] <text>',
        help: 'Sends text to channel operators.',
    },
    {
        name: 'part',
        plugin: 'Channel',
        syntax: 'part [<channel>] [<reason>]',
        help: 'Parts the channel.',
    },
    {
        name: 'lobotomy',
        plugin: 'Channel',
        syntax: 'lobotomy <add|remove|list> ...',
        help: 'Makes the bot silent and unanswering in the channel.',
        subcommands: [
            {
                name: 'add',
                syntax: 'lobotomy add [<channel>]',
                help: 'Makes the bot silent and unanswering in the channel.',
            },
            {
                name: 'remove',
                syntax: 'lobotomy remove [<channel>]',
                help: 'Makes the bot respond in the channel again.',
            },
            {
                name: 'list',
                syntax: 'lobotomy list',
                help: 'Lists the channels where the bot is lobotomized.',
            },
        ],
    },
    {
        name: 'ban',
        plugin: 'Channel',
        syntax: 'ban <hostmask|add|remove|list> ...',
        help: 'Manages persistent channel bans.',
        subcommands: [
            {
                name: 'hostmask',
                syntax: 'ban hostmask [<channel>] <banmask>',
                help: 'Bans a hostmask from the channel.',
            },
            {
                name: 'add',
                syntax: 'ban add [<channel>] <nick|hostmask> [<expires>]',
                help: 'Adds a persistent channel ban.',
            },
            {
                name: 'remove',
                syntax: 'ban remove [<channel>] <hostmask>',
                help: 'Removes a persistent channel ban.',
            },
            {
                name: 'list',
                syntax: 'ban list [<channel>] [<mask>]',
                help: 'Lists persistent channel bans.',
            },
        ],
    },
    {
        name: 'ignore',
        plugin: 'Channel',
        syntax: 'ignore <add|remove|list> ...',
        help: 'Manages persistent channel ignores.',
        subcommands: [
            {
                name: 'add',
                syntax: 'ignore add [<channel>] <nick|hostmask> [<expires>]',
                help: 'Adds a persistent channel ignore.',
            },
            {
                name: 'remove',
                syntax: 'ignore remove [<channel>] <nick|hostmask>',
                help: 'Removes a persistent channel ignore.',
            },
            {
                name: 'list',
                syntax: 'ignore list [<channel>]',
                help: 'Lists persistent channel ignores.',
            },
        ],
    },
    {
        name: 'capability',
        plugin: 'Channel',
        syntax: 'capability <add|remove|setdefault|set|unset|list> ...',
        help: 'Manages channel capabilities.',
        subcommands: [
            {
                name: 'add',
                syntax: 'capability add [<channel>] <nick|username> <capability> [<capability> ...]',
                help: 'Gives a user one or more channel capabilities.',
            },
            {
                name: 'remove',
                syntax: 'capability remove [<channel>] <name|hostmask> <capability> [<capability> ...]',
                help: 'Removes one or more channel capabilities from a user.',
            },
            {
                name: 'setdefault',
                syntax: 'capability setdefault [<channel>] {True|False}',
                help: 'Sets the default non-power channel capability response.',
            },
            {
                name: 'set',
                syntax: 'capability set [<channel>] <capability> [<capability> ...]',
                help: 'Adds channel capabilities for all users.',
            },
            {
                name: 'unset',
                syntax: 'capability unset [<channel>] <capability> [<capability> ...]',
                help: 'Removes channel capabilities for all users.',
            },
            {
                name: 'list',
                syntax: 'capability list [<channel>]',
                help: 'Lists capabilities present on the channel.',
            },
        ],
    },
    {
        name: 'connect',
        plugin: 'Network',
        syntax: 'connect [--nossl] <network> [<host[:port]>] [<password>]',
        help: 'Connects the bot to another network.',
    },
    {
        name: 'disconnect',
        plugin: 'Network',
        syntax: 'disconnect <network> [<quit message>]',
        help: 'Disconnects from a network.',
    },
    {
        name: 'reconnect',
        plugin: 'Network',
        syntax: 'reconnect [<network>] [<quit message>]',
        help: 'Reconnects to a network.',
    },
    {
        name: 'command',
        plugin: 'Network',
        syntax: 'command <network> <command> [<arg> ...]',
        help: 'Runs a command on another network.',
    },
    {
        name: 'cmdall',
        plugin: 'Network',
        syntax: 'cmdall <command> [<arg> ...]',
        help: 'Runs a command on all networks.',
    },
    {
        name: 'whois',
        plugin: 'Network',
        syntax: 'whois [<network>] <nick>',
        help: 'Returns WHOIS output from a network.',
    },
    {
        name: 'whowas',
        plugin: 'Network',
        syntax: 'whowas [<network>] <nick>',
        help: 'Returns WHOWAS output from a network.',
    },
    {
        name: 'networks',
        plugin: 'Network',
        syntax: 'networks [--all]',
        help: 'Lists connected or known networks.',
    },
    {
        name: 'latency',
        plugin: 'Network',
        syntax: 'latency [<network>]',
        help: 'Returns the current latency to a network.',
    },
    {
        name: 'driver',
        plugin: 'Network',
        syntax: 'driver [<network>]',
        help: 'Returns the network driver.',
    },
    {
        name: 'uptime',
        plugin: 'Network',
        syntax: 'uptime [<network>]',
        help: 'Returns how long the bot has been connected.',
    },
    {
        name: 'capabilities',
        plugin: 'Network',
        syntax: 'capabilities [<network>]',
        help: 'Lists IRCv3 capabilities available on a network.',
    },
    {
        name: 'authenticate',
        plugin: 'Network',
        syntax: 'authenticate',
        help: 'Manually starts SASL authentication.',
    },
    {
        name: 'nick',
        plugin: 'NickAuth',
        syntax: 'nick <add|remove|list> ...',
        help: 'Manages network services accounts linked to a bot user.',
        subcommands: [
            {
                name: 'add',
                syntax: 'nick add [<network>] [<bot username>] <account>',
                help: 'Links a network services account to a bot user.',
            },
            {
                name: 'remove',
                syntax: 'nick remove [<network>] [<bot username>] <account>',
                help: 'Unlinks a network services account from a bot user.',
            },
            {
                name: 'list',
                syntax: 'nick list [<network>] [<bot username>]',
                help: 'Lists linked network services accounts.',
            },
        ],
    },
    {
        name: 'auth',
        plugin: 'NickAuth',
        syntax: 'auth',
        help: 'Authenticates using network services.',
    },
    {
        name: 'list',
        plugin: 'User',
        syntax: 'list [--capability=<capability>] [<glob>]',
        help: 'Lists registered usernames.',
    },
    {
        name: 'register',
        plugin: 'User',
        syntax: 'register <name> <password>',
        help: 'Registers a bot user.',
    },
    {
        name: 'unregister',
        plugin: 'User',
        syntax: 'unregister <name> [<password>]',
        help: 'Unregisters a bot user.',
    },
    {
        name: 'changename',
        plugin: 'User',
        syntax: 'changename <name> <new name> [<password>]',
        help: 'Changes a bot username.',
    },
    {
        name: 'username',
        plugin: 'User',
        syntax: 'username <hostmask|nick>',
        help: 'Returns the bot username for a hostmask or nick.',
    },
    {
        name: 'set',
        plugin: 'User',
        syntax: 'set <password|secure> ...',
        help: 'Changes user password or secure settings.',
        subcommands: [
            {
                name: 'password',
                syntax: 'set password [<name>] <old password> <new password>',
                help: 'Sets a user password.',
            },
            {
                name: 'secure',
                syntax: 'set secure <password> [<True|False>]',
                help: 'Sets the secure flag for a user.',
            },
        ],
    },
    {
        name: 'hostmask',
        plugin: 'User',
        syntax: 'hostmask <hostmask|list|add|remove> ...',
        help: 'Manages hostmasks for a bot user.',
        subcommands: [
            {
                name: 'hostmask',
                syntax: 'hostmask hostmask [<nick>]',
                help: 'Returns the hostmask for a nick.',
            },
            {
                name: 'list',
                syntax: 'hostmask list [<name>]',
                help: 'Lists hostmasks for a user.',
            },
            {
                name: 'add',
                syntax: 'hostmask add [<name>] [<hostmask>] [<password>]',
                help: 'Adds a hostmask to a user.',
            },
            {
                name: 'remove',
                syntax: 'hostmask remove [<name>] [<hostmask>] [<password>]',
                help: 'Removes a hostmask from a user.',
            },
        ],
    },
    {
        name: 'capabilities',
        plugin: 'User',
        syntax: 'capabilities [<name>]',
        help: 'Lists a user capabilities.',
    },
    {
        name: 'identify',
        plugin: 'User',
        syntax: 'identify <name> <password>',
        help: 'Identifies as a bot user.',
    },
    {
        name: 'unidentify',
        plugin: 'User',
        syntax: 'unidentify',
        help: 'Clears the current authentication.',
    },
    {
        name: 'whoami',
        plugin: 'User',
        syntax: 'whoami',
        help: 'Returns the current bot username.',
    },
    {
        name: 'stats',
        plugin: 'User',
        syntax: 'stats',
        help: 'Returns user database statistics.',
    },
    {
        name: 'search',
        plugin: 'DDG',
        syntax: 'search <text>',
        help: 'Searches DuckDuckGo for the given text.',
    },
    {
        name: 'coin',
        plugin: 'Games',
        syntax: 'coin',
        help: 'Flips a coin and returns the result.',
    },
    {
        name: 'dice',
        plugin: 'Games',
        syntax: 'dice <dice>d<sides>',
        help: 'Rolls the requested number of dice with the given number of sides.',
    },
    {
        name: 'eightball',
        plugin: 'Games',
        syntax: 'eightball [<question>]',
        help: 'Answers a question like a Magic Eight Ball.',
    },
    {
        name: 'roulette',
        plugin: 'Games',
        syntax: 'roulette [spin]',
        help: 'Fires the revolver, optionally spinning the chambers first.',
    },
    {
        name: 'monologue',
        plugin: 'Games',
        syntax: 'monologue [<channel>]',
        help: 'Counts your current uninterrupted line streak in the channel.',
    },
    {
        name: 'localtime',
        plugin: 'Geography',
        syntax: 'localtime <location name to search>',
        help: 'Returns the current local time for a location.',
    },
    {
        name: 'timezone',
        plugin: 'Geography',
        syntax: 'timezone <location name to search>',
        help: 'Returns the timezone used in a location.',
    },
    {
        name: 'md5',
        plugin: 'Hashes',
        syntax: 'md5 <text>',
        help: 'Returns the MD5 hash of the given text.',
    },
    {
        name: 'sha',
        plugin: 'Hashes',
        syntax: 'sha <text>',
        help: 'Returns the SHA1 hash of the given text.',
    },
    {
        name: 'sha256',
        plugin: 'Hashes',
        syntax: 'sha256 <text>',
        help: 'Returns the SHA256 hash of the given text.',
    },
    {
        name: 'sha512',
        plugin: 'Hashes',
        syntax: 'sha512 <text>',
        help: 'Returns the SHA512 hash of the given text.',
    },
    {
        name: 'algorithms',
        plugin: 'Hashes',
        syntax: 'algorithms',
        help: 'Lists the hash algorithms available on the bot.',
    },
    {
        name: 'mkhash',
        plugin: 'Hashes',
        syntax: 'mkhash <algorithm> <text>',
        help: 'Hashes text with the selected algorithm.',
    },
    {
        name: 'base',
        plugin: 'Math',
        syntax: 'base <fromBase> [<toBase>] <number>',
        help: 'Converts a number between bases 2 and 36.',
    },
    {
        name: 'calc',
        plugin: 'Math',
        syntax: 'calc <math expression>',
        help: 'Evaluates a floating-point math expression.',
    },
    {
        name: 'icalc',
        plugin: 'Math',
        syntax: 'icalc <math expression>',
        help: 'Evaluates an integer math expression for trusted users.',
    },
    {
        name: 'rpn',
        plugin: 'Math',
        syntax: 'rpn <rpn math expression>',
        help: 'Evaluates a reverse Polish notation expression.',
    },
    {
        name: 'convert',
        plugin: 'Math',
        syntax: 'convert <number> <unit1> <unit2>',
        help: 'Converts a number between units.',
    },
    {
        name: 'units',
        plugin: 'Math',
        syntax: 'units <type>',
        help: 'Lists units available for conversion.',
    },
    {
        name: 'seconds',
        plugin: 'Time',
        syntax: 'seconds [<years>y] [<weeks>w] [<days>d] [<hours>h] [<minutes>m] [<seconds>s]',
        help: 'Converts a duration into seconds.',
    },
    {
        name: 'at',
        plugin: 'Time',
        syntax: 'at [<time string>]',
        help: 'Returns the epoch time for a time string.',
    },
    {
        name: 'until',
        plugin: 'Time',
        syntax: 'until <time string>',
        help: 'Returns the number of seconds until a time string.',
    },
    {
        name: 'ctime',
        plugin: 'Time',
        syntax: 'ctime [<seconds since epoch>]',
        help: 'Returns the ctime for an epoch timestamp.',
    },
    {
        name: 'time',
        plugin: 'Time',
        syntax: 'time [<channel>] [<format>] [<seconds since epoch>]',
        help: 'Returns the current time in the requested format.',
    },
    {
        name: 'elapsed',
        plugin: 'Time',
        syntax: 'elapsed <seconds>',
        help: 'Formats a duration in seconds as a readable string.',
    },
    {
        name: 'tztime',
        plugin: 'Time',
        syntax: 'tztime <region>/<city>',
        help: 'Returns the local time for an IANA timezone.',
    },
    {
        name: 'ddate',
        plugin: 'Time',
        syntax: 'ddate [<year> <month> <day>]',
        help: 'Returns the Discordian date for today or a given date.',
    },
    {
        name: 'send',
        plugin: 'Note',
        syntax: 'send <recipient>[, <recipient>, ...] <text>',
        help: 'Sends a note to one or more bot users.',
    },
    {
        name: 'reply',
        plugin: 'Note',
        syntax: 'reply <id> <text>',
        help: 'Replies to a note by id.',
    },
    {
        name: 'unsend',
        plugin: 'Note',
        syntax: 'unsend <id>',
        help: 'Unsends an unread note you authored.',
    },
    {
        name: 'note',
        plugin: 'Note',
        syntax: 'note <id>',
        help: 'Retrieves a single note by id.',
    },
    {
        name: 'search',
        plugin: 'Note',
        syntax: 'search [--regexp <value>] [--sent] [<glob>]',
        help: 'Searches your notes.',
    },
    {
        name: 'list',
        plugin: 'Note',
        syntax: 'list [--old] [--sent] [--from <user>] [--to <user>]',
        help: 'Lists your notes.',
    },
    {
        name: 'next',
        plugin: 'Note',
        syntax: 'next',
        help: 'Retrieves your next unread note.',
    },
    {
        name: 'help',
        plugin: 'Plugin',
        syntax: 'help <plugin>',
        help: 'Returns the description of a plugin.',
    },
    {
        name: 'plugin',
        plugin: 'Plugin',
        syntax: 'plugin <command>',
        help: 'Returns the plugin that provides a command.',
    },
    {
        name: 'plugins',
        plugin: 'Plugin',
        syntax: 'plugins <command>',
        help: 'Returns all plugins that provide a command.',
    },
    {
        name: 'path',
        plugin: 'Plugin',
        syntax: 'path <name>',
        help: 'Returns the path a plugin was loaded from.',
    },
    {
        name: 'author',
        plugin: 'Plugin',
        syntax: 'author <plugin>',
        help: 'Returns the author of a plugin.',
    },
    {
        name: 'contributors',
        plugin: 'Plugin',
        syntax: 'contributors <plugin> [<name>]',
        help: 'Lists contributors to a plugin.',
    },
    {
        name: 'seen',
        plugin: 'Seen',
        syntax: 'seen [<channel>] <nick>',
        help: 'Returns the last time a nick was seen speaking.',
    },
    {
        name: 'any',
        plugin: 'Seen',
        syntax: 'any [<channel>] [--user <name>] [<nick>]',
        help: 'Returns the last activity seen for a nick or channel.',
    },
    {
        name: 'last',
        plugin: 'Seen',
        syntax: 'last [<channel>]',
        help: 'Returns the last thing said in a channel.',
    },
    {
        name: 'user',
        plugin: 'Seen',
        syntax: 'user [<channel>] <name>',
        help: 'Returns the last time a bot user was seen.',
    },
    {
        name: 'since',
        plugin: 'Seen',
        syntax: 'since [<channel>] [<nick>]',
        help: 'Returns messages since a nick last left the channel.',
    },
    {
        name: 'ord',
        plugin: 'String',
        syntax: 'ord <string>',
        help: 'Returns the Unicode codepoints of a string.',
    },
    {
        name: 'chr',
        plugin: 'String',
        syntax: 'chr <number>',
        help: 'Returns the Unicode character for a codepoint.',
    },
    {
        name: 'unicodename',
        plugin: 'String',
        syntax: 'unicodename <string>',
        help: 'Returns Unicode character names.',
    },
    {
        name: 'unicodesearch',
        plugin: 'String',
        syntax: 'unicodesearch <name>',
        help: 'Looks up a Unicode character by name.',
    },
    {
        name: 'encode',
        plugin: 'String',
        syntax: 'encode <encoding> <text>',
        help: 'Encodes text with a Python codec.',
    },
    {
        name: 'decode',
        plugin: 'String',
        syntax: 'decode <encoding> <text>',
        help: 'Decodes text with a Python codec.',
    },
    {
        name: 'levenshtein',
        plugin: 'String',
        syntax: 'levenshtein <string1> <string2>',
        help: 'Returns the edit distance between two strings.',
    },
    {
        name: 'soundex',
        plugin: 'String',
        syntax: 'soundex <string> [<length>]',
        help: 'Returns the Soundex hash of a string.',
    },
    {
        name: 'len',
        plugin: 'String',
        syntax: 'len <text>',
        help: 'Returns the length of text.',
    },
    {
        name: 're',
        plugin: 'String',
        syntax: 're <regexp> <text>',
        help: 'Matches or replaces text with a regular expression.',
    },
    {
        name: 'xor',
        plugin: 'String',
        syntax: 'xor <password> <text>',
        help: 'XOR-encrypts text with a password.',
    },
    {
        name: 'md5',
        plugin: 'String',
        syntax: 'md5 <text>',
        help: 'Returns the MD5 hash of text.',
    },
    {
        name: 'sha',
        plugin: 'String',
        syntax: 'sha <text>',
        help: 'Returns the SHA1 hash of text.',
    },
    {
        name: 'add',
        plugin: 'Aka',
        syntax: 'add [--channel <#channel>] <name> <command>',
        help: 'Defines an Aka alias.',
    },
    {
        name: 'set',
        plugin: 'Aka',
        syntax: 'set [--channel <#channel>] <name> <command>',
        help: 'Overwrites an existing Aka alias.',
    },
    {
        name: 'remove',
        plugin: 'Aka',
        syntax: 'remove [--channel <#channel>] <name>',
        help: 'Removes an unlocked Aka alias.',
    },
    {
        name: 'lock',
        plugin: 'Aka',
        syntax: 'lock [--channel <#channel>] <alias>',
        help: 'Locks an Aka alias.',
    },
    {
        name: 'unlock',
        plugin: 'Aka',
        syntax: 'unlock [--channel <#channel>] <alias>',
        help: 'Unlocks an Aka alias.',
    },
    {
        name: 'show',
        plugin: 'Aka',
        syntax: 'show [--channel <#channel>] <alias>',
        help: 'Shows an Aka alias definition.',
    },
    {
        name: 'importaliasdatabase',
        plugin: 'Aka',
        syntax: 'importaliasdatabase',
        help: 'Imports Alias plugin aliases into Aka.',
    },
    {
        name: 'list',
        plugin: 'Aka',
        syntax: 'list [--channel <#channel>] [--keys] [--unlocked|--locked]',
        help: 'Lists Aka aliases.',
    },
    {
        name: 'search',
        plugin: 'Aka',
        syntax: 'search [--channel <#channel>] <query>',
        help: 'Searches Aka aliases.',
    },
    {
        name: 'lock',
        plugin: 'Alias',
        syntax: 'lock <alias>',
        help: 'Locks an alias.',
    },
    {
        name: 'unlock',
        plugin: 'Alias',
        syntax: 'unlock <alias>',
        help: 'Unlocks an alias.',
    },
    {
        name: 'add',
        plugin: 'Alias',
        syntax: 'add <name> <command>',
        help: 'Defines an alias.',
    },
    {
        name: 'remove',
        plugin: 'Alias',
        syntax: 'remove <name>',
        help: 'Removes an unlocked alias.',
    },
    {
        name: 'list',
        plugin: 'Alias',
        syntax: 'list [--locked|--unlocked]',
        help: 'Lists aliases.',
    },
    {
        name: 'say',
        plugin: 'Anonymous',
        syntax: 'say <channel> <text>',
        help: 'Sends text to a channel anonymously.',
    },
    {
        name: 'tell',
        plugin: 'Anonymous',
        syntax: 'tell <nick> <text>',
        help: 'Sends text to a nick anonymously.',
    },
    {
        name: 'do',
        plugin: 'Anonymous',
        syntax: 'do <channel> <action>',
        help: 'Performs an action in a channel anonymously.',
    },
    {
        name: 'react',
        plugin: 'Anonymous',
        syntax: 'react <channel> <reaction> <nick>',
        help: 'Reacts to a nick last message anonymously.',
    },
    {
        name: 'list',
        plugin: 'BadWords',
        syntax: 'list',
        help: 'Lists censored words.',
    },
    {
        name: 'add',
        plugin: 'BadWords',
        syntax: 'add <word> [<word> ...]',
        help: 'Adds censored words.',
    },
    {
        name: 'remove',
        plugin: 'BadWords',
        syntax: 'remove <word> [<word> ...]',
        help: 'Removes censored words.',
    },
    {
        name: 'stats',
        plugin: 'ChannelStats',
        syntax: 'stats [<channel>] [<name>]',
        help: 'Returns channel statistics for a user.',
    },
    {
        name: 'rank',
        plugin: 'ChannelStats',
        syntax: 'rank [<channel>] <stat expression>',
        help: 'Ranks users by a statistics expression.',
    },
    {
        name: 'channelstats',
        plugin: 'ChannelStats',
        syntax: 'channelstats [<channel>]',
        help: 'Returns statistics for a channel.',
    },
    {
        name: 'cif',
        plugin: 'Conditional',
        syntax: 'cif <condition> <ifcommand> <elsecommand>',
        help: 'Runs one command based on a condition.',
    },
    {
        name: 'cand',
        plugin: 'Conditional',
        syntax: 'cand <cond1> [<cond2> ... <condN>]',
        help: 'Returns true if all conditions are true.',
    },
    {
        name: 'cor',
        plugin: 'Conditional',
        syntax: 'cor <cond1> [<cond2> ... <condN>]',
        help: 'Returns true if any condition is true.',
    },
    {
        name: 'cxor',
        plugin: 'Conditional',
        syntax: 'cxor <cond1> [<cond2> ... <condN>]',
        help: 'Returns true if exactly one condition is true.',
    },
    {
        name: 'ceq',
        plugin: 'Conditional',
        syntax: 'ceq <item1> <item2>',
        help: 'Returns true if two strings are equal.',
    },
    {
        name: 'ne',
        plugin: 'Conditional',
        syntax: 'ne <item1> <item2>',
        help: 'Returns true if two strings are not equal.',
    },
    {
        name: 'gt',
        plugin: 'Conditional',
        syntax: 'gt <item1> <item2>',
        help: 'Returns true if the first string is greater.',
    },
    {
        name: 'ge',
        plugin: 'Conditional',
        syntax: 'ge <item1> <item2>',
        help: 'Returns true if the first string is greater or equal.',
    },
    {
        name: 'lt',
        plugin: 'Conditional',
        syntax: 'lt <item1> <item2>',
        help: 'Returns true if the first string is less.',
    },
    {
        name: 'le',
        plugin: 'Conditional',
        syntax: 'le <item1> <item2>',
        help: 'Returns true if the first string is less or equal.',
    },
    {
        name: 'match',
        plugin: 'Conditional',
        syntax: 'match [--case-insensitive] <item1> <item2>',
        help: 'Returns true if the first item is a substring of the second.',
    },
    {
        name: 'nceq',
        plugin: 'Conditional',
        syntax: 'nceq <item1> <item2>',
        help: 'Returns true if two numbers are equal.',
    },
    {
        name: 'nne',
        plugin: 'Conditional',
        syntax: 'nne <item1> <item2>',
        help: 'Returns true if two numbers are not equal.',
    },
    {
        name: 'ngt',
        plugin: 'Conditional',
        syntax: 'ngt <item1> <item2>',
        help: 'Returns true if the first number is greater.',
    },
    {
        name: 'nge',
        plugin: 'Conditional',
        syntax: 'nge <item1> <item2>',
        help: 'Returns true if the first number is greater or equal.',
    },
    {
        name: 'nlt',
        plugin: 'Conditional',
        syntax: 'nlt <item1> <item2>',
        help: 'Returns true if the first number is less.',
    },
    {
        name: 'nle',
        plugin: 'Conditional',
        syntax: 'nle <item1> <item2>',
        help: 'Returns true if the first number is less or equal.',
    },
    {
        name: 'cerror',
        plugin: 'Conditional',
        syntax: 'cerror <testcommand>',
        help: 'Returns true if the test command raises an error.',
    },
    {
        name: 'version',
        plugin: 'Ctcp',
        syntax: 'version [<channel>] [--nicks]',
        help: 'Sends CTCP VERSION and returns the replies.',
    },
    {
        name: 'eval',
        plugin: 'Debug',
        syntax: 'eval <expression>',
        help: 'Evaluates a Python expression.',
    },
    {
        name: 'exec',
        plugin: 'Debug',
        syntax: 'exec <statement>',
        help: 'Executes Python code.',
    },
    {
        name: 'simpleeval',
        plugin: 'Debug',
        syntax: 'simpleeval <expression>',
        help: 'Evaluates an expression.',
    },
    {
        name: 'exn',
        plugin: 'Debug',
        syntax: 'exn <exception name>',
        help: 'Raises the named exception.',
    },
    {
        name: 'sendquote',
        plugin: 'Debug',
        syntax: 'sendquote <raw IRC message>',
        help: 'Sends a raw IRC message immediately.',
    },
    {
        name: 'settrace',
        plugin: 'Debug',
        syntax: 'settrace [<filename>]',
        help: 'Starts tracing function calls.',
    },
    {
        name: 'unsettrace',
        plugin: 'Debug',
        syntax: 'unsettrace',
        help: 'Stops tracing function calls.',
    },
    {
        name: 'channeldb',
        plugin: 'Debug',
        syntax: 'channeldb [<channel>]',
        help: 'Returns the channel database converter result.',
    },
    {
        name: 'collect',
        plugin: 'Debug',
        syntax: 'collect [<times>]',
        help: 'Runs garbage collection.',
    },
    {
        name: 'environ',
        plugin: 'Debug',
        syntax: 'environ',
        help: 'Returns the bot process environment.',
    },
    {
        name: 'dictionaries',
        plugin: 'Dict',
        syntax: 'dictionaries',
        help: 'Lists available dictionaries.',
    },
    {
        name: 'random',
        plugin: 'Dict',
        syntax: 'random',
        help: 'Returns a random dictionary entry.',
    },
    {
        name: 'dict',
        plugin: 'Dict',
        syntax: 'dict <words>',
        help: 'Looks up words in a dictionary.',
    },
    {
        name: 'synonym',
        plugin: 'Dict',
        syntax: 'synonym <words>',
        help: 'Looks up synonyms for words.',
    },
    {
        name: 'learn',
        plugin: 'Factoids',
        syntax: 'learn [<channel>] <key> is <value>',
        help: 'Associates a factoid key with a value.',
    },
    {
        name: 'whatis',
        plugin: 'Factoids',
        syntax: 'whatis [<channel>] [--raw] <key> [<number>]',
        help: 'Looks up a factoid by key.',
    },
    {
        name: 'alias',
        plugin: 'Factoids',
        syntax: 'alias [<channel>] <oldkey> <newkey> [<number>]',
        help: 'Adds a new factoid key for an existing factoid.',
    },
    {
        name: 'rank',
        plugin: 'Factoids',
        syntax: 'rank [<channel>] [--plain] [--alpha] [<number>]',
        help: 'Lists top-ranked factoid keys.',
    },
    {
        name: 'lock',
        plugin: 'Factoids',
        syntax: 'lock [<channel>] <key>',
        help: 'Locks factoids associated with a key.',
    },
    {
        name: 'unlock',
        plugin: 'Factoids',
        syntax: 'unlock [<channel>] <key>',
        help: 'Unlocks factoids associated with a key.',
    },
    {
        name: 'forget',
        plugin: 'Factoids',
        syntax: 'forget [<channel>] <key> [<number>|*]',
        help: 'Removes a factoid key relationship.',
    },
    {
        name: 'random',
        plugin: 'Factoids',
        syntax: 'random [<channel>]',
        help: 'Returns random factoids from the channel.',
    },
    {
        name: 'info',
        plugin: 'Factoids',
        syntax: 'info [<channel>] <key>',
        help: 'Shows information about a factoid key.',
    },
    {
        name: 'change',
        plugin: 'Factoids',
        syntax: 'change [<channel>] <key> <number> <regexp>',
        help: 'Changes a factoid value with a regular expression.',
    },
    {
        name: 'search',
        plugin: 'Factoids',
        syntax: 'search [<channel>] [--values] [--regexp <value>] [--author <username>] [<glob> ...]',
        help: 'Searches factoid keys or values.',
    },
    {
        name: 'profile',
        plugin: 'Fediverse',
        syntax: 'profile <username>',
        help: 'Looks up a Fediverse profile.',
    },
    {
        name: 'featured',
        plugin: 'Fediverse',
        syntax: 'featured <username>',
        help: 'Shows a Fediverse profile featured posts.',
    },
    {
        name: 'statuses',
        plugin: 'Fediverse',
        syntax: 'statuses <username>',
        help: 'Shows recent Fediverse statuses.',
    },
    {
        name: 'status',
        plugin: 'Fediverse',
        syntax: 'status <url>',
        help: 'Looks up a Fediverse status by URL.',
    },
    {
        name: 'outfilter',
        plugin: 'Filter',
        syntax: 'outfilter [<channel>] <command>',
        help: 'Runs an outbound filter command.',
    },
    {
        name: 'hebrew',
        plugin: 'Filter',
        syntax: 'hebrew <text>',
        help: 'Reverses text for right-to-left display.',
    },
    {
        name: 'squish',
        plugin: 'Filter',
        syntax: 'squish <text>',
        help: 'Collapses whitespace in text.',
    },
    {
        name: 'undup',
        plugin: 'Filter',
        syntax: 'undup <text>',
        help: 'Removes duplicate consecutive characters.',
    },
    {
        name: 'binary',
        plugin: 'Filter',
        syntax: 'binary <text>',
        help: 'Returns the binary representation of text.',
    },
    {
        name: 'unbinary',
        plugin: 'Filter',
        syntax: 'unbinary <text>',
        help: 'Converts an ASCII binary string back to text.',
    },
    {
        name: 'hexlify',
        plugin: 'Filter',
        syntax: 'hexlify <text>',
        help: 'Returns the hexadecimal representation of text.',
    },
    {
        name: 'unhexlify',
        plugin: 'Filter',
        syntax: 'unhexlify <hexstring>',
        help: 'Converts a hexadecimal string back to text.',
    },
    {
        name: 'rot13',
        plugin: 'Filter',
        syntax: 'rot13 <text>',
        help: 'Applies ROT13 to text.',
    },
    {
        name: 'leet',
        plugin: 'Filter',
        syntax: 'leet <text>',
        help: 'Converts text to leetspeak.',
    },
    {
        name: 'supa1337',
        plugin: 'Filter',
        syntax: 'supa1337 <text>',
        help: 'Converts text to stronger leetspeak.',
    },
    {
        name: 'scramble',
        plugin: 'Filter',
        syntax: 'scramble <text>',
        help: 'Scrambles the characters in text.',
    },
    {
        name: 'unmorse',
        plugin: 'Filter',
        syntax: 'unmorse <text>',
        help: 'Decodes Morse code.',
    },
    {
        name: 'morse',
        plugin: 'Filter',
        syntax: 'morse <text>',
        help: 'Encodes text as Morse code.',
    },
    {
        name: 'reverse',
        plugin: 'Filter',
        syntax: 'reverse <text>',
        help: 'Reverses text.',
    },
    {
        name: 'colorize',
        plugin: 'Filter',
        syntax: 'colorize <text>',
        help: 'Colorizes text.',
    },
    {
        name: 'rainbow',
        plugin: 'Filter',
        syntax: 'rainbow <text>',
        help: 'Applies rainbow colors to text.',
    },
    {
        name: 'stripformatting',
        plugin: 'Filter',
        syntax: 'stripformatting <text>',
        help: 'Removes IRC formatting from text.',
    },
    {
        name: 'stripcolor',
        plugin: 'Filter',
        syntax: 'stripcolor <text>',
        help: 'Removes IRC colors from text.',
    },
    {
        name: 'aol',
        plugin: 'Filter',
        syntax: 'aol <text>',
        help: 'Converts text to AOL-style casing.',
    },
    {
        name: 'jeffk',
        plugin: 'Filter',
        syntax: 'jeffk <text>',
        help: 'Converts text to Jeff K style.',
    },
    {
        name: 'spellit',
        plugin: 'Filter',
        syntax: 'spellit <text>',
        help: 'Spells out text.',
    },
    {
        name: 'gnu',
        plugin: 'Filter',
        syntax: 'gnu <text>',
        help: 'Converts text to GNU style.',
    },
    {
        name: 'shrink',
        plugin: 'Filter',
        syntax: 'shrink <text>',
        help: 'Shrinks text.',
    },
    {
        name: 'uniud',
        plugin: 'Filter',
        syntax: 'uniud <text>',
        help: 'Rotates text 180 degrees.',
    },
    {
        name: 'capwords',
        plugin: 'Filter',
        syntax: 'capwords <text>',
        help: 'Capitalizes the first letter of each word.',
    },
    {
        name: 'caps',
        plugin: 'Filter',
        syntax: 'caps <text>',
        help: 'Uppercases all text.',
    },
    {
        name: 'vowelrot',
        plugin: 'Filter',
        syntax: 'vowelrot <text>',
        help: 'Rotates the vowels in text.',
    },
    {
        name: 'uwu',
        plugin: 'Filter',
        syntax: 'uwu <text>',
        help: 'Converts text to uwu-speak.',
    },
    {
        name: 'bold',
        plugin: 'Format',
        syntax: 'bold <text>',
        help: 'Returns text in bold.',
    },
    {
        name: 'reverse',
        plugin: 'Format',
        syntax: 'reverse <text>',
        help: 'Returns text in reverse video.',
    },
    {
        name: 'underline',
        plugin: 'Format',
        syntax: 'underline <text>',
        help: 'Returns underlined text.',
    },
    {
        name: 'color',
        plugin: 'Format',
        syntax: 'color <foreground> [<background>] <text>',
        help: 'Returns colored text.',
    },
    {
        name: 'join',
        plugin: 'Format',
        syntax: 'join <separator> <string 1> [<string> ...]',
        help: 'Joins arguments with a separator.',
    },
    {
        name: 'translate',
        plugin: 'Format',
        syntax: 'translate <chars to translate> <chars to replace those with> <text>',
        help: 'Replaces characters in text.',
    },
    {
        name: 'replace',
        plugin: 'Format',
        syntax: 'replace <substring to translate> <substring to replace it with> <text>',
        help: 'Replaces substrings in text.',
    },
    {
        name: 'upper',
        plugin: 'Format',
        syntax: 'upper <text>',
        help: 'Returns uppercased text.',
    },
    {
        name: 'lower',
        plugin: 'Format',
        syntax: 'lower <text>',
        help: 'Returns lowercased text.',
    },
    {
        name: 'capitalize',
        plugin: 'Format',
        syntax: 'capitalize <text>',
        help: 'Capitalizes text.',
    },
    {
        name: 'title',
        plugin: 'Format',
        syntax: 'title <text>',
        help: 'Titlecases text.',
    },
    {
        name: 'repr',
        plugin: 'Format',
        syntax: 'repr <text>',
        help: 'Surrounds text with double quotes.',
    },
    {
        name: 'concat',
        plugin: 'Format',
        syntax: 'concat <string 1> <string 2>',
        help: 'Concatenates two strings.',
    },
    {
        name: 'cut',
        plugin: 'Format',
        syntax: 'cut <size> <text>',
        help: 'Cuts text to a maximum size.',
    },
    {
        name: 'field',
        plugin: 'Format',
        syntax: 'field <number> <text>',
        help: 'Returns a space-separated field from text.',
    },
    {
        name: 'format',
        plugin: 'Format',
        syntax: 'format <format string> [<arg> ...]',
        help: 'Expands a Python-style format string.',
    },
    {
        name: 'key',
        plugin: 'GPG',
        syntax: 'key <add|remove|list> ...',
        help: 'Manages GPG keys linked to a bot user.',
        subcommands: [
            {
                name: 'add',
                syntax: 'key add <key id> <key server>',
                help: 'Adds a GPG key to your account.',
            },
            {
                name: 'remove',
                syntax: 'key remove <fingerprint>',
                help: 'Removes a GPG key from your account.',
            },
            {
                name: 'list',
                syntax: 'key list',
                help: 'Lists your GPG keys.',
            },
        ],
    },
    {
        name: 'signing',
        plugin: 'GPG',
        syntax: 'signing <gettoken|auth> ...',
        help: 'Signs and verifies GPG authentication tokens.',
        subcommands: [
            {
                name: 'gettoken',
                syntax: 'signing gettoken',
                help: 'Sends a token to sign with your GPG key.',
            },
            {
                name: 'auth',
                syntax: 'signing auth <url>',
                help: 'Verifies a signed token URL and authenticates you.',
            },
        ],
    },
    {
        name: 'translate',
        plugin: 'Google',
        syntax: 'translate <source language> [to] <target language> <text>',
        help: 'Translates text between languages.',
    },
    {
        name: 'default',
        plugin: 'Herald',
        syntax: 'default [<channel>] [--remove] <text>',
        help: 'Sets or removes the default channel herald.',
    },
    {
        name: 'get',
        plugin: 'Herald',
        syntax: 'get [<channel>] [<user>]',
        help: 'Returns the herald for a user.',
    },
    {
        name: 'add',
        plugin: 'Herald',
        syntax: 'add [<channel>] <user> <herald>',
        help: 'Adds a herald for a user.',
    },
    {
        name: 'remove',
        plugin: 'Herald',
        syntax: 'remove [<channel>] <user>',
        help: 'Removes a user herald.',
    },
    {
        name: 'change',
        plugin: 'Herald',
        syntax: 'change [<channel>] <user> <changer>',
        help: 'Changes a user herald with a replacement expression.',
    },
    {
        name: 'dns',
        plugin: 'Internet',
        syntax: 'dns <host>',
        help: 'Looks up DNS records for a host.',
    },
    {
        name: 'whois',
        plugin: 'Internet',
        syntax: 'whois <domain>',
        help: 'Looks up WHOIS information for a domain.',
    },
    {
        name: 'hexip',
        plugin: 'Internet',
        syntax: 'hexip <ip>',
        help: 'Returns the hexadecimal form of an IP address.',
    },
    {
        name: 'karma',
        plugin: 'Karma',
        syntax: 'karma [<channel>] <thing> [<thing> ...]',
        help: 'Returns karma for one or more things.',
    },
    {
        name: 'most',
        plugin: 'Karma',
        syntax: 'most [<channel>] <kind>',
        help: 'Lists the highest or lowest karma things.',
    },
    {
        name: 'clear',
        plugin: 'Karma',
        syntax: 'clear [<channel>] <name>',
        help: 'Clears karma for a thing.',
    },
    {
        name: 'dump',
        plugin: 'Karma',
        syntax: 'dump [<channel>] <filename>',
        help: 'Dumps channel karma to a file.',
    },
    {
        name: 'load',
        plugin: 'Karma',
        syntax: 'load [<channel>] <filename>',
        help: 'Loads channel karma from a file.',
    },
    {
        name: 'lart',
        plugin: 'Lart',
        syntax: 'lart [<channel>] <id> [<text>]',
        help: 'Applies a Lart to a user.',
    },
    {
        name: 'tell',
        plugin: 'Later',
        syntax: 'tell <nick>[, <nick>, ...] <text>',
        help: 'Stores a note for one or more nicks.',
    },
    {
        name: 'notes',
        plugin: 'Later',
        syntax: 'notes <nick>',
        help: 'Shows notes stored for a nick.',
    },
    {
        name: 'remove',
        plugin: 'Later',
        syntax: 'remove <nick>',
        help: 'Removes stored notes for a nick.',
    },
    {
        name: 'undo',
        plugin: 'Later',
        syntax: 'undo <nick>',
        help: 'Undoes the last note removal for a nick.',
    },
    {
        name: 'add',
        plugin: 'MessageParser',
        syntax: 'add [<channel>] <regexp> <action>',
        help: 'Adds a message parser rule.',
    },
    {
        name: 'remove',
        plugin: 'MessageParser',
        syntax: 'remove [<channel>] [--regexp <value>] <regexp>',
        help: 'Removes a message parser rule.',
    },
    {
        name: 'lock',
        plugin: 'MessageParser',
        syntax: 'lock [<channel>] <regexp>',
        help: 'Locks a message parser rule.',
    },
    {
        name: 'unlock',
        plugin: 'MessageParser',
        syntax: 'unlock [<channel>] <regexp>',
        help: 'Unlocks a message parser rule.',
    },
    {
        name: 'show',
        plugin: 'MessageParser',
        syntax: 'show [<channel>] [--regexp <value>] <regexp>',
        help: 'Shows a message parser rule.',
    },
    {
        name: 'info',
        plugin: 'MessageParser',
        syntax: 'info [<channel>] [--regexp <value>] <regexp>',
        help: 'Shows message parser rule information.',
    },
    {
        name: 'list',
        plugin: 'MessageParser',
        syntax: 'list [<channel>]',
        help: 'Lists message parser rules.',
    },
    {
        name: 'rank',
        plugin: 'MessageParser',
        syntax: 'rank [<channel>]',
        help: 'Ranks message parser rules by use.',
    },
    {
        name: 'vacuum',
        plugin: 'MessageParser',
        syntax: 'vacuum [<channel>]',
        help: 'Compacts the message parser database.',
    },
    {
        name: 'literal',
        plugin: 'MoobotFactoids',
        syntax: 'literal [<channel>] <key>',
        help: 'Returns a factoid without variable substitution.',
    },
    {
        name: 'factinfo',
        plugin: 'MoobotFactoids',
        syntax: 'factinfo [<channel>] <key>',
        help: 'Shows factoid information.',
    },
    {
        name: 'lock',
        plugin: 'MoobotFactoids',
        syntax: 'lock [<channel>] <key>',
        help: 'Locks a factoid.',
    },
    {
        name: 'unlock',
        plugin: 'MoobotFactoids',
        syntax: 'unlock [<channel>] <key>',
        help: 'Unlocks a factoid.',
    },
    {
        name: 'most',
        plugin: 'MoobotFactoids',
        syntax: 'most [<channel>] <method>',
        help: 'Lists the most authored, recent, or popular factoids.',
    },
    {
        name: 'listauth',
        plugin: 'MoobotFactoids',
        syntax: 'listauth [<channel>] <author>',
        help: 'Lists factoids by author.',
    },
    {
        name: 'listkeys',
        plugin: 'MoobotFactoids',
        syntax: 'listkeys [<channel>] <search>',
        help: 'Lists factoid keys matching a search.',
    },
    {
        name: 'listvalues',
        plugin: 'MoobotFactoids',
        syntax: 'listvalues [<channel>] <search>',
        help: 'Lists factoid values matching a search.',
    },
    {
        name: 'remove',
        plugin: 'MoobotFactoids',
        syntax: 'remove [<channel>] <key>',
        help: 'Removes a factoid.',
    },
    {
        name: 'random',
        plugin: 'MoobotFactoids',
        syntax: 'random [<channel>]',
        help: 'Returns a random factoid.',
    },
    {
        name: 'add',
        plugin: 'News',
        syntax: 'add [<channel>] [<at>] [<expires>] <news>',
        help: 'Adds a news item.',
    },
    {
        name: 'news',
        plugin: 'News',
        syntax: 'news [<channel>] [<id>]',
        help: 'Shows a news item.',
    },
    {
        name: 'remove',
        plugin: 'News',
        syntax: 'remove [<channel>] <id>',
        help: 'Removes a news item.',
    },
    {
        name: 'change',
        plugin: 'News',
        syntax: 'change [<channel>] <id> <replacer>',
        help: 'Changes a news item with a replacement expression.',
    },
    {
        name: 'old',
        plugin: 'News',
        syntax: 'old [<channel>] <id>',
        help: 'Shows an old news item.',
    },
    {
        name: 'nickometer',
        plugin: 'Nickometer',
        syntax: 'nickometer [<nick>]',
        help: 'Rates how lame a nick is.',
    },
    {
        name: 'add',
        plugin: 'Poll',
        syntax: 'add [<channel>] <question> <answer1> [<answer2> ...]',
        help: 'Creates a poll in the channel.',
    },
    {
        name: 'close',
        plugin: 'Poll',
        syntax: 'close [<channel>] <poll id>',
        help: 'Closes a poll.',
    },
    {
        name: 'vote',
        plugin: 'Poll',
        syntax: 'vote [<channel>] <poll id> <answer id>',
        help: 'Votes in a poll.',
    },
    {
        name: 'results',
        plugin: 'Poll',
        syntax: 'results [<channel>] <poll id>',
        help: 'Shows poll results.',
    },
    {
        name: 'list',
        plugin: 'Poll',
        syntax: 'list [<channel>]',
        help: 'Lists polls in the channel.',
    },
    {
        name: 'praise',
        plugin: 'Praise',
        syntax: 'praise [<channel>] [<id>] <who|what> [for <reason>]',
        help: 'Praises a user.',
    },
    {
        name: 'random',
        plugin: 'Quote',
        syntax: 'random [<channel>]',
        help: 'Returns a random quote.',
    },
    {
        name: 'replace',
        plugin: 'Quote',
        syntax: 'replace [<channel>] <id> <text>',
        help: 'Replaces a quote.',
    },
    {
        name: 'grab',
        plugin: 'QuoteGrabs',
        syntax: 'grab [<channel>] <nick>',
        help: 'Grabs a quote from a nick for the quotegrabs table.',
    },
    {
        name: 'ungrab',
        plugin: 'QuoteGrabs',
        syntax: 'ungrab [<channel>] [<number>]',
        help: 'Removes a quote grab, the last one by default.',
    },
    {
        name: 'quote',
        plugin: 'QuoteGrabs',
        syntax: 'quote [<channel>] <nick>',
        help: 'Returns a nick\'s latest quote grab.',
    },
    {
        name: 'list',
        plugin: 'QuoteGrabs',
        syntax: 'list [<channel>] <nick>',
        help: 'Lists quote grabs for a nick.',
    },
    {
        name: 'random',
        plugin: 'QuoteGrabs',
        syntax: 'random [<channel>] [<nick>]',
        help: 'Returns a random quote grab.',
    },
    {
        name: 'say',
        plugin: 'QuoteGrabs',
        syntax: 'say [<channel>] <id>',
        help: 'Returns a quote grab by id.',
    },
    {
        name: 'get',
        plugin: 'QuoteGrabs',
        syntax: 'get [<channel>] <id>',
        help: 'Returns a quote grab by id.',
    },
    {
        name: 'search',
        plugin: 'QuoteGrabs',
        syntax: 'search [<channel>] <text>',
        help: 'Searches quote grabs for text.',
    },
    {
        name: 'add',
        plugin: 'RSS',
        syntax: 'add <name> <url>',
        help: 'Adds a named RSS feed command.',
    },
    {
        name: 'remove',
        plugin: 'RSS',
        syntax: 'remove <name>',
        help: 'Removes a named RSS feed command.',
    },
    {
        name: 'announce',
        plugin: 'RSS',
        syntax: 'announce <list|add|remove|channels> ...',
        help: 'Manages announced feeds.',
        subcommands: [
            {
                name: 'list',
                syntax: 'announce list [<channel>]',
                help: 'Lists feeds announced in a channel.',
            },
            {
                name: 'add',
                syntax: 'announce add [<channel>] <name|url> [<name|url> ...]',
                help: 'Adds feeds to a channel\'s announcements.',
            },
            {
                name: 'remove',
                syntax: 'announce remove [<channel>] <name|url> [<name|url> ...]',
                help: 'Removes feeds from a channel\'s announcements.',
            },
            {
                name: 'channels',
                syntax: 'announce channels <name|url>',
                help: 'Lists channels where a feed is announced.',
            },
        ],
    },
    {
        name: 'rss',
        plugin: 'RSS',
        syntax: 'rss [--random] <name|url> [<number of headlines>]',
        help: 'Returns headlines from an RSS feed.',
    },
    {
        name: 'info',
        plugin: 'RSS',
        syntax: 'info <url|feed>',
        help: 'Shows information about an RSS feed.',
    },
    {
        name: 'join',
        plugin: 'Relay',
        syntax: 'join [<channel>]',
        help: 'Starts relaying a channel across networks.',
    },
    {
        name: 'part',
        plugin: 'Relay',
        syntax: 'part <channel>',
        help: 'Stops relaying a channel across networks.',
    },
    {
        name: 'nicks',
        plugin: 'Relay',
        syntax: 'nicks [<channel>]',
        help: 'Lists nicks in a relayed channel across networks.',
    },
    {
        name: 'private',
        plugin: 'Reply',
        syntax: 'private <text>',
        help: 'Replies privately with text.',
    },
    {
        name: 'action',
        plugin: 'Reply',
        syntax: 'action <text>',
        help: 'Replies with text as an action.',
    },
    {
        name: 'notice',
        plugin: 'Reply',
        syntax: 'notice <text>',
        help: 'Replies with text as a notice.',
    },
    {
        name: 'reply',
        plugin: 'Reply',
        syntax: 'reply <text>',
        help: 'Replies with text, prefixing the caller\'s nick.',
    },
    {
        name: 'replies',
        plugin: 'Reply',
        syntax: 'replies <str> [<str> ...]',
        help: 'Replies with each string separately.',
    },
    {
        name: 'add',
        plugin: 'Scheduler',
        syntax: 'add <seconds> <command>',
        help: 'Schedules a command to run after a delay.',
    },
    {
        name: 'remind',
        plugin: 'Scheduler',
        syntax: 'remind <seconds> <text>',
        help: 'Schedules a reminder after a delay.',
    },
    {
        name: 'remove',
        plugin: 'Scheduler',
        syntax: 'remove <id>',
        help: 'Removes a scheduled event.',
    },
    {
        name: 'repeat',
        plugin: 'Scheduler',
        syntax: 'repeat [--delay <delay>] <name> <seconds> <command>',
        help: 'Schedules a command to repeat at an interval.',
    },
    {
        name: 'list',
        plugin: 'Scheduler',
        syntax: 'list',
        help: 'Lists scheduled events.',
    },
    {
        name: 'op',
        plugin: 'Services',
        syntax: 'op [<channel>]',
        help: 'Asks ChanServ to op the bot in a channel.',
    },
    {
        name: 'voice',
        plugin: 'Services',
        syntax: 'voice [<channel>]',
        help: 'Asks ChanServ to voice the bot in a channel.',
    },
    {
        name: 'unban',
        plugin: 'Services',
        syntax: 'unban [<channel>]',
        help: 'Asks ChanServ to unban the bot from a channel.',
    },
    {
        name: 'invite',
        plugin: 'Services',
        syntax: 'invite [<channel>]',
        help: 'Asks ChanServ to invite the bot to a channel.',
    },
    {
        name: 'identify',
        plugin: 'Services',
        syntax: 'identify',
        help: 'Identifies with NickServ using the configured nick.',
    },
    {
        name: 'ghost',
        plugin: 'Services',
        syntax: 'ghost [<nick>]',
        help: 'Ghosts a nick and takes it.',
    },
    {
        name: 'nickserv',
        plugin: 'Services',
        syntax: 'nickserv <text>',
        help: 'Sends text to NickServ.',
    },
    {
        name: 'chanserv',
        plugin: 'Services',
        syntax: 'chanserv <text>',
        help: 'Sends text to ChanServ.',
    },
    {
        name: 'password',
        plugin: 'Services',
        syntax: 'password <nick> [<password>]',
        help: 'Sets or removes the NickServ password for a nick.',
    },
    {
        name: 'nicks',
        plugin: 'Services',
        syntax: 'nicks',
        help: 'Lists configured NickServ nicks.',
    },
    {
        name: 'register',
        plugin: 'Services',
        syntax: 'register [<network>] <password> [<email>]',
        help: 'Registers an account on a network.',
    },
    {
        name: 'verify',
        plugin: 'Services',
        syntax: 'verify [<network>] <account> <code>',
        help: 'Verifies an account registration code.',
    },
    {
        name: 'tiny',
        plugin: 'ShrinkUrl',
        syntax: 'tiny <url>',
        help: 'Returns a TinyURL version of a URL.',
    },
    {
        name: 'ur1',
        plugin: 'ShrinkUrl',
        syntax: 'ur1 <url>',
        help: 'Returns an ur1 version of a URL.',
    },
    {
        name: 'x0',
        plugin: 'ShrinkUrl',
        syntax: 'x0 <url>',
        help: 'Returns an x0.no version of a URL.',
    },
    {
        name: 'status',
        plugin: 'Status',
        syntax: 'status',
        help: 'Shows the bot status.',
    },
    {
        name: 'threads',
        plugin: 'Status',
        syntax: 'threads',
        help: 'Lists active threads.',
    },
    {
        name: 'processes',
        plugin: 'Status',
        syntax: 'processes',
        help: 'Lists active processes.',
    },
    {
        name: 'net',
        plugin: 'Status',
        syntax: 'net',
        help: 'Shows network statistics.',
    },
    {
        name: 'cpu',
        plugin: 'Status',
        syntax: 'cpu',
        help: 'Shows CPU statistics.',
    },
    {
        name: 'cmd',
        plugin: 'Status',
        syntax: 'cmd',
        help: 'Shows command statistics.',
    },
    {
        name: 'commands',
        plugin: 'Status',
        syntax: 'commands',
        help: 'Lists commands offered by the bot.',
    },
    {
        name: 'uptime',
        plugin: 'Status',
        syntax: 'uptime',
        help: 'Shows how long the bot has been running.',
    },
    {
        name: 'server',
        plugin: 'Status',
        syntax: 'server',
        help: 'Shows the server the bot is on.',
    },
    {
        name: 'network',
        plugin: 'Status',
        syntax: 'network',
        help: 'Shows the network the bot is on.',
    },
    {
        name: 'add',
        plugin: 'Success',
        syntax: 'add [<channel>] <text>',
        help: 'Adds a success response for a channel.',
    },
    {
        name: 'remove',
        plugin: 'Success',
        syntax: 'remove [<channel>] <id>',
        help: 'Removes a success response.',
    },
    {
        name: 'search',
        plugin: 'Success',
        syntax: 'search [<channel>] [--{regexp,by} <value>] [<glob>]',
        help: 'Searches success responses.',
    },
    {
        name: 'get',
        plugin: 'Success',
        syntax: 'get [<channel>] <id>',
        help: 'Returns a success response by id.',
    },
    {
        name: 'change',
        plugin: 'Success',
        syntax: 'change [<channel>] <id> <regexp>',
        help: 'Changes a success response with a replacement expression.',
    },
    {
        name: 'stats',
        plugin: 'Success',
        syntax: 'stats [<channel>]',
        help: 'Shows how many success responses are stored.',
    },
    {
        name: 'todo',
        plugin: 'Todo',
        syntax: 'todo [<username>] [<task id>]',
        help: 'Shows a task or lists tasks for a user.',
    },
    {
        name: 'add',
        plugin: 'Todo',
        syntax: 'add [--priority=<num>] <text>',
        help: 'Adds a task to your todo list.',
    },
    {
        name: 'remove',
        plugin: 'Todo',
        syntax: 'remove <task id> [<task id> ...]',
        help: 'Removes tasks from your todo list.',
    },
    {
        name: 'search',
        plugin: 'Todo',
        syntax: 'search [--{regexp} <value>] [<glob> <glob> ...]',
        help: 'Searches your todo list.',
    },
    {
        name: 'setpriority',
        plugin: 'Todo',
        syntax: 'setpriority <id> <priority>',
        help: 'Sets the priority of a todo task.',
    },
    {
        name: 'change',
        plugin: 'Todo',
        syntax: 'change <task id> <regexp>',
        help: 'Changes a todo task with a replacement expression.',
    },
    {
        name: 'topic',
        plugin: 'Topic',
        syntax: 'topic [<channel>]',
        help: 'Returns the channel topic.',
    },
    {
        name: 'add',
        plugin: 'Topic',
        syntax: 'add [<channel>] <topic>',
        help: 'Adds a topic to the channel topic.',
    },
    {
        name: 'fit',
        plugin: 'Topic',
        syntax: 'fit [<channel>] <topic>',
        help: 'Adds a topic, removing older topics to fit the server limit.',
    },
    {
        name: 'replace',
        plugin: 'Topic',
        syntax: 'replace [<channel>] <number> <topic>',
        help: 'Replaces a numbered topic.',
    },
    {
        name: 'insert',
        plugin: 'Topic',
        syntax: 'insert [<channel>] <topic>',
        help: 'Inserts a topic at the beginning.',
    },
    {
        name: 'shuffle',
        plugin: 'Topic',
        syntax: 'shuffle [<channel>]',
        help: 'Shuffles the channel topics.',
    },
    {
        name: 'reorder',
        plugin: 'Topic',
        syntax: 'reorder [<channel>] <number> [<number> ...]',
        help: 'Reorders the channel topics.',
    },
    {
        name: 'list',
        plugin: 'Topic',
        syntax: 'list [<channel>]',
        help: 'Lists the channel topics with their indexes.',
    },
    {
        name: 'get',
        plugin: 'Topic',
        syntax: 'get [<channel>] <number>',
        help: 'Returns a numbered topic.',
    },
    {
        name: 'change',
        plugin: 'Topic',
        syntax: 'change [<channel>] <number> <regexp>',
        help: 'Changes a numbered topic with a replacement expression.',
    },
    {
        name: 'set',
        plugin: 'Topic',
        syntax: 'set [<channel>] [<number>] <topic>',
        help: 'Sets a numbered topic or the entire channel topic.',
    },
    {
        name: 'remove',
        plugin: 'Topic',
        syntax: 'remove [<channel>] <number1> [<number2> <number3>...]',
        help: 'Removes numbered topics.',
    },
    {
        name: 'lock',
        plugin: 'Topic',
        syntax: 'lock [<channel>]',
        help: 'Locks the channel topic by setting mode +t.',
    },
    {
        name: 'unlock',
        plugin: 'Topic',
        syntax: 'unlock [<channel>]',
        help: 'Unlocks the channel topic by setting mode -t.',
    },
    {
        name: 'restore',
        plugin: 'Topic',
        syntax: 'restore [<channel>]',
        help: 'Restores the last topic set by the bot.',
    },
    {
        name: 'refresh',
        plugin: 'Topic',
        syntax: 'refresh [<channel>]',
        help: 'Refreshes the current topic or restores the last topic.',
    },
    {
        name: 'undo',
        plugin: 'Topic',
        syntax: 'undo [<channel>]',
        help: 'Restores the previous channel topic.',
    },
    {
        name: 'redo',
        plugin: 'Topic',
        syntax: 'redo [<channel>]',
        help: 'Undoes the last topic undo.',
    },
    {
        name: 'swap',
        plugin: 'Topic',
        syntax: 'swap [<channel>] <first topic number> <second topic number>',
        help: 'Swaps two numbered topics.',
    },
    {
        name: 'save',
        plugin: 'Topic',
        syntax: 'save [<channel>]',
        help: 'Saves the current topic as the channel default.',
    },
    {
        name: 'default',
        plugin: 'Topic',
        syntax: 'default [<channel>]',
        help: 'Sets the channel topic to its saved default.',
    },
    {
        name: 'separator',
        plugin: 'Topic',
        syntax: 'separator [<channel>] <separator>',
        help: 'Sets the topic separator for a channel.',
    },
    {
        name: 'stats',
        plugin: 'URL',
        syntax: 'stats [<channel>]',
        help: 'Shows how many URLs are stored for a channel.',
    },
    {
        name: 'last',
        plugin: 'URL',
        syntax: 'last [<channel>] [--{from,with,without,near,proto} <value>] [--nolimit]',
        help: 'Returns the last URL matching the given criteria.',
    },
    {
        name: 'errno',
        plugin: 'Unix',
        syntax: 'errno <error number or code>',
        help: 'Returns an errno code or number and its description.',
    },
    {
        name: 'progstats',
        plugin: 'Unix',
        syntax: 'progstats',
        help: 'Shows Unix process information for the bot.',
    },
    {
        name: 'pid',
        plugin: 'Unix',
        syntax: 'pid',
        help: 'Returns the bot process ID.',
    },
    {
        name: 'crypt',
        plugin: 'Unix',
        syntax: 'crypt <password> [<salt>]',
        help: 'Returns the crypt() hash of a password.',
    },
    {
        name: 'spell',
        plugin: 'Unix',
        syntax: 'spell <word>',
        help: 'Returns spelling suggestions for a word.',
    },
    {
        name: 'fortune',
        plugin: 'Unix',
        syntax: 'fortune',
        help: 'Returns a fortune from the Unix fortune program.',
    },
    {
        name: 'wtf',
        plugin: 'Unix',
        syntax: 'wtf [is] <something>',
        help: 'Explains what something is using the Unix wtf command.',
    },
    {
        name: 'ping',
        plugin: 'Unix',
        syntax: 'ping [--c <count>] [--i <interval>] [--t <ttl>] [--W <timeout>] [--4|--6] <host or ip>',
        help: 'Sends ICMP echo requests to a host.',
    },
    {
        name: 'ping6',
        plugin: 'Unix',
        syntax: 'ping6 [--c <count>] [--i <interval>] [--t <ttl>] [--W <timeout>] [--4|--6] <host or ip>',
        help: 'Sends ICMP echo requests to a host using IPv6.',
    },
    {
        name: 'sysuptime',
        plugin: 'Unix',
        syntax: 'sysuptime',
        help: 'Returns the uptime of the bot host.',
    },
    {
        name: 'sysuname',
        plugin: 'Unix',
        syntax: 'sysuname',
        help: 'Returns the uname output of the bot host.',
    },
    {
        name: 'call',
        plugin: 'Unix',
        syntax: 'call <command to call with any arguments>',
        help: 'Runs a system command without a shell and returns its output.',
    },
    {
        name: 'shell',
        plugin: 'Unix',
        syntax: 'shell <command to call with any arguments>',
        help: 'Runs a system command through the shell and returns its output.',
    },
    {
        name: 'ignore',
        plugin: 'Utilities',
        syntax: 'ignore',
        help: 'Does nothing.',
    },
    {
        name: 'success',
        plugin: 'Utilities',
        syntax: 'success [<text>]',
        help: 'Replies with a success message.',
    },
    {
        name: 'last',
        plugin: 'Utilities',
        syntax: 'last <text> [<text> ...]',
        help: 'Returns the last argument.',
    },
    {
        name: 'echo',
        plugin: 'Utilities',
        syntax: 'echo <text>',
        help: 'Returns the arguments after substitution.',
    },
    {
        name: 'shuffle',
        plugin: 'Utilities',
        syntax: 'shuffle <arg> [<arg> ...]',
        help: 'Shuffles the arguments.',
    },
    {
        name: 'sort',
        plugin: 'Utilities',
        syntax: 'sort <arg> [<arg> ...]',
        help: 'Sorts the arguments.',
    },
    {
        name: 'sample',
        plugin: 'Utilities',
        syntax: 'sample <num> <arg> [<arg> ...]',
        help: 'Randomly chooses arguments.',
    },
    {
        name: 'countargs',
        plugin: 'Utilities',
        syntax: 'countargs <arg> [<arg> ...]',
        help: 'Counts the arguments.',
    },
    {
        name: 'apply',
        plugin: 'Utilities',
        syntax: 'apply <command> <text>',
        help: 'Tokenizes text and calls a command with the result.',
    },
    {
        name: 'let',
        plugin: 'Utilities',
        syntax: 'let <variable> = <value> in <command>',
        help: 'Sets a variable and runs a command.',
    },
    {
        name: 'headers',
        plugin: 'Web',
        syntax: 'headers <url>',
        help: 'Returns the HTTP headers of a URL.',
    },
    {
        name: 'location',
        plugin: 'Web',
        syntax: 'location <url>',
        help: 'Returns the redirect target of a URL.',
    },
    {
        name: 'doctype',
        plugin: 'Web',
        syntax: 'doctype <url>',
        help: 'Returns the DOCTYPE of a URL.',
    },
    {
        name: 'size',
        plugin: 'Web',
        syntax: 'size <url>',
        help: 'Returns the size of a URL.',
    },
    {
        name: 'title',
        plugin: 'Web',
        syntax: 'title [--no-filter] <url>',
        help: 'Returns the HTML title of a URL.',
    },
    {
        name: 'urlquote',
        plugin: 'Web',
        syntax: 'urlquote <text>',
        help: 'Returns the URL-quoted form of text.',
    },
    {
        name: 'urlunquote',
        plugin: 'Web',
        syntax: 'urlunquote <text>',
        help: 'Returns the unquoted form of URL text.',
    },
    {
        name: 'fetch',
        plugin: 'Web',
        syntax: 'fetch <url>',
        help: 'Returns the contents of a URL.',
    },
    {
        name: 'repolist',
        plugin: 'PluginDownloader',
        syntax: 'repolist [<repository>]',
        help: 'Lists known repositories or plugins in a repository.',
    },
    {
        name: 'install',
        plugin: 'PluginDownloader',
        syntax: 'install <repository> <plugin>',
        help: 'Downloads and installs a plugin from a repository.',
    },
    {
        name: 'info',
        plugin: 'PluginDownloader',
        syntax: 'info <repository> <plugin>',
        help: 'Shows information about a plugin in a repository.',
    },
    {
        name: 'add',
        plugin: 'Dunno',
        syntax: 'add [<channel>] <text>',
        help: 'Adds a dunno response for a channel.',
    },
    {
        name: 'remove',
        plugin: 'Dunno',
        syntax: 'remove [<channel>] <id>',
        help: 'Removes a dunno response.',
    },
    {
        name: 'search',
        plugin: 'Dunno',
        syntax: 'search [<channel>] [--{regexp,by} <value>] [<glob>]',
        help: 'Searches dunno responses.',
    },
    {
        name: 'get',
        plugin: 'Dunno',
        syntax: 'get [<channel>] <id>',
        help: 'Returns a dunno response by id.',
    },
    {
        name: 'change',
        plugin: 'Dunno',
        syntax: 'change [<channel>] <id> <regexp>',
        help: 'Changes a dunno response with a replacement expression.',
    },
    {
        name: 'stats',
        plugin: 'Dunno',
        syntax: 'stats [<channel>]',
        help: 'Shows how many dunno responses are stored.',
    },
    {
        name: 'add',
        plugin: 'Lart',
        syntax: 'add [<channel>] <text>',
        help: 'Adds a lart to a channel.',
    },
    {
        name: 'remove',
        plugin: 'Lart',
        syntax: 'remove [<channel>] <id>',
        help: 'Removes a lart.',
    },
    {
        name: 'search',
        plugin: 'Lart',
        syntax: 'search [<channel>] [--{regexp,by} <value>] [<glob>]',
        help: 'Searches larts.',
    },
    {
        name: 'get',
        plugin: 'Lart',
        syntax: 'get [<channel>] <id>',
        help: 'Returns a lart by id.',
    },
    {
        name: 'change',
        plugin: 'Lart',
        syntax: 'change [<channel>] <id> <regexp>',
        help: 'Changes a lart with a replacement expression.',
    },
    {
        name: 'stats',
        plugin: 'Lart',
        syntax: 'stats [<channel>]',
        help: 'Shows how many larts are stored.',
    },
    {
        name: 'add',
        plugin: 'Praise',
        syntax: 'add [<channel>] <text>',
        help: 'Adds a praise to a channel.',
    },
    {
        name: 'remove',
        plugin: 'Praise',
        syntax: 'remove [<channel>] <id>',
        help: 'Removes a praise.',
    },
    {
        name: 'search',
        plugin: 'Praise',
        syntax: 'search [<channel>] [--{regexp,by} <value>] [<glob>]',
        help: 'Searches praises.',
    },
    {
        name: 'get',
        plugin: 'Praise',
        syntax: 'get [<channel>] <id>',
        help: 'Returns a praise by id.',
    },
    {
        name: 'change',
        plugin: 'Praise',
        syntax: 'change [<channel>] <id> <regexp>',
        help: 'Changes a praise with a replacement expression.',
    },
    {
        name: 'stats',
        plugin: 'Praise',
        syntax: 'stats [<channel>]',
        help: 'Shows how many praises are stored.',
    },
    {
        name: 'add',
        plugin: 'Quote',
        syntax: 'add [<channel>] <text>',
        help: 'Adds a quote to a channel.',
    },
    {
        name: 'remove',
        plugin: 'Quote',
        syntax: 'remove [<channel>] <id>',
        help: 'Removes a quote.',
    },
    {
        name: 'search',
        plugin: 'Quote',
        syntax: 'search [<channel>] [--{regexp,by} <value>] [<glob>]',
        help: 'Searches quotes.',
    },
    {
        name: 'get',
        plugin: 'Quote',
        syntax: 'get [<channel>] <id>',
        help: 'Returns a quote by id.',
    },
    {
        name: 'change',
        plugin: 'Quote',
        syntax: 'change [<channel>] <id> <regexp>',
        help: 'Changes a quote with a replacement expression.',
    },
    {
        name: 'stats',
        plugin: 'Quote',
        syntax: 'stats [<channel>]',
        help: 'Shows how many quotes are stored.',
    },
];

// Per-command delivery preference. `prefix` means the command should be sent
// in the channel with the configured Limnoria prefix when possible; `private`
// means /msg <LimnoriaName>. Unknown commands default to private.
export const LIMNORIA_COMMAND_DELIVERY = Object.freeze({
    'admin join': 'private',
    'admin channels': 'private',
    'admin nick': 'private',
    'admin capability': 'private',
    'admin capability add': 'private',
    'admin capability remove': 'private',
    'admin ignore': 'private',
    'admin ignore add': 'private',
    'admin ignore remove': 'private',
    'admin ignore list': 'private',
    'admin clearq': 'private',
    'admin acmd': 'private',
    'config list': 'private',
    'config search': 'private',
    'config searchhelp': 'private',
    'config searchvalues': 'private',
    'config channel': 'prefix',
    'config network': 'private',
    'config config': 'prefix',
    'config help': 'private',
    'config default': 'private',
    'config reload': 'private',
    'config export': 'private',
    'config setdefault': 'private',
    'config reset': 'private',
    'config reset channel': 'prefix',
    'config reset network': 'private',
    'misc list': 'private',
    'misc apropos': 'private',
    'misc help': 'private',
    'misc version': 'private',
    'misc source': 'private',
    'misc more': 'prefix',
    'misc last': 'prefix',
    'misc tell': 'private',
    'misc noticetell': 'private',
    'misc ping': 'private',
    'misc completenick': 'prefix',
    'misc clearmores': 'private',
    'owner logmark': 'private',
    'owner announce': 'private',
    'owner defaultplugin': 'private',
    'owner ircquote': 'private',
    'owner quit': 'private',
    'owner flush': 'private',
    'owner upkeep': 'private',
    'owner load': 'private',
    'owner reload': 'private',
    'owner unload': 'private',
    'owner defaultcapability': 'private',
    'owner disable': 'private',
    'owner enable': 'private',
    'owner rename': 'private',
    'owner unrename': 'private',
    'owner reloadlocale': 'private',
    'channel mode': 'prefix',
    'channel limit': 'prefix',
    'channel moderate': 'prefix',
    'channel unmoderate': 'prefix',
    'channel key': 'prefix',
    'channel op': 'prefix',
    'channel halfop': 'prefix',
    'channel voice': 'prefix',
    'channel deop': 'prefix',
    'channel dehalfop': 'prefix',
    'channel devoice': 'prefix',
    'channel cycle': 'prefix',
    'channel kick': 'prefix',
    'channel kban': 'prefix',
    'channel iban': 'prefix',
    'channel unban': 'prefix',
    'channel listbans': 'prefix',
    'channel invite': 'prefix',
    'channel disable': 'prefix',
    'channel enable': 'prefix',
    'channel nicks': 'prefix',
    'channel alert': 'prefix',
    'channel part': 'prefix',
    'channel lobotomy': 'private',
    'channel lobotomy add': 'private',
    'channel lobotomy remove': 'private',
    'channel lobotomy list': 'private',
    'channel ban': 'prefix',
    'channel ban hostmask': 'prefix',
    'channel ban add': 'prefix',
    'channel ban remove': 'prefix',
    'channel ban list': 'prefix',
    'channel ignore': 'prefix',
    'channel ignore add': 'prefix',
    'channel ignore remove': 'prefix',
    'channel ignore list': 'prefix',
    'channel capability': 'prefix',
    'channel capability add': 'prefix',
    'channel capability remove': 'prefix',
    'channel capability setdefault': 'prefix',
    'channel capability set': 'prefix',
    'channel capability unset': 'prefix',
    'channel capability list': 'prefix',
    'network connect': 'private',
    'network disconnect': 'private',
    'network reconnect': 'private',
    'network command': 'private',
    'network cmdall': 'private',
    'network whois': 'private',
    'network whowas': 'private',
    'network networks': 'private',
    'network latency': 'private',
    'network driver': 'private',
    'network uptime': 'private',
    'network capabilities': 'private',
    'network authenticate': 'private',
    'nickauth nick': 'private',
    'nickauth nick add': 'private',
    'nickauth nick remove': 'private',
    'nickauth nick list': 'private',
    'nickauth auth': 'private',
    'user list': 'private',
    'user register': 'private',
    'user unregister': 'private',
    'user changename': 'private',
    'user username': 'private',
    'user set': 'private',
    'user set password': 'private',
    'user set secure': 'private',
    'user hostmask': 'private',
    'user hostmask hostmask': 'private',
    'user hostmask list': 'private',
    'user hostmask add': 'private',
    'user hostmask remove': 'private',
    'user capabilities': 'private',
    'user identify': 'private',
    'user unidentify': 'private',
    'user whoami': 'private',
    'user stats': 'private',
    'ddg search': 'private',
    'games coin': 'prefix',
    'games dice': 'prefix',
    'games eightball': 'prefix',
    'games roulette': 'prefix',
    'games monologue': 'prefix',
    'geography localtime': 'private',
    'geography timezone': 'private',
    'hashes md5': 'private',
    'hashes sha': 'private',
    'hashes sha256': 'private',
    'hashes sha512': 'private',
    'hashes algorithms': 'private',
    'hashes mkhash': 'private',
    'math base': 'private',
    'math calc': 'private',
    'math icalc': 'private',
    'math rpn': 'private',
    'math convert': 'private',
    'math units': 'private',
    'time seconds': 'private',
    'time at': 'private',
    'time until': 'private',
    'time ctime': 'private',
    'time time': 'private',
    'time elapsed': 'private',
    'time tztime': 'private',
    'time ddate': 'private',
    'note send': 'private',
    'note reply': 'private',
    'note unsend': 'private',
    'note note': 'private',
    'note search': 'private',
    'note list': 'private',
    'note next': 'private',
    'plugin help': 'private',
    'plugin plugin': 'private',
    'plugin plugins': 'private',
    'plugin path': 'private',
    'plugin author': 'private',
    'plugin contributors': 'private',
    'seen seen': 'prefix',
    'seen any': 'prefix',
    'seen last': 'prefix',
    'seen user': 'prefix',
    'seen since': 'prefix',
    'string ord': 'private',
    'string chr': 'private',
    'string unicodename': 'private',
    'string unicodesearch': 'private',
    'string encode': 'private',
    'string decode': 'private',
    'string levenshtein': 'private',
    'string soundex': 'private',
    'string len': 'private',
    'string re': 'private',
    'string xor': 'private',
    'string md5': 'private',
    'string sha': 'private',
    'aka add': 'private',
    'aka set': 'private',
    'aka remove': 'private',
    'aka lock': 'private',
    'aka unlock': 'private',
    'aka show': 'private',
    'aka importaliasdatabase': 'private',
    'aka list': 'private',
    'aka search': 'private',
    'alias lock': 'private',
    'alias unlock': 'private',
    'alias add': 'private',
    'alias remove': 'private',
    'alias list': 'private',
    'anonymous say': 'private',
    'anonymous tell': 'private',
    'anonymous do': 'private',
    'anonymous react': 'private',
    'badwords list': 'private',
    'badwords add': 'private',
    'badwords remove': 'private',
    'channelstats stats': 'prefix',
    'channelstats rank': 'prefix',
    'channelstats channelstats': 'prefix',
    'conditional cif': 'private',
    'conditional cand': 'private',
    'conditional cor': 'private',
    'conditional cxor': 'private',
    'conditional ceq': 'private',
    'conditional ne': 'private',
    'conditional gt': 'private',
    'conditional ge': 'private',
    'conditional lt': 'private',
    'conditional le': 'private',
    'conditional match': 'private',
    'conditional nceq': 'private',
    'conditional nne': 'private',
    'conditional ngt': 'private',
    'conditional nge': 'private',
    'conditional nlt': 'private',
    'conditional nle': 'private',
    'conditional cerror': 'private',
    'ctcp version': 'prefix',
    'debug eval': 'private',
    'debug exec': 'private',
    'debug simpleeval': 'private',
    'debug exn': 'private',
    'debug sendquote': 'private',
    'debug settrace': 'private',
    'debug unsettrace': 'private',
    'debug channeldb': 'prefix',
    'debug collect': 'private',
    'debug environ': 'private',
    'dict dictionaries': 'private',
    'dict random': 'private',
    'dict dict': 'private',
    'dict synonym': 'private',
    'factoids learn': 'prefix',
    'factoids whatis': 'prefix',
    'factoids alias': 'prefix',
    'factoids rank': 'prefix',
    'factoids lock': 'prefix',
    'factoids unlock': 'prefix',
    'factoids forget': 'prefix',
    'factoids random': 'prefix',
    'factoids info': 'prefix',
    'factoids change': 'prefix',
    'factoids search': 'prefix',
    'fediverse profile': 'private',
    'fediverse featured': 'private',
    'fediverse statuses': 'private',
    'fediverse status': 'private',
    'filter outfilter': 'private',
    'filter hebrew': 'private',
    'filter squish': 'private',
    'filter undup': 'private',
    'filter binary': 'private',
    'filter unbinary': 'private',
    'filter hexlify': 'private',
    'filter unhexlify': 'private',
    'filter rot13': 'private',
    'filter leet': 'private',
    'filter supa1337': 'private',
    'filter scramble': 'private',
    'filter unmorse': 'private',
    'filter morse': 'private',
    'filter reverse': 'private',
    'filter colorize': 'private',
    'filter rainbow': 'private',
    'filter stripformatting': 'private',
    'filter stripcolor': 'private',
    'filter aol': 'private',
    'filter jeffk': 'private',
    'filter spellit': 'private',
    'filter gnu': 'private',
    'filter shrink': 'private',
    'filter uniud': 'private',
    'filter capwords': 'private',
    'filter caps': 'private',
    'filter vowelrot': 'private',
    'filter uwu': 'private',
    'format bold': 'private',
    'format reverse': 'private',
    'format underline': 'private',
    'format color': 'private',
    'format join': 'private',
    'format translate': 'private',
    'format replace': 'private',
    'format upper': 'private',
    'format lower': 'private',
    'format capitalize': 'private',
    'format title': 'private',
    'format repr': 'private',
    'format concat': 'private',
    'format cut': 'private',
    'format field': 'private',
    'format format': 'private',
    'gpg key': 'private',
    'gpg key add': 'private',
    'gpg key remove': 'private',
    'gpg key list': 'private',
    'gpg signing': 'private',
    'gpg signing gettoken': 'private',
    'gpg signing auth': 'private',
    'google translate': 'private',
    'herald default': 'prefix',
    'herald get': 'prefix',
    'herald add': 'prefix',
    'herald remove': 'prefix',
    'herald change': 'prefix',
    'internet dns': 'private',
    'internet whois': 'private',
    'internet hexip': 'private',
    'karma karma': 'prefix',
    'karma most': 'prefix',
    'karma clear': 'prefix',
    'karma dump': 'prefix',
    'karma load': 'prefix',
    'lart lart': 'prefix',
    'later tell': 'private',
    'later notes': 'private',
    'later remove': 'private',
    'later undo': 'private',
    'messageparser add': 'prefix',
    'messageparser remove': 'prefix',
    'messageparser lock': 'prefix',
    'messageparser unlock': 'prefix',
    'messageparser show': 'prefix',
    'messageparser info': 'prefix',
    'messageparser list': 'prefix',
    'messageparser rank': 'prefix',
    'messageparser vacuum': 'prefix',
    'moobotfactoids literal': 'prefix',
    'moobotfactoids factinfo': 'prefix',
    'moobotfactoids lock': 'prefix',
    'moobotfactoids unlock': 'prefix',
    'moobotfactoids most': 'prefix',
    'moobotfactoids listauth': 'prefix',
    'moobotfactoids listkeys': 'prefix',
    'moobotfactoids listvalues': 'prefix',
    'moobotfactoids remove': 'prefix',
    'moobotfactoids random': 'prefix',
    'news add': 'prefix',
    'news news': 'prefix',
    'news remove': 'prefix',
    'news change': 'prefix',
    'news old': 'prefix',
    'nickometer nickometer': 'private',
    'poll add': 'prefix',
    'poll close': 'prefix',
    'poll vote': 'prefix',
    'poll results': 'prefix',
    'poll list': 'prefix',
    'praise praise': 'prefix',
    'quote random': 'prefix',
    'quote replace': 'prefix',
    'quotegrabs grab': 'prefix',
    'quotegrabs ungrab': 'prefix',
    'quotegrabs quote': 'prefix',
    'quotegrabs list': 'prefix',
    'quotegrabs random': 'prefix',
    'quotegrabs say': 'prefix',
    'quotegrabs get': 'prefix',
    'quotegrabs search': 'prefix',
    'rss add': 'private',
    'rss remove': 'private',
    'rss announce': 'private',
    'rss announce list': 'prefix',
    'rss announce add': 'prefix',
    'rss announce remove': 'prefix',
    'rss announce channels': 'private',
    'rss rss': 'private',
    'rss info': 'private',
    'relay join': 'prefix',
    'relay part': 'prefix',
    'relay nicks': 'prefix',
    'reply private': 'private',
    'reply action': 'private',
    'reply notice': 'private',
    'reply reply': 'private',
    'reply replies': 'private',
    'scheduler add': 'prefix',
    'scheduler remind': 'prefix',
    'scheduler remove': 'prefix',
    'scheduler repeat': 'prefix',
    'scheduler list': 'prefix',
    'services op': 'prefix',
    'services voice': 'prefix',
    'services unban': 'prefix',
    'services invite': 'prefix',
    'services identify': 'private',
    'services ghost': 'private',
    'services nickserv': 'private',
    'services chanserv': 'private',
    'services password': 'private',
    'services nicks': 'private',
    'services register': 'private',
    'services verify': 'private',
    'shrinkurl tiny': 'private',
    'shrinkurl ur1': 'private',
    'shrinkurl x0': 'private',
    'status status': 'private',
    'status threads': 'private',
    'status processes': 'private',
    'status net': 'private',
    'status cpu': 'private',
    'status cmd': 'private',
    'status commands': 'private',
    'status uptime': 'private',
    'status server': 'private',
    'status network': 'private',
    'success add': 'prefix',
    'success remove': 'prefix',
    'success search': 'prefix',
    'success get': 'prefix',
    'success change': 'prefix',
    'success stats': 'prefix',
    'todo todo': 'private',
    'todo add': 'private',
    'todo remove': 'private',
    'todo search': 'private',
    'todo setpriority': 'private',
    'todo change': 'private',
    'topic topic': 'prefix',
    'topic add': 'prefix',
    'topic fit': 'prefix',
    'topic replace': 'prefix',
    'topic insert': 'prefix',
    'topic shuffle': 'prefix',
    'topic reorder': 'prefix',
    'topic list': 'prefix',
    'topic get': 'prefix',
    'topic change': 'prefix',
    'topic set': 'prefix',
    'topic remove': 'prefix',
    'topic lock': 'prefix',
    'topic unlock': 'prefix',
    'topic restore': 'prefix',
    'topic refresh': 'prefix',
    'topic undo': 'prefix',
    'topic redo': 'prefix',
    'topic swap': 'prefix',
    'topic save': 'prefix',
    'topic default': 'prefix',
    'topic separator': 'prefix',
    'url stats': 'prefix',
    'url last': 'prefix',
    'unix errno': 'private',
    'unix progstats': 'private',
    'unix pid': 'private',
    'unix crypt': 'private',
    'unix spell': 'private',
    'unix fortune': 'private',
    'unix wtf': 'private',
    'unix ping': 'private',
    'unix ping6': 'private',
    'unix sysuptime': 'private',
    'unix sysuname': 'private',
    'unix call': 'private',
    'unix shell': 'private',
    'utilities ignore': 'private',
    'utilities success': 'private',
    'utilities last': 'private',
    'utilities echo': 'private',
    'utilities shuffle': 'private',
    'utilities sort': 'private',
    'utilities sample': 'private',
    'utilities countargs': 'private',
    'utilities apply': 'private',
    'utilities let': 'private',
    'web headers': 'private',
    'web location': 'private',
    'web doctype': 'private',
    'web size': 'private',
    'web title': 'private',
    'web urlquote': 'private',
    'web urlunquote': 'private',
    'web fetch': 'private',
    'plugindownloader repolist': 'private',
    'plugindownloader install': 'private',
    'plugindownloader info': 'private',
    'dunno add': 'prefix',
    'dunno remove': 'prefix',
    'dunno search': 'prefix',
    'dunno get': 'prefix',
    'dunno change': 'prefix',
    'dunno stats': 'prefix',
    'lart add': 'prefix',
    'lart remove': 'prefix',
    'lart search': 'prefix',
    'lart get': 'prefix',
    'lart change': 'prefix',
    'lart stats': 'prefix',
    'praise add': 'prefix',
    'praise remove': 'prefix',
    'praise search': 'prefix',
    'praise get': 'prefix',
    'praise change': 'prefix',
    'praise stats': 'prefix',
    'quote add': 'prefix',
    'quote remove': 'prefix',
    'quote search': 'prefix',
    'quote get': 'prefix',
    'quote change': 'prefix',
    'quote stats': 'prefix',
});

const COMMAND_PLUGIN_COUNTS = new Map();
LIMNORIA_COMMANDS.forEach((command) => {
    const name = command.name.toLowerCase();
    COMMAND_PLUGIN_COUNTS.set(name, (COMMAND_PLUGIN_COUNTS.get(name) || 0) + 1);
});

// Command names that exist in more than one plugin. Their bare shortcut is
// ambiguous, so only the fully specified forms are suggested.
export const LIMNORIA_COMMAND_CONFLICTS = Object.freeze(
    Array.from(COMMAND_PLUGIN_COUNTS.entries())
        .filter((entry) => entry[1] > 1)
        .map((entry) => entry[0])
        .sort()
);

const PLUGIN_NAMES = new Set(
    LIMNORIA_COMMANDS.map((command) => command.plugin.toLowerCase())
);

// A command whose name matches any plugin name is also ambiguous when the
// plugin prefix is omitted. Examples are `config`, `channel`, and `network`.
export const LIMNORIA_PLUGIN_COMMAND_CONFLICTS = Object.freeze(
    Array.from(new Set(
        LIMNORIA_COMMANDS
            .filter((command) => PLUGIN_NAMES.has(command.name.toLowerCase()))
            .map((command) => command.name)
    )).sort()
);

function isConflicting(command) {
    return COMMAND_PLUGIN_COUNTS.get(command.name.toLowerCase()) > 1;
}

function isShortcutAmbiguous(command) {
    return isConflicting(command) || PLUGIN_NAMES.has(command.name.toLowerCase());
}

function compareNames(left, right) {
    const a = String(left).toLowerCase();
    const b = String(right).toLowerCase();
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

function compareCommands(left, right) {
    return compareNames(left.name, right.name);
}

function pluginPrefix(command) {
    return command.plugin.toLowerCase();
}

function fullSyntax(command, syntax) {
    return pluginPrefix(command) + ' ' + syntax;
}

function pluginCommandItem(command) {
    return {
        text: command.name,
        description: fullSyntax(command, command.syntax),
        help: command.help,
        type: 'command',
        plugin: command.plugin,
        command: command.name,
    };
}

function subcommandItems(command, fullySpecified) {
    return (command.subcommands || [])
        .slice()
        .sort(compareCommands)
        .map((subcommand) => ({
            text: subcommand.name,
            description: fullySpecified ?
                fullSyntax(command, subcommand.syntax) :
                subcommand.syntax,
            help: subcommand.help,
            type: 'command',
            plugin: command.plugin,
            command: command.name + ' ' + subcommand.name,
        }));
}

function isCommandEnabled(command, enabled) {
    return !enabled || enabled.has(command.plugin.toLowerCase());
}

function pluginSuggestionItem(plugin) {
    return {
        text: plugin.toLowerCase(),
        description: 'Plugin',
        help: '',
        type: 'command',
        plugin,
        command: '',
    };
}

function firstTokenItems(enabled) {
    const items = [];
    const seen = new Set();
    LIMNORIA_COMMANDS.forEach((command) => {
        if (!isCommandEnabled(command, enabled)) {
            return;
        }

        const pluginText = command.plugin.toLowerCase();
        if (!seen.has(pluginText)) {
            seen.add(pluginText);
            items.push(pluginSuggestionItem(command.plugin));
        }

        if (!isShortcutAmbiguous(command)) {
            const commandText = command.name.toLowerCase();
            if (!seen.has(commandText)) {
                seen.add(commandText);
                items.push(pluginCommandItem(command));
            }
        }
    });
    return items.sort((left, right) => compareNames(left.text, right.text));
}

function shortcutCommand(name, enabled) {
    const matches = LIMNORIA_COMMANDS.filter(
        (command) => command.name.toLowerCase() === name &&
            isCommandEnabled(command, enabled)
    );
    if (matches.length !== 1 || isShortcutAmbiguous(matches[0])) {
        return null;
    }
    return matches[0];
}

function commandsForPlugin(name, enabled) {
    return LIMNORIA_COMMANDS
        .filter(
            (command) => command.plugin.toLowerCase() === name &&
                isCommandEnabled(command, enabled)
        )
        .sort(compareCommands);
}

function commandPath(command, rest) {
    const path = [command.plugin.toLowerCase(), command.name.toLowerCase()];
    if (rest.length > 0 && command.subcommands) {
        const subcommand = command.subcommands.find(
            (item) => item.name.toLowerCase() === rest[0].toLowerCase()
        );
        if (subcommand) {
            path.push(subcommand.name.toLowerCase());
        }
    }
    return path;
}

// Resolve a /lim command body to a canonical <plugin> <command> [subcommand]
// path. Ambiguous shortcuts and unknown commands return null.
export function limnoriaCommandPath(commandText) {
    if (typeof commandText !== 'string') {
        return null;
    }

    const tokens = commandText.trim().split(/\s+/).filter((token) => token.length > 0);
    if (tokens.length === 0) {
        return null;
    }

    const first = tokens[0].toLowerCase();
    const pluginCommands = commandsForPlugin(first);
    if (pluginCommands.length > 0 && tokens.length > 1) {
        const command = pluginCommands.find(
            (item) => item.name.toLowerCase() === tokens[1].toLowerCase()
        );
        return command ? commandPath(command, tokens.slice(2)) : null;
    }

    const command = shortcutCommand(first);
    return command ? commandPath(command, tokens.slice(1)) : null;
}

export function limnoriaCommandSyntax(commandText) {
    const path = limnoriaCommandPath(commandText);
    if (!path) {
        return '';
    }

    const command = LIMNORIA_COMMANDS.find(
        (item) => item.plugin.toLowerCase() === path[0] &&
            item.name.toLowerCase() === path[1]
    );
    if (!command) {
        return '';
    }

    if (path.length > 2 && command.subcommands) {
        const subcommand = command.subcommands.find(
            (item) => item.name.toLowerCase() === path[2]
        );
        if (subcommand) {
            return fullSyntax(command, subcommand.syntax);
        }
    }

    return fullSyntax(command, command.syntax);
}

export function limnoriaCommandDelivery(path) {
    if (!Array.isArray(path) || path.length === 0) {
        return 'private';
    }
    const key = path.map((part) => String(part).toLowerCase()).join(' ');
    return LIMNORIA_COMMAND_DELIVERY[key] || 'private';
}

// Returns next-token suggestions for /lim. Plugin prefixes may be omitted for
// unambiguous commands. Suggestions never contain spaces; callers advance one
// plugin, command, or subcommand token at a time.
export function limnoriaCommandSuggestions(input, plugins) {
    if (typeof input !== 'string') {
        return [];
    }

    const match = /^\/lim\s+(.*)$/i.exec(input);
    if (!match) {
        return [];
    }

    const enabled = Array.isArray(plugins) ?
        new Set(plugins.map((plugin) => String(plugin).toLowerCase())) :
        null;
    const body = match[1];
    const trailingSpace = /\s$/.test(input);
    const tokens = body.trim() ? body.trim().split(/\s+/) : [];

    if (tokens.length === 0) {
        return firstTokenItems(enabled);
    }

    const first = tokens[0].toLowerCase();
    const pluginCommands = commandsForPlugin(first, enabled);
    const shortcut = shortcutCommand(first, enabled);

    if (tokens.length === 1) {
        if (!trailingSpace) {
            return firstTokenItems(enabled)
                .filter((item) => item.text.toLowerCase().indexOf(first) === 0);
        }
        if (pluginCommands.length > 0) {
            return pluginCommands.map(pluginCommandItem);
        }
        return shortcut && shortcut.subcommands ?
            subcommandItems(shortcut, false) :
            [];
    }

    if (tokens.length === 2) {
        const second = tokens[1].toLowerCase();
        if (pluginCommands.length > 0) {
            const command = pluginCommands.find(
                (item) => item.name.toLowerCase() === second
            );
            if (trailingSpace) {
                return command && command.subcommands ?
                    subcommandItems(command, true) :
                    [];
            }
            return pluginCommands
                .filter((item) => item.name.toLowerCase().indexOf(second) === 0)
                .map(pluginCommandItem);
        }
        if (shortcut && shortcut.subcommands && !trailingSpace) {
            return subcommandItems(shortcut, false)
                .filter((item) => item.text.toLowerCase().indexOf(second) === 0);
        }
        return [];
    }

    if (tokens.length === 3 && !trailingSpace) {
        const second = tokens[1].toLowerCase();
        const third = tokens[2].toLowerCase();
        if (pluginCommands.length > 0) {
            const command = pluginCommands.find(
                (item) => item.name.toLowerCase() === second
            );
            if (!command || !command.subcommands) {
                return [];
            }
            return subcommandItems(command, true)
                .filter((item) => item.text.toLowerCase().indexOf(third) === 0);
        }
        if (shortcut && shortcut.subcommands) {
            return subcommandItems(shortcut, false)
                .filter((item) => item.text.toLowerCase().indexOf(third) === 0);
        }
    }

    return [];
}
