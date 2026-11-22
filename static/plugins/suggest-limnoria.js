kiwi.plugin('suggest-limnoria', (kiwi, log) => {
    'use strict';

    let COMMANDS_URL = 'static/plugins/suggest-limnoria/commands.json';
    let DEFAULT_PLUGINS = 'Admin, Channel, Config, Misc, Owner, User';

    let TextFormatting = kiwi.require('helpers/TextFormatting');
    let CommandTree = kiwi.require('helpers/CommandTree');

    if (!CommandTree || typeof CommandTree.createCommandTree !== 'function') {
        log.error('Unable to load the command tree helper');
        return;
    }

    let tree = null;
    let commandsPromise = null;
    let state = kiwi.Vue.observable({
        loaded: false,
        loading: false,
    });

    kiwi.setConfigDefaults('limnoria', {
        suggestions: false,
        name: 'SupyBot',
        plugins: DEFAULT_PLUGINS,
    });

    kiwi.addTranslations('suggest-limnoria', {
        'en-us': {
            command_lim: 'Limnoria Command',
            limnoria_channel_unavailable: 'Limnoria channel commands require a channel with the bot present.',
            limnoria_command_required: 'Enter a Limnoria command after /lim.',
            limnoria_disabled: 'Limnoria suggestions are disabled for this network.',
            limnoria_name_required: 'Set a Limnoria Name in the network settings first.',
            loadFailed: 'Limnoria command data could not be loaded.',
            settings_limnoria: 'Limnoria',
            settings_limnoria_name: 'Limnoria Name',
            settings_limnoria_plugins: 'Limnoria Plugins',
            settings_limnoria_plugins_hint: 'Comma or space separated plugin names.',
            settings_limnoria_suggestions: 'Limnoria Suggestions',
        },
    });

    function parsePlugins(value) {
        let source = Array.isArray(value) ? value.join(',') : String(value || '');
        let seen = new Set();
        return source
            .split(/[\s,]+/)
            .map((plugin) => plugin.trim().toLowerCase())
            .filter((plugin) => {
                if (!plugin || seen.has(plugin)) {
                    return false;
                }
                seen.add(plugin);
                return true;
            });
    }

    function configSetting(name, fallback) {
        let value = kiwi.state.setting('limnoria.' + name);
        return typeof value === 'undefined' ? fallback : value;
    }

    function settingsFor(network) {
        function get(name, fallback) {
            let value = network && typeof network.setting === 'function' ?
                network.setting(name) :
                undefined;
            return typeof value === 'undefined' ? fallback : value;
        }

        return {
            suggestions: !!get(
                'limnoriaSuggestions',
                configSetting('suggestions', false)
            ),
            name: String(get(
                'limnoriaName',
                configSetting('name', 'SupyBot')
            ) || '').trim(),
            plugins: parsePlugins(get(
                'limnoriaPlugins',
                configSetting('plugins', DEFAULT_PLUGINS)
            )),
        };
    }

    function ensureCommands() {
        if (tree) {
            return Promise.resolve(tree);
        }
        if (commandsPromise) {
            return commandsPromise;
        }

        state.loading = true;
        commandsPromise = fetch(COMMANDS_URL)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(response.status + ' ' + response.statusText);
                }
                return response.json();
            })
            .then((data) => {
                tree = CommandTree.createCommandTree(data.commands, {
                    delivery: data.delivery,
                });
                state.loaded = true;
                state.loading = false;
                return tree;
            })
            .catch((err) => {
                commandsPromise = null;
                state.loading = false;
                log.error('Unable to load Limnoria commands', err);
                throw err;
            });

        return commandsPromise;
    }

    function commandRequestBody(input) {
        let match = /^\/lim\s+([\s\S]*)$/i.exec(input);
        if (!match) {
            return null;
        }

        let body = match[1];
        return {
            text: body,
            tokens: body.trim() ? body.trim().split(/\s+/) : [],
            trailingSpace: /\s$/.test(input),
        };
    }

    function commandHintText(input, network, buffer, settings) {
        let limMatch = /^\/lim\s+([\s\S]*)$/i.exec(input);
        if (limMatch) {
            return limMatch[1];
        }

        let msgPrefix = '/msg ' + settings.name + ' ';
        if (input.toLowerCase().indexOf(msgPrefix.toLowerCase()) === 0) {
            return input.slice(msgPrefix.length);
        }

        let namePrefix = settings.name + ': ';
        if (input.toLowerCase().indexOf(namePrefix.toLowerCase()) === 0) {
            return input.slice(namePrefix.length);
        }

        if (
            buffer &&
            typeof buffer.isQuery === 'function' &&
            buffer.isQuery() &&
            network.caseCompare(buffer.name, settings.name)
        ) {
            return input;
        }

        return '';
    }

    function slashCommandItem(input) {
        let lower = String(input || '').toLowerCase();
        if (lower.length < 2 || lower.indexOf(' ') !== -1) {
            return null;
        }
        if (!'/lim'.startsWith(lower)) {
            return null;
        }
        return {
            text: '/lim',
            description: kiwi.i18n.t('suggest-limnoria:command_lim'),
            help: '',
            type: 'command',
        };
    }

    function suggestionItem(item) {
        if (item.kind === 'group') {
            return {
                text: item.text,
                description: 'Plugin',
                help: '',
                type: 'command',
                plugin: item.group,
                command: '',
            };
        }

        return {
            text: item.text,
            description: item.description,
            help: item.help,
            type: 'command',
            plugin: item.group,
            command: item.kind === 'subcommand' ?
                item.command + ' ' + item.subcommand :
                item.command,
        };
    }

    function suggest({ input, token, network }) {
        if (!network) {
            return null;
        }

        let settings = settingsFor(network);
        if (!settings.suggestions || !settings.name) {
            return null;
        }

        let slashItem = slashCommandItem(input);
        if (slashItem) {
            return {
                active: true,
                items: String(input).toLowerCase() === '/lim' ? [] : [slashItem],
                filter: token,
                filtering: true,
            };
        }

        if (network.state !== 'connected') {
            return null;
        }

        let request = commandRequestBody(input);
        if (!request) {
            return null;
        }

        if (!state.loaded) {
            ensureCommands().catch(() => {});
            return {
                active: true,
                items: [],
            };
        }

        let items = tree.suggest(request.tokens, request.trailingSpace, {
            enabledGroups: settings.plugins,
        });
        return {
            active: true,
            items: items.map(suggestionItem),
            filter: token,
            filtering: true,
        };
    }

    function hint({ input, network, buffer }) {
        if (!network || !buffer) {
            return '';
        }

        let settings = settingsFor(network);
        if (!settings.suggestions || !settings.name) {
            return '';
        }

        let text = commandHintText(input, network, buffer, settings);
        if (!text.trim()) {
            return '';
        }

        if (!state.loaded) {
            ensureCommands().catch(() => {});
            return '';
        }

        let result = tree.resolve(text.trim().split(/\s+/));
        return tree.syntaxFor(result);
    }

    function addLimnoriaError(buffer, message) {
        kiwi.state.addMessage(buffer, {
            time: Date.now(),
            nick: '*',
            message,
            type: 'error',
        });
    }

    function sendTo(target, message, context) {
        kiwi.state.$emit(
            'input.raw',
            '/msg ' + target + ' ' + message,
            context
        );
    }

    function runCommand(event, command, params, context) {
        event.handled = true;

        let network = context.network;
        let buffer = context.buffer;
        let settings = settingsFor(network);
        let commandText = String(params || '').trim();

        if (!settings.suggestions) {
            addLimnoriaError(buffer, TextFormatting.t('suggest-limnoria:limnoria_disabled'));
            return;
        }
        if (!settings.name) {
            addLimnoriaError(buffer, TextFormatting.t('suggest-limnoria:limnoria_name_required'));
            return;
        }
        if (!commandText) {
            addLimnoriaError(buffer, TextFormatting.t('suggest-limnoria:limnoria_command_required'));
            return;
        }

        ensureCommands()
            .then(() => {
                let result = tree.resolve(commandText.split(/\s+/));
                let delivery = tree.deliveryFor(result ? result.path : null);

                if (delivery === 'channel') {
                    if (
                        buffer.isQuery() &&
                        network.caseCompare(buffer.name, settings.name)
                    ) {
                        sendTo(settings.name, commandText, context);
                        return;
                    }
                    if (!buffer.isChannel() || !buffer.hasNick(settings.name)) {
                        addLimnoriaError(
                            buffer,
                            TextFormatting.t('suggest-limnoria:limnoria_channel_unavailable')
                        );
                        return;
                    }
                    sendTo(
                        buffer.name,
                        settings.name + ': ' + commandText,
                        context
                    );
                    return;
                }

                sendTo(settings.name, commandText, context);
            })
            .catch(() => {
                addLimnoriaError(
                    buffer,
                    kiwi.i18n.t('suggest-limnoria:loadFailed', {
                        defaultValue: 'Limnoria command data could not be loaded.',
                    })
                );
            });
    }

    let settingsTemplate = document.getElementById('suggest-limnoria-settings');
    let SettingsComponent = kiwi.Vue.extend({
        template: settingsTemplate ? settingsTemplate.innerHTML : '<div></div>',
        props: ['network'],
        computed: {
            suggestions: {
                get() {
                    return settingsFor(this.network).suggestions;
                },
                set(value) {
                    if (this.network) {
                        this.network.setting('limnoriaSuggestions', !!value);
                    }
                },
            },
            name: {
                get() {
                    if (!this.network) {
                        return configSetting('name', 'SupyBot');
                    }
                    let value = this.network.setting('limnoriaName');
                    return typeof value === 'undefined' ?
                        configSetting('name', 'SupyBot') :
                        String(value || '');
                },
                set(value) {
                    if (this.network) {
                        this.network.setting('limnoriaName', String(value || ''));
                    }
                },
            },
            plugins: {
                get() {
                    let value = this.network ?
                        this.network.setting('limnoriaPlugins') :
                        undefined;
                    if (typeof value === 'undefined') {
                        value = configSetting('plugins', DEFAULT_PLUGINS);
                    }
                    return Array.isArray(value) ?
                        value.join(', ') :
                        String(value || '');
                },
                set(value) {
                    if (this.network) {
                        this.network.setting('limnoriaPlugins', String(value || ''));
                    }
                },
            },
        },
    });

    kiwi.addSettingsBlock('network', SettingsComponent, {
        title: 't_suggest-limnoria:settings_limnoria',
        tabName: 'limnoria',
    });
    kiwi.registerCommand('lim', runCommand, {
        description: () => kiwi.i18n.t('suggest-limnoria:command_lim'),
    });
    kiwi.addAutocompleteProvider('suggest-limnoria', {
        suggest,
        hint,
    });
});
