import AutoComplete from '@/components/AutoComplete';
import autocompleteMiddleware from '@/libs/AutocompleteMiddleware';
import state from '@/libs/state';
import InputHandler from '@/libs/InputHandler';
import * as TextFormatting from '@/helpers/TextFormatting';
import {
    applyAutocompleteResponse,
    autocompleteCommandContext,
    canRequestAutocomplete,
    parseAutocompleteResponses
} from '@/libs/Autocomplete';

describe('autocomplete protocol', () => {
    function makeNetwork(overrides = {}) {
        return {
            state: 'connected',
            hasCap: jest.fn((cap) => cap === 'message-tags'),
            supportsTag: jest.fn((tag) => tag === '+draft/autocomplete-request'),
            ircClient: {
                tagmsg: jest.fn(),
            },
            ...overrides,
        };
    }

    test('applies responses, parses them, and checks capabilities', () => {
        expect(applyAutocompleteResponse('frenod', '\b\b\benode')).toBe('freenode');
        expect(applyAutocompleteResponse('net', 'work')).toBe('network');

        expect(parseAutocompleteResponses('net', 'work\twork\twork2'))
            .toEqual(['network', 'network2']);
        expect(parseAutocompleteResponses('net', '')).toEqual([]);
        expect(parseAutocompleteResponses('net', undefined)).toEqual([]);

        expect(canRequestAutocomplete(makeNetwork())).toBe(true);
        expect(canRequestAutocomplete(makeNetwork({
            hasCap: jest.fn(() => false),
        }))).toBe(false);
        expect(canRequestAutocomplete(makeNetwork({
            supportsTag: jest.fn(() => false),
        }))).toBe(false);
        expect(canRequestAutocomplete(makeNetwork({
            ircClient: {},
        }))).toBe(false);
        expect(canRequestAutocomplete(makeNetwork({
            state: 'disconnected',
        }))).toBe(false);
    });

    test('builds /auto and always-auto contexts for channels and queries', () => {
        const channel = {
            name: '#test',
            isChannel: () => true,
            isQuery: () => false,
        };
        const query = {
            name: 'SupyBot',
            isChannel: () => false,
            isQuery: () => true,
        };
        const server = {
            name: '*',
            isChannel: () => false,
            isQuery: () => false,
        };

        expect(autocompleteCommandContext('/auto SupyBot: foo', channel)).toEqual({
            target: '#test',
            prefix: '/auto ',
            text: 'SupyBot: foo',
        });
        expect(autocompleteCommandContext('/AUTO !discord ', query)).toEqual({
            target: 'SupyBot',
            prefix: '/AUTO ',
            text: '!discord ',
        });
        expect(autocompleteCommandContext('/auto', channel)).toBeNull();
        expect(autocompleteCommandContext('SupyBot: foo', channel)).toBeNull();
        expect(autocompleteCommandContext('/auto foo', server)).toBeNull();

        expect(autocompleteCommandContext('SupyBot: foo', channel, true)).toEqual({
            target: '#test',
            prefix: '',
            text: 'SupyBot: foo',
        });
        expect(autocompleteCommandContext('!discord role ', query, true)).toEqual({
            target: 'SupyBot',
            prefix: '',
            text: '!discord role ',
        });
        expect(autocompleteCommandContext('/lim cap', channel, true)).toBeNull();
        expect(autocompleteCommandContext('/msg SupyBot cap', channel, true)).toBeNull();
        expect(autocompleteCommandContext('   ', channel, true)).toBeNull();
        expect(autocompleteCommandContext('/auto', channel, true)).toBeNull();
        expect(autocompleteCommandContext('/auto foo', channel, true)).toEqual({
            target: '#test',
            prefix: '/auto ',
            text: 'foo',
        });
    });
});

describe('autocomplete middleware', () => {
    function makeNetwork() {
        return {
            appState: {
                $emit: jest.fn(),
            },
        };
    }

    test('consumes autocomplete TAGMSGs and passes others through', () => {
        const network = makeNetwork();
        let handler = null;
        autocompleteMiddleware(network)({}, {}, {
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
            'autocomplete.response',
            { network, event: response }
        );
        expect(network.appState.$emit).toHaveBeenCalledWith(
            'autocomplete.request',
            { network, event: request }
        );
        expect(next).not.toHaveBeenCalled();

        handler('TAGMSG', { command: 'TAGMSG', tags: { '+typing': 'active' } }, {}, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(network.appState.$emit).toHaveBeenCalledTimes(2);
    });
});

describe('InputHandler /auto', () => {
    let s;
    let network;
    let buffer;
    let handler;

    beforeEach(() => {
        jest.spyOn(TextFormatting, 't').mockImplementation((key) => key);
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.net',
        });
        network.nick = 'TestNick';
        network.state = 'connected';
        network.enabled_caps = ['message-tags'];
        buffer = s.addBuffer(network.id, '#test');
        handler = new InputHandler(s);
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('strips the /auto prefix, sends in queries, and toggles on bare /auto', () => {
        handler.processLine('/auto SupyBot: foo', { network, buffer });

        expect(network.ircClient.say).toHaveBeenCalledWith(
            '#test',
            'SupyBot: foo',
            {}
        );

        const query = s.addBuffer(network.id, 'SupyBot');
        network.ircClient.say.mockClear();

        handler.processLine('/auto !discord role', { network, buffer: query });

        expect(network.ircClient.say).toHaveBeenCalledWith(
            'SupyBot',
            '!discord role',
            {}
        );

        const emit = jest.spyOn(s, '$emit');
        network.ircClient.say.mockClear();

        handler.processLine('/auto', { network, buffer });

        expect(emit).toHaveBeenCalledWith('autocomplete.toggle', {
            network,
            buffer,
        });
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });

    test('errors when autocomplete requests are unavailable or denied', () => {
        network.enabled_caps = [];
        let addMessage = jest.spyOn(s, 'addMessage');

        handler.processLine('/auto SupyBot: foo', { network, buffer });

        let error = addMessage.mock.calls.find((call) => call[1].type === 'error');
        expect(error).toBeTruthy();
        expect(network.ircClient.say).not.toHaveBeenCalled();

        network.enabled_caps = ['message-tags'];
        network.isupport.CLIENTTAGDENY = ['*'];
        addMessage = jest.spyOn(s, 'addMessage');

        handler.processLine('/auto SupyBot: foo', { network, buffer });

        error = addMessage.mock.calls.find((call) => call[1].type === 'error');
        expect(error).toBeTruthy();
        expect(network.ircClient.say).not.toHaveBeenCalled();
    });
});

describe('AutoComplete key handling', () => {
    function makeContext(selectedItem) {
        return {
            selectedItem,
            selectCurrentItem: jest.fn(),
            cancel: jest.fn(),
            itemValue: AutoComplete.methods.itemValue,
        };
    }

    test('handles Tab, Enter, modified Enter, space, punctuation, and Shift+Tab', () => {
        let context = makeContext({ text: 'time' });
        let event = { key: 'Tab', preventDefault: jest.fn() };
        expect(AutoComplete.methods.handleOnKeyDown.call(context, event)).toBe(true);
        expect(context.selectCurrentItem).toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();

        context = makeContext({ text: 'time' });
        event = { key: 'Enter', preventDefault: jest.fn() };
        expect(AutoComplete.methods.handleOnKeyDown.call(context, event)).toBe(true);
        expect(context.selectCurrentItem).toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();

        context = makeContext({ text: 'time' });
        event = { key: 'Enter', shiftKey: true, preventDefault: jest.fn() };
        expect(AutoComplete.methods.handleOnKeyDown.call(context, event)).toBe(false);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();

        context = makeContext({ text: 'time' });
        expect(AutoComplete.methods.handleOnKeyDown.call(context, { key: ' ' }))
            .toBe(false);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(context.cancel).toHaveBeenCalled();

        context = makeContext({ text: 'time' });
        expect(AutoComplete.methods.handleOnKeyDown.call(context, { key: ',' }))
            .toBe(false);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(context.cancel).toHaveBeenCalled();

        context = makeContext({ text: 'time' });
        context.selected_idx = 1;
        context.filteredItems = [{ text: 'one' }, { text: 'two' }];
        event = { key: 'Tab', shiftKey: true, preventDefault: jest.fn() };
        expect(AutoComplete.methods.handleOnKeyDown.call(context, event)).toBe(true);
        expect(context.selected_idx).toBe(0);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();
    });
});

describe('AutoComplete emoji sources', () => {
    const context = {
        $t: (key) => key,
    };

    test('resolves source labels, titles, and insert text', () => {
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '#channel',
            packName: 'Channel Pack',
            sourceType: 'channel',
        })).toBe('Channel Pack');
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '#channel',
            sourceType: 'channel',
        })).toBe('#channel');
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '',
            sourceType: 'unicode',
        })).toBe('emoji_source_unicode');
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '',
            sourceType: 'local',
        })).toBe('emoji_source_local');
        expect(AutoComplete.methods.emojiSourceTitle.call(context, {
            packId: '#channel/pack',
            channelName: '#channel',
        })).toBe('#channel/pack · #channel');
        expect(AutoComplete.methods.itemValue({
            text: ':wave/#channel:',
            insertText: ':wave:',
        })).toBe(':wave:');
        expect(AutoComplete.methods.itemValue({ text: 'nickname' })).toBe('nickname');
    });
});

describe('AutoComplete user display names', () => {
    test('filters users by display-name without changing completion text', () => {
        const items = [{
            text: 'ankle',
            type: 'user',
            displayName: 'Jeremy',
            alias: ['Jeremy'],
        }];

        const filtered = AutoComplete.computed.filteredItems.call({
            items,
            filter: 'jer',
        });

        expect(filtered).toHaveLength(1);
        expect(filtered[0].text).toBe('ankle');
        expect(filtered[0].displayName).toBe('Jeremy');
        expect(AutoComplete.methods.itemValue(filtered[0])).toBe('ankle');
    });
});
