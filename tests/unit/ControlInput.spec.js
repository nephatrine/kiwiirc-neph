import ControlInput from '@/components/ControlInput';

jest.mock('@/libs/LazyLoad', () => {
    const commands = jest.requireActual('@/libs/LimnoriaCommands');
    return {
        getLimnoriaCommands: () => commands,
        loadLimnoriaCommands: () => Promise.resolve(commands),
    };
});

describe('ControlInput Limnoria autocomplete', () => {
    function makeContext() {
        const input = {
            getRawText: jest.fn(() => '/lim net'),
            setPlainText: jest.fn(),
            setCurrentWord: jest.fn(),
        };
        const network = {
            state: 'connected',
            nick: 'TestNick',
            hasCap: jest.fn((cap) => cap === 'message-tags'),
            setting: jest.fn((name) => {
                if (name === 'limnoriaSuggestions') {
                    return true;
                }
                if (name === 'limnoriaName') {
                    return 'SupyBot';
                }
                if (name === 'limnoriaPrefix') {
                    return '!';
                }
                if (name === 'limnoriaPlugins') {
                    return 'Admin, Channel, Config, Misc, Owner, User';
                }
                return '';
            }),
            ircClient: {
                tagmsg: jest.fn(),
            },
        };
        const context = {
            network,
            buffer: {},
            $refs: {
                input,
                autocomplete: {
                    resetSelection: jest.fn(),
                },
            },
            $state: {
                setting: jest.fn(() => true),
            },
            $nextTick: (cb) => cb(),
            limnoria_pending: null,
            limnoria_commands_ready: true,
            limnoria_commands_loading: false,
            autocomplete_items: [],
            autocomplete_filter: '',
            autocomplete_filtering: true,
            autocomplete_limnoria: false,
            autocomplete_open: false,
            limnoriaEnabledPlugins: ControlInput.methods.limnoriaEnabledPlugins,
            ensureLimnoriaCommands: ControlInput.methods.ensureLimnoriaCommands,
            limnoriaCommandSuggestionsFor: ControlInput.methods.limnoriaCommandSuggestionsFor,
            shouldCompleteLimnoria: ControlInput.methods.shouldCompleteLimnoria,
            shouldCompleteEmoji: ControlInput.methods.shouldCompleteEmoji,
            emojiAutocompleteToken: ControlInput.methods.emojiAutocompleteToken,
            applyEmojiAutocompleteValue: ControlInput.methods.applyEmojiAutocompleteValue,
            openLimnoriaAutocomplete: ControlInput.methods.openLimnoriaAutocomplete,
            maybeRequestLimnoriaAutocomplete: ControlInput.methods.maybeRequestLimnoriaAutocomplete,
            limnoriaAutocompleteContext: ControlInput.methods.limnoriaAutocompleteContext,
            limnoriaInputText: ControlInput.methods.limnoriaInputText,
            limnoriaSyntaxGhost: ControlInput.methods.limnoriaSyntaxGhost,
            current_input_value: '',
            clearLimnoriaPending: ControlInput.methods.clearLimnoriaPending,
            requestLimnoriaAutocomplete: ControlInput.methods.requestLimnoriaAutocomplete,
            onLimnoriaResponse: ControlInput.methods.onLimnoriaResponse,
            onAutocompleteCancel: ControlInput.methods.onAutocompleteCancel,
            onAutocompleteTemp: ControlInput.methods.onAutocompleteTemp,
            onAutocompleteSelected: ControlInput.methods.onAutocompleteSelected,
            applyAutocompleteValue: ControlInput.methods.applyAutocompleteValue,
            openAutoComplete: ControlInput.methods.openAutoComplete,
        };
        return { context, network, input };
    }

    it('sends an autocomplete request after /lim text', () => {
        const { context, network } = makeContext();

        expect(ControlInput.methods.requestLimnoriaAutocomplete.call(context, '/lim net'))
            .toBe(true);
        expect(network.ircClient.tagmsg).toHaveBeenCalledWith('SupyBot', {
            '+draft/autocomplete-request': 'net',
        });
        context.clearLimnoriaPending();
    });

    it('shows local /lim command suggestions', () => {
        const { context } = makeContext();

        expect(ControlInput.methods.shouldCompleteLimnoria.call(context, '/lim cap'))
            .toBe(false);
        expect(ControlInput.methods.shouldCompleteLimnoria.call(
            context,
            '/lim channel cap'
        )).toBe(true);
        expect(ControlInput.methods.shouldCompleteLimnoria.call(
            context,
            '/msg SupyBot net'
        )).toBe(false);

        expect(ControlInput.methods.openLimnoriaAutocomplete.call(
            context,
            '/lim channel cap',
            'cap',
            true
        )).toBe(true);
        expect(context.autocomplete_items.map((item) => item.text))
            .toEqual(['capability']);
        expect(context.autocomplete_filter).toBe('cap');
        expect(context.autocomplete_filtering).toBe(true);
        expect(context.autocomplete_open).toBe(true);
    });

    it('shows a syntax hint for resolved Limnoria commands', () => {
        const { context, input } = makeContext();

        input.getRawText.mockReturnValue('/lim time ctime ');
        context.current_input_value = '/lim time ctime ';
        expect(ControlInput.methods.limnoriaSyntaxGhost.call(context))
            .toBe('time ctime [<seconds since epoch>]');

        input.getRawText.mockReturnValue('/lim time ');
        context.current_input_value = '/lim time ';
        expect(ControlInput.methods.limnoriaSyntaxGhost.call(context)).toBe('');

        input.getRawText.mockReturnValue('/msg SupyBot time ctime');
        context.current_input_value = '/msg SupyBot time ctime';
        expect(ControlInput.methods.limnoriaSyntaxGhost.call(context))
            .toBe('time ctime [<seconds since epoch>]');
    });

    it('honors the configured Limnoria plugin list', () => {
        const { context, network } = makeContext();
        network.setting.mockImplementation((name) => {
            if (name === 'limnoriaSuggestions') {
                return true;
            }
            if (name === 'limnoriaName') {
                return 'SupyBot';
            }
            if (name === 'limnoriaPlugins') {
                return 'Admin';
            }
            return '';
        });

        expect(ControlInput.methods.shouldCompleteLimnoria.call(
            context,
            '/lim games '
        )).toBe(false);
        expect(ControlInput.methods.shouldCompleteLimnoria.call(
            context,
            '/lim admin'
        )).toBe(true);

        expect(ControlInput.methods.openLimnoriaAutocomplete.call(
            context,
            '/lim ',
            '',
            true
        )).toBe(true);
        expect(context.autocomplete_items.length).toBeGreaterThan(0);
        expect(context.autocomplete_items.every((item) => item.plugin === 'Admin'))
            .toBe(true);
    });

    it('requests remote autocomplete even when local suggestions exist', () => {
        const { context, network } = makeContext();

        expect(ControlInput.methods.maybeRequestLimnoriaAutocomplete.call(
            context,
            '/lim cap'
        )).toBe(true);
        expect(network.ircClient.tagmsg).toHaveBeenCalledWith('SupyBot', {
            '+draft/autocomplete-request': 'cap',
        });
        context.clearLimnoriaPending();
    });

    it('does not request again while a request is pending or remote mode is active', () => {
        const { context, network } = makeContext();
        context.limnoria_pending = { timer: null };

        expect(ControlInput.methods.maybeRequestLimnoriaAutocomplete.call(
            context,
            '/lim net'
        )).toBe(false);
        expect(network.ircClient.tagmsg).not.toHaveBeenCalled();

        context.limnoria_pending = null;
        context.autocomplete_limnoria = true;
        expect(ControlInput.methods.maybeRequestLimnoriaAutocomplete.call(
            context,
            '/lim net'
        )).toBe(false);
        expect(network.ircClient.tagmsg).not.toHaveBeenCalled();
    });

    it('recognizes /msg and prefix invocation forms', () => {
        const { context } = makeContext();

        expect(ControlInput.methods.limnoriaAutocompleteContext.call(
            context,
            '/msg supybot net'
        )).toEqual({
            name: 'SupyBot',
            text: 'net',
            prefix: '/msg supybot ',
        });
        expect(ControlInput.methods.limnoriaAutocompleteContext.call(context, '!net'))
            .toEqual({
                name: 'SupyBot',
                text: 'net',
                prefix: '!',
            });
        expect(ControlInput.methods.limnoriaAutocompleteContext.call(context, '!'))
            .toBeNull();
        expect(ControlInput.methods.limnoriaAutocompleteContext.call(
            context,
            '/msg OtherBot net'
        )).toBeNull();
    });

    it('sends stripped requests privately for every invocation form', () => {
        const { context, network } = makeContext();

        ControlInput.methods.requestLimnoriaAutocomplete.call(context, '!net');
        expect(network.ircClient.tagmsg).toHaveBeenLastCalledWith('SupyBot', {
            '+draft/autocomplete-request': 'net',
        });
        context.clearLimnoriaPending();

        ControlInput.methods.requestLimnoriaAutocomplete.call(
            context,
            '/msg SupyBot net'
        );
        expect(network.ircClient.tagmsg).toHaveBeenLastCalledWith('SupyBot', {
            '+draft/autocomplete-request': 'net',
        });
        context.clearLimnoriaPending();
    });

    it('turns a response into full command suggestions', () => {
        const { context, input } = makeContext();
        context.autocomplete_items = [{
            text: 'capability',
            description: 'capability <add|remove> ...',
            help: 'Adds or removes a capability.',
            type: 'command',
        }];
        context.autocomplete_open = true;
        context.limnoria_pending = {
            text: 'net',
            prefix: '/lim ',
            name: 'SupyBot',
            label: '',
            msgid: '',
            timer: null,
        };

        ControlInput.methods.onLimnoriaResponse.call(context, {
            network: context.network,
            event: {
                nick: 'SupyBot',
                tags: {
                    '+draft/autocomplete-response': 'work\twork2',
                },
            },
        });

        expect(context.autocomplete_open).toBe(true);
        expect(context.autocomplete_items.map((item) => item.text))
            .toEqual(['network', 'network2']);
        expect(context.autocomplete_items.every((item) => item.limnoria)).toBe(true);
        expect(context.autocomplete_items.every((item) => item.prefix === '/lim '))
            .toBe(true);
        expect(context.autocomplete_limnoria).toBe(true);
        expect(context.autocomplete_filtering).toBe(true);
        expect(context.limnoria_pending).toBeNull();
        expect(context.$refs.autocomplete.resetSelection).toHaveBeenCalled();
        expect(input.setPlainText).not.toHaveBeenCalled();
    });

    it('keeps local suggestions when a response is empty', () => {
        const { context } = makeContext();
        context.autocomplete_items = [{
            text: 'capability',
            description: 'capability <add|remove> ...',
            help: 'Adds or removes a capability.',
            type: 'command',
        }];
        context.autocomplete_open = true;
        context.limnoria_pending = {
            text: 'net',
            prefix: '/lim ',
            name: 'SupyBot',
            label: '',
            msgid: '',
            timer: null,
        };

        ControlInput.methods.onLimnoriaResponse.call(context, {
            network: context.network,
            event: {
                nick: 'SupyBot',
                tags: {
                    '+draft/autocomplete-response': '',
                },
            },
        });

        expect(context.autocomplete_items.map((item) => item.text))
            .toEqual(['capability']);
        expect(context.autocomplete_open).toBe(true);
        expect(context.autocomplete_limnoria).toBe(false);
        expect(context.limnoria_pending).toBeNull();
    });

    it('does not apply temporary Limnoria previews', () => {
        const { context, input } = makeContext();
        context.autocomplete_limnoria = true;
        context.autocomplete_filtering = false;

        ControlInput.methods.onAutocompleteTemp.call(context, 'network', {
            limnoria: true,
        });

        expect(input.setPlainText).not.toHaveBeenCalled();
    });

    it('replaces the whole /lim command when a suggestion is selected', () => {
        const { context, input } = makeContext();
        context.autocomplete_limnoria = true;

        ControlInput.methods.onAutocompleteSelected.call(context, 'network', {
            limnoria: true,
        });

        expect(input.setPlainText).toHaveBeenCalledWith('/lim network');
        expect(context.autocomplete_limnoria).toBe(false);
        expect(context.autocomplete_open).toBe(false);
    });

    it('inserts fully specified command paths on selection', () => {
        const { context, input } = makeContext();

        ControlInput.methods.onAutocompleteSelected.call(context, 'config list', {
            text: 'config list',
            type: 'command',
        });

        expect(input.setCurrentWord).toHaveBeenCalledWith('config list');
    });

    it('clears a pending request when the user selects a local suggestion', () => {
        const { context, input } = makeContext();
        context.limnoria_pending = {
            text: 'net',
            prefix: '/lim ',
            name: 'SupyBot',
            label: '',
            msgid: '',
            timer: null,
        };

        ControlInput.methods.onAutocompleteSelected.call(context, 'capability', {
            text: 'capability',
            type: 'command',
        });

        expect(input.setCurrentWord).toHaveBeenCalledWith('capability');
        expect(context.limnoria_pending).toBeNull();
        expect(context.autocomplete_open).toBe(false);
    });

    it('clears a pending request when autocomplete is cancelled', () => {
        const { context } = makeContext();
        context.autocomplete_open = true;
        context.autocomplete_limnoria = true;
        context.limnoria_pending = {
            text: 'net',
            prefix: '/lim ',
            name: 'SupyBot',
            label: '',
            msgid: '',
            timer: null,
        };

        ControlInput.methods.onAutocompleteCancel.call(context);

        expect(context.limnoria_pending).toBeNull();
        expect(context.autocomplete_open).toBe(false);
        expect(context.autocomplete_limnoria).toBe(false);
    });

    it('restores /msg and Limnoria-prefix invocation text', () => {
        const { context, input } = makeContext();

        ControlInput.methods.applyAutocompleteValue.call(context, 'network', {
            limnoria: true,
            prefix: '/msg SupyBot ',
        });
        expect(input.setPlainText).toHaveBeenLastCalledWith('/msg SupyBot network');

        ControlInput.methods.applyAutocompleteValue.call(context, 'network', {
            limnoria: true,
            prefix: '!',
        });
        expect(input.setPlainText).toHaveBeenLastCalledWith('!network');
    });
});

describe('ControlInput input activity', () => {
    function makeContext(sharedInput) {
        const buffer = { current_input: 'old buffer input' };
        const network = { id: 'network' };
        const context = {
            buffer,
            network,
            current_input_value: '',
            showCommandWarning: true,
            maybeHidePlugins: jest.fn(),
            $state: {
                setting: jest.fn(() => sharedInput),
                ui: { current_input: 'old shared input' },
                $emit: jest.fn(),
            },
        };

        return { context, buffer, network };
    }

    it('updates the buffer and emits input activity', () => {
        const { context, buffer, network } = makeContext(false);

        ControlInput.methods.inputUpdate.call(context, 'hello');

        expect(context.current_input_value).toBe('hello');
        expect(buffer.current_input).toBe('hello');
        expect(context.showCommandWarning).toBe(false);
        expect(context.maybeHidePlugins).toHaveBeenCalledTimes(1);
        expect(context.$state.$emit).toHaveBeenCalledWith('input.activity', {
            network,
            buffer,
            textLength: 5,
        });
    });

    it('updates shared input and emits input activity', () => {
        const { context } = makeContext(true);

        ControlInput.methods.inputUpdate.call(context, 'hi');

        expect(context.$state.ui.current_input).toBe('hi');
        expect(context.$state.$emit).toHaveBeenCalledWith('input.activity', expect.objectContaining({
            textLength: 2,
        }));
    });
});

describe('ControlInput emoji autocomplete', () => {
    test('triggers only for partial shortcodes', () => {
        const should = ControlInput.methods.shouldCompleteEmoji;

        expect(should(':k')).toBe(true);
        expect(should(':kiwi')).toBe(true);
        expect(should(':kiwi:')).toBe(false);
        expect(should('hello:k')).toBe(false);
        expect(should(':')).toBe(false);
    });

    test('extracts adjacent emoji tokens after other emoji', () => {
        const token = ControlInput.methods.emojiAutocompleteToken;
        const should = ControlInput.methods.shouldCompleteEmoji;

        expect(token(':wave::s')).toBe(':s');
        expect(token('😀:s')).toBe(':s');
        expect(token(':wave/#te')).toBe(':wave/#te');
        expect(should(':wave::s')).toBe(true);
        expect(should('😀:s')).toBe(true);
        expect(should('hello:s')).toBe(false);
        expect(token('hello:s')).toBe('');
    });

    test('replaces only the adjacent partial emoji token', () => {
        const input = {
            getCurrentWord: jest.fn(() => ({
                word: ':wave::s',
                position: 8,
            })),
            setCurrentWord: jest.fn(),
        };
        const context = {
            $refs: { input },
            emojiAutocompleteToken: ControlInput.methods.emojiAutocompleteToken,
        };

        ControlInput.methods.applyEmojiAutocompleteValue.call(context, ':smile:');

        expect(input.setCurrentWord).toHaveBeenCalledWith(
            ':wave::smile:',
            false,
            true
        );
    });

    test('replaces a partial token that follows a unicode emoji', () => {
        const input = {
            getCurrentWord: jest.fn(() => ({
                word: '😀:s',
                position: 4,
            })),
            setCurrentWord: jest.fn(),
        };
        const context = {
            $refs: { input },
            emojiAutocompleteToken: ControlInput.methods.emojiAutocompleteToken,
        };

        ControlInput.methods.applyEmojiAutocompleteValue.call(context, ':smile:');

        expect(input.setCurrentWord).toHaveBeenCalledWith(
            '😀:smile:',
            false,
            true
        );
    });
});

describe('ControlInput as-typed emoji conversion', () => {
    function makeContext(word) {
        const input = {
            getCurrentWord: jest.fn(() => ({
                word,
                position: word.length,
            })),
            setCurrentWord: jest.fn(),
        };
        return {
            input,
            context: {
                $state: {
                    setting: () => true,
                },
                network: {
                    isUtf8: true,
                },
                buffer: undefined,
                $refs: { input },
            },
        };
    }

    test('converts only the shortcode and preserves punctuation', () => {
        const { context, input } = makeContext('ten-:smile:');

        ControlInput.methods.maybeReplaceEmoji.call(context);

        expect(input.setCurrentWord).toHaveBeenCalledWith('ten-😄', false, true);
    });

    test('handles a colon directly before the shortcode', () => {
        const { context, input } = makeContext('ten:joy:');

        ControlInput.methods.maybeReplaceEmoji.call(context);

        expect(input.setCurrentWord).toHaveBeenCalledWith('ten😂', false, true);
    });

    test('preserves text after the shortcode', () => {
        const { context, input } = makeContext(':smile:test');

        ControlInput.methods.maybeReplaceEmoji.call(context);

        expect(input.setCurrentWord).toHaveBeenCalledWith('😄test', false, true);
    });
});
