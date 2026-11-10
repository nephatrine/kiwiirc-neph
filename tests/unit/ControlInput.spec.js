import ControlInput from '@/components/ControlInput';

describe('ControlInput autocomplete', () => {
    function makeContext() {
        const input = {
            getRawText: jest.fn(() => '/lim net'),
            setPlainText: jest.fn(),
            setCurrentWord: jest.fn(),
        };
        const network = {
            id: 1,
            state: 'connected',
            nick: 'TestNick',
            caseCompare: (left, right) => (
                String(left).toLowerCase() === String(right).toLowerCase()
            ),
            hasCap: jest.fn((cap) => cap === 'message-tags'),
            supportsTag: jest.fn(() => true),
            setting: jest.fn(() => ''),
            ircClient: {
                tagmsg: jest.fn(),
            },
        };
        const context = {
            network,
            buffer: {
                name: '#test',
                isChannel: () => true,
                isQuery: () => false,
            },
            $refs: {
                input,
                autocomplete: {
                    resetSelection: jest.fn(),
                },
            },
            $state: {
                setting: jest.fn(() => true),
                ui: {
                    autocomplete_always_networks: [],
                },
            },
            $nextTick: (cb) => cb(),
            autocompleteProviders: {},
            autocomplete_items: [],
            autocomplete_filter: '',
            autocomplete_filtering: true,
            autocomplete_remote: false,
            autocomplete_remote_context: null,
            autocomplete_pending: null,
            autocomplete_open: false,
            providerAutocompleteResult: ControlInput.methods.providerAutocompleteResult,
            openProviderAutocomplete: ControlInput.methods.openProviderAutocomplete,
            shouldCompleteEmoji: ControlInput.methods.shouldCompleteEmoji,
            emojiAutocompleteToken: ControlInput.methods.emojiAutocompleteToken,
            applyEmojiAutocompleteValue: ControlInput.methods.applyEmojiAutocompleteValue,
            maybeRequestAutocomplete: ControlInput.methods.maybeRequestAutocomplete,
            clearAutocompletePending: ControlInput.methods.clearAutocompletePending,
            requestAutocomplete: ControlInput.methods.requestAutocomplete,
            onAutocompleteRequestEcho: ControlInput.methods.onAutocompleteRequestEcho,
            onAutocompleteResponse: ControlInput.methods.onAutocompleteResponse,
            current_input_value: '',
            onAutocompleteToggle: ControlInput.methods.onAutocompleteToggle,
            onAutocompleteCancel: ControlInput.methods.onAutocompleteCancel,
            onAutocompleteTemp: ControlInput.methods.onAutocompleteTemp,
            onAutocompleteSelected: ControlInput.methods.onAutocompleteSelected,
            applyAutocompleteValue: ControlInput.methods.applyAutocompleteValue,
            openAutoComplete: ControlInput.methods.openAutoComplete,
        };
        return { context, network, input };
    }

    it('sends an autocomplete request for /auto text', () => {
        const { context, network } = makeContext();

        expect(ControlInput.methods.requestAutocomplete.call(
            context,
            '/auto SupyBot: foo'
        )).toBe(true);
        expect(network.ircClient.tagmsg).toHaveBeenCalledWith('#test', {
            '+draft/autocomplete-request': 'SupyBot: foo',
        });
        expect(context.autocomplete_remote_context).toEqual({
            prefix: '/auto ',
            text: 'SupyBot: foo',
        });
        context.clearAutocompletePending();
    });

    it('sends always-auto requests without the /auto prefix', () => {
        const { context, network } = makeContext();
        context.autocompleteAlways = true;

        expect(ControlInput.methods.requestAutocomplete.call(
            context,
            'SupyBot: foo'
        )).toBe(true);
        expect(network.ircClient.tagmsg).toHaveBeenCalledWith('#test', {
            '+draft/autocomplete-request': 'SupyBot: foo',
        });
        expect(context.autocomplete_remote_context).toEqual({
            prefix: '',
            text: 'SupyBot: foo',
        });
        context.clearAutocompletePending();
    });

    it('keeps slash commands local in always-auto mode', () => {
        const { context, network } = makeContext();
        context.autocompleteAlways = true;

        expect(ControlInput.methods.maybeRequestAutocomplete.call(
            context,
            '/lim cap'
        )).toBe(false);
        expect(network.ircClient.tagmsg).not.toHaveBeenCalled();
    });

    it('toggles always-auto mode per network', () => {
        const { context, network } = makeContext();

        ControlInput.methods.onAutocompleteToggle.call(context, { network });
        expect(context.$state.ui.autocomplete_always_networks).toEqual([network.id]);

        ControlInput.methods.onAutocompleteToggle.call(context, { network });
        expect(context.$state.ui.autocomplete_always_networks).toEqual([]);
    });

    it('returns the first active autocomplete provider result', () => {
        const { context } = makeContext();
        const first = {
            suggest: jest.fn(() => null),
        };
        const second = {
            suggest: jest.fn(() => ({
                active: true,
                items: [{ text: 'join', type: 'command' }],
                filter: 'jo',
                filtering: false,
            })),
        };
        context.autocompleteProviders = {
            first,
            second,
        };

        const result = ControlInput.methods.providerAutocompleteResult.call(
            context,
            '/lim jo',
            'jo'
        );

        expect(first.suggest).toHaveBeenCalledWith({
            input: '/lim jo',
            token: 'jo',
            network: context.network,
            buffer: context.buffer,
        });
        expect(second.suggest).toHaveBeenCalledWith({
            input: '/lim jo',
            token: 'jo',
            network: context.network,
            buffer: context.buffer,
        });
        expect(result).toEqual({
            active: true,
            items: [{ text: 'join', type: 'command' }],
            filter: 'jo',
            filtering: false,
        });
    });

    it('treats an active provider with no items as handled', () => {
        const { context } = makeContext();
        context.autocompleteProviders = {
            empty: {
                suggest: () => ({ active: true, items: [] }),
            },
        };

        const result = ControlInput.methods.providerAutocompleteResult.call(
            context,
            '/lim ',
            ''
        );
        context.autocomplete_open = true;

        expect(result).toEqual({
            active: true,
            items: [],
            filter: '',
            filtering: true,
        });
        expect(ControlInput.methods.openProviderAutocomplete.call(
            context,
            result,
            ''
        )).toBe(true);
        expect(context.autocomplete_open).toBe(false);
    });

    it('opens provider suggestions with their filter settings', () => {
        const { context } = makeContext();
        const result = {
            active: true,
            items: [{ text: 'join', type: 'command' }],
            filter: 'jo',
            filtering: false,
        };

        expect(ControlInput.methods.openProviderAutocomplete.call(
            context,
            result,
            'join'
        )).toBe(true);
        expect(context.autocomplete_items).toEqual(result.items);
        expect(context.autocomplete_filter).toBe('jo');
        expect(context.autocomplete_filtering).toBe(false);
        expect(context.autocomplete_open).toBe(true);
    });

    it('uses the first non-empty provider hint', () => {
        const { context } = makeContext();
        context.current_input_value = '/lim time ctime';
        context.autocompleteProviders = {
            empty: {
                suggest: () => null,
                hint: () => '',
            },
            limnoria: {
                suggest: () => null,
                hint: () => 'time ctime [<seconds since epoch>]',
            },
        };

        expect(ControlInput.computed.providerAutocompleteHint.call(context))
            .toBe('time ctime [<seconds since epoch>]');
    });

    it('does not send remote requests for /lim, /msg, or prefix text', () => {
        const { context, network } = makeContext();

        expect(ControlInput.methods.maybeRequestAutocomplete.call(context, '/lim cap'))
            .toBe(false);
        expect(ControlInput.methods.maybeRequestAutocomplete.call(
            context,
            '/msg SupyBot net'
        )).toBe(false);
        expect(ControlInput.methods.maybeRequestAutocomplete.call(context, '!net'))
            .toBe(false);
        expect(network.ircClient.tagmsg).not.toHaveBeenCalled();
    });

    it('sends /auto requests to a query target', () => {
        const { context, network } = makeContext();
        context.buffer = {
            name: 'SupyBot',
            isChannel: () => false,
            isQuery: () => true,
        };

        expect(ControlInput.methods.requestAutocomplete.call(
            context,
            '/auto misc '
        )).toBe(true);
        expect(network.ircClient.tagmsg).toHaveBeenCalledWith('SupyBot', {
            '+draft/autocomplete-request': 'misc ',
        });
        context.clearAutocompletePending();
    });

    it('does not request again while a request is pending or remote mode is active', () => {
        const { context, network } = makeContext();
        context.autocomplete_pending = { timer: null };

        expect(ControlInput.methods.maybeRequestAutocomplete.call(
            context,
            '/auto net'
        )).toBe(false);
        expect(network.ircClient.tagmsg).not.toHaveBeenCalled();

        context.autocomplete_pending = null;
        context.autocomplete_remote = true;
        expect(ControlInput.methods.maybeRequestAutocomplete.call(
            context,
            '/auto net'
        )).toBe(false);
        expect(network.ircClient.tagmsg).not.toHaveBeenCalled();
    });

    it('turns bot responses into sourced command suggestions', () => {
        const { context, input } = makeContext();
        input.getRawText.mockReturnValue('/auto misc ');
        context.autocomplete_items = [
            { text: '/action', type: 'command' },
            { text: '/msg', type: 'command' },
        ];
        context.autocomplete_open = false;
        context.autocomplete_pending = {
            text: 'misc ',
            prefix: '/auto ',
            target: '#test',
            label: '',
            msgid: '',
            timer: null,
        };

        ControlInput.methods.onAutocompleteResponse.call(context, {
            network: context.network,
            event: {
                nick: 'BotOne',
                tags: {
                    '+draft/autocomplete-response': 'help\tinfo',
                },
            },
        });

        expect(context.autocomplete_open).toBe(true);
        expect(context.autocomplete_items.map((item) => item.text))
            .toEqual(['misc help', 'misc info']);
        expect(context.autocomplete_items.every((item) => item.remote)).toBe(true);
        expect(context.autocomplete_items.every((item) => item.description === 'BotOne'))
            .toBe(true);
        expect(context.autocomplete_items.every((item) => item.prefix === '/auto '))
            .toBe(true);
        expect(context.autocomplete_remote).toBe(true);
        expect(context.autocomplete_filtering).toBe(true);
        expect(context.autocomplete_pending).not.toBeNull();
        expect(context.$refs.autocomplete.resetSelection).toHaveBeenCalled();
        expect(input.setPlainText).not.toHaveBeenCalled();
    });

    it('accumulates responses from multiple bots', () => {
        const { context, input } = makeContext();
        input.getRawText.mockReturnValue('/auto misc ');
        context.autocomplete_pending = {
            text: 'misc ',
            prefix: '/auto ',
            target: '#test',
            label: '',
            msgid: '',
            timer: null,
        };

        ControlInput.methods.onAutocompleteResponse.call(context, {
            network: context.network,
            event: {
                nick: 'BotOne',
                tags: { '+draft/autocomplete-response': 'help' },
            },
        });
        ControlInput.methods.onAutocompleteResponse.call(context, {
            network: context.network,
            event: {
                nick: 'BotTwo',
                tags: { '+draft/autocomplete-response': 'help\tversion' },
            },
        });

        expect(context.autocomplete_items.map((item) => (
            `${item.description}:${item.text}`
        ))).toEqual([
            'BotOne:misc help',
            'BotTwo:misc help',
            'BotTwo:misc version',
        ]);
    });

    it('keeps the list open when a response is empty', () => {
        const { context, input } = makeContext();
        input.getRawText.mockReturnValue('/auto misc ');
        context.autocomplete_items = [{
            text: 'misc help',
            description: 'BotOne',
            type: 'command',
            remote: true,
            prefix: '/auto ',
        }];
        context.autocomplete_open = true;
        context.autocomplete_pending = {
            text: 'misc ',
            prefix: '/auto ',
            target: '#test',
            label: '',
            msgid: '',
            timer: null,
        };

        ControlInput.methods.onAutocompleteResponse.call(context, {
            network: context.network,
            event: {
                nick: 'BotTwo',
                tags: {
                    '+draft/autocomplete-response': '',
                },
            },
        });

        expect(context.autocomplete_items.map((item) => item.text))
            .toEqual(['misc help']);
        expect(context.autocomplete_open).toBe(true);
        expect(context.autocomplete_remote).toBe(false);
        expect(context.autocomplete_pending).not.toBeNull();
    });

    it('does not apply temporary remote previews', () => {
        const { context, input } = makeContext();
        context.autocomplete_remote = true;
        context.autocomplete_filtering = false;

        ControlInput.methods.onAutocompleteTemp.call(context, 'network', {
            remote: true,
        });

        expect(input.setPlainText).not.toHaveBeenCalled();
    });

    it('replaces the whole /auto command when a suggestion is selected', () => {
        const { context, input } = makeContext();
        context.autocomplete_remote = true;

        ControlInput.methods.onAutocompleteSelected.call(context, 'misc help', {
            remote: true,
            prefix: '/auto ',
        });

        expect(input.setPlainText).toHaveBeenCalledWith('/auto misc help');
        expect(context.autocomplete_remote).toBe(false);
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
        context.autocomplete_pending = {
            text: 'misc ',
            prefix: '/auto ',
            target: '#test',
            label: '',
            msgid: '',
            timer: null,
        };

        ControlInput.methods.onAutocompleteSelected.call(context, 'capability', {
            text: 'capability',
            type: 'command',
        });

        expect(input.setCurrentWord).toHaveBeenCalledWith('capability');
        expect(context.autocomplete_pending).toBeNull();
        expect(context.autocomplete_open).toBe(false);
    });

    it('clears a pending request when autocomplete is cancelled', () => {
        const { context } = makeContext();
        context.autocomplete_open = true;
        context.autocomplete_remote = true;
        context.autocomplete_remote_context = {
            prefix: '/auto ',
            text: 'misc ',
        };
        context.autocomplete_pending = {
            text: 'misc ',
            prefix: '/auto ',
            target: '#test',
            label: '',
            msgid: '',
            timer: null,
        };

        ControlInput.methods.onAutocompleteCancel.call(context);

        expect(context.autocomplete_pending).toBeNull();
        expect(context.autocomplete_open).toBe(false);
        expect(context.autocomplete_remote).toBe(false);
        expect(context.autocomplete_remote_context).toBeNull();
    });
});

describe('ControlInput autocomplete key handling', () => {
    test('does not request remote autocomplete when an open list consumes Tab', () => {
        const handleOnKeyDown = jest.fn(() => true);
        const maybeRequestAutocomplete = jest.fn();
        const submitForm = jest.fn();
        const maybeReplaceEmoji = jest.fn();
        const context = {
            autocomplete_open: true,
            $refs: {
                autocomplete: { handleOnKeyDown },
                input: { getRawText: jest.fn(() => '/auto misc ') },
            },
            maybeRequestAutocomplete,
            submitForm,
            maybeReplaceEmoji,
        };

        ControlInput.methods.inputKeyDown.call(context, {
            key: 'Tab',
            shiftKey: false,
            altKey: false,
            metaKey: false,
            ctrlKey: false,
            preventDefault: jest.fn(),
        });

        expect(handleOnKeyDown).toHaveBeenCalled();
        expect(maybeRequestAutocomplete).not.toHaveBeenCalled();
        expect(submitForm).not.toHaveBeenCalled();
        expect(maybeReplaceEmoji).not.toHaveBeenCalled();
    });

    test('accepts the highlighted item and sends on Enter', () => {
        const handleOnKeyDown = jest.fn(() => true);
        const submitForm = jest.fn();
        const maybeReplaceEmoji = jest.fn();
        const context = {
            autocomplete_open: true,
            $refs: {
                autocomplete: { handleOnKeyDown },
                input: { getRawText: jest.fn(() => 'misc ') },
            },
            submitForm,
            maybeReplaceEmoji,
        };
        const event = {
            key: 'Enter',
            shiftKey: false,
            altKey: false,
            metaKey: false,
            ctrlKey: false,
            preventDefault: jest.fn(),
        };

        ControlInput.methods.inputKeyDown.call(context, event);

        expect(handleOnKeyDown).toHaveBeenCalledWith(event);
        expect(maybeReplaceEmoji).toHaveBeenCalled();
        expect(submitForm).toHaveBeenCalledWith(false);
        expect(event.preventDefault).toHaveBeenCalled();
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

describe('ControlInput accidental command warning', () => {
    function makeContext(ircText, warnEnabled = true) {
        const input = {
            getValue: jest.fn(() => ircText),
            buildIrcText: jest.fn(() => ircText),
            reset: jest.fn(),
            focus: jest.fn(),
        };
        const context = {
            $refs: { input },
            $state: {
                setting: jest.fn((name) => {
                    if (name === 'buffers.warn_expected_command') {
                        return warnEnabled;
                    }
                    if (name === 'buffers.emoji_convert_as_typed') {
                        return false;
                    }
                    return undefined;
                }),
                $emit: jest.fn(),
            },
            showCommandWarning: false,
            has_focus: true,
            keep_focus: false,
            buffer: undefined,
            network: undefined,
            historyAdd: jest.fn(),
            stopTyping: jest.fn(),
            $nextTick: (cb) => cb(),
        };
        context.submitForm = ControlInput.methods.submitForm;
        return { context, input };
    }

    test('cancels the first send and shows the warning', () => {
        const { context, input } = makeContext(' /join #chan');

        ControlInput.methods.submitForm.call(context);

        expect(context.showCommandWarning).toBe(true);
        expect(context.$state.$emit).not.toHaveBeenCalled();
        expect(input.reset).not.toHaveBeenCalled();
    });

    test('sends a correctly formed command immediately', () => {
        const { context } = makeContext('/join #chan');

        ControlInput.methods.submitForm.call(context);

        expect(context.showCommandWarning).toBe(false);
        expect(context.$state.$emit).toHaveBeenCalledWith('input.raw', '/join #chan');
    });

    test('sends the space-prefixed text on the second attempt', () => {
        const { context, input } = makeContext(' /join #chan');
        context.showCommandWarning = true;

        ControlInput.methods.submitForm.call(context);

        expect(context.showCommandWarning).toBe(false);
        expect(context.$state.$emit).toHaveBeenCalledWith('input.raw', ' /join #chan');
        expect(input.reset).toHaveBeenCalledWith('', false);
    });

    test('force-sends from the Send as Message action', () => {
        const { context } = makeContext(' /join #chan');
        context.showCommandWarning = true;

        ControlInput.methods.sendCommandWarning.call(context);

        expect(context.$state.$emit).toHaveBeenCalledWith('input.raw', ' /join #chan');
        expect(context.showCommandWarning).toBe(false);
    });

    test('dismisses the warning and focuses the input', () => {
        const { context, input } = makeContext(' /join #chan');
        context.showCommandWarning = true;

        ControlInput.methods.dismissCommandWarning.call(context);

        expect(context.showCommandWarning).toBe(false);
        expect(input.focus).toHaveBeenCalled();
    });

    test('sends immediately when the warning setting is disabled', () => {
        const { context } = makeContext(' /join #chan', false);

        ControlInput.methods.submitForm.call(context);

        expect(context.showCommandWarning).toBe(false);
        expect(context.$state.$emit).toHaveBeenCalledWith('input.raw', ' /join #chan');
    });
});
