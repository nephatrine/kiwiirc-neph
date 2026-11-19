import autocompleteMiddleware from '@/libs/AutocompleteMiddleware';
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
