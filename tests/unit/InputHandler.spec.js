jest.mock('@/libs/desktop/ChatLogs', () => ({
    isAvailable: jest.fn(() => false),
}));

import { TextEncoder } from 'util';
import InputHandler from '@/libs/InputHandler';
import GlobalApi from '@/libs/GlobalApi';
import appState from '@/libs/state';
import * as ChatLogs from '@/libs/desktop/ChatLogs';
import * as TextFormatting from '@/helpers/TextFormatting';
import { configTemplates } from '@/res/configTemplates';
import AliasRewriter from '@/libs/AliasRewriter';

/* eslint-disable no-underscore-dangle */

// src/main.js supplies these through webpack's DefinePlugin; jest does not.
global.__VERSION__ = '2.0.0';
global.__COMMITHASH__ = 'testhash';

// jsdom lacks TextEncoder, which the advertised byte-limit checks use.
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}

function makeHandler() {
    const state = {
        setting: jest.fn(() => ''),
        $watch: jest.fn(),
        $on: jest.fn(),
        $emit: jest.fn(),
        addMessage: jest.fn(),
    };
    return new InputHandler(state);
}

function makeContext(isChannel = true) {
    const user = {
        nick: 'streamer',
        metadata: {
            'display-name': 'Streamer',
            'color': '#9146ff',
            'user-id': '12345',
        },
        displayName: jest.fn(() => 'Streamer'),
    };
    const network = {
        name: 'twitch',
        nick: 'streamer',
        connection: {
            server: 'irc.chat.twitch.tv',
        },
        currentUser: jest.fn(() => user),
        ensureTwitchUser: jest.fn(),
        isChannelName: jest.fn(() => isChannel),
        ircClient: {
            raw: jest.fn(),
        },
        appState: {
            addMessage: jest.fn((buffer, message) => message),
            $emit: jest.fn(),
        },
    };
    const buffer = {
        name: '#channel',
        isChannel: jest.fn(() => isChannel),
    };

    return { network, buffer, user };
}

describe('InputHandler /fakesub', () => {
    it('adds a fake subscription notice to a channel', () => {
        const handler = makeHandler();
        const { network, buffer } = makeContext();

        handler.processLine('/fakesub Hello there', { network, buffer });

        expect(network.ircClient.raw).not.toHaveBeenCalled();
        expect(network.ensureTwitchUser).toHaveBeenCalledWith(
            'streamer',
            'streamer',
            '',
            expect.objectContaining({
                'msg-id': 'resub',
                'login': 'streamer',
                'display-name': 'Streamer',
            })
        );
        expect(network.appState.addMessage).toHaveBeenCalledTimes(1);

        const [targetBuffer, message] = network.appState.addMessage.mock.calls[0];
        expect(targetBuffer).toBe(buffer);
        expect(message).toEqual(expect.objectContaining({
            type: 'twitch_usernotice',
            type_extra: 'resub',
            nick: 'streamer',
            raw_text: 'Hello there',
        }));
        expect(message.tags['msg-param-sub-plan']).toBe('1000');
        expect(message.tags['msg-param-cumulative-months']).toBe('12');
        expect(message.tags['msg-param-streak-months']).toBe('3');
        expect(message.tags['subscriber']).toBe('1');
        expect(message.irc_id).toBeTruthy();

        const defaultContext = makeContext();
        handler.processLine('/fakesub', defaultContext);
        const defaultMessage = defaultContext.network.appState.addMessage.mock.calls[0][1];
        expect(defaultMessage.raw_text).toBe('Nice stream!');
    });

    it('does nothing outside a channel', () => {
        const handler = makeHandler();
        const { network, buffer } = makeContext(false);

        handler.processLine('/fakesub Hello', { network, buffer });

        expect(network.appState.addMessage).not.toHaveBeenCalled();
        expect(network.ircClient.raw).not.toHaveBeenCalled();
    });
});

describe('InputHandler plugin commands', () => {
    it('dispatches registered commands case-insensitively', () => {
        const handler = makeHandler();
        const { network, buffer } = makeContext();
        const api = GlobalApi.singleton();
        const pluginHandler = jest.fn((event) => {
            event.handled = true;
        });

        api.registerCommand('LIM', pluginHandler);

        try {
            handler.processLine('/LiM hello world', { network, buffer });
        } finally {
            delete api.commands.lim;
        }

        expect(pluginHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                command: 'LiM',
                params: 'hello world',
                handled: true,
            }),
            'LiM',
            'hello world',
            { network, buffer }
        );
        expect(network.ircClient.raw).not.toHaveBeenCalled();
    });
});

describe('InputHandler advertised limits', () => {
    let tSpy;

    beforeEach(() => {
        tSpy = jest.spyOn(TextFormatting, 't').mockImplementation((key) => key);
    });

    afterEach(() => {
        tSpy.mockRestore();
    });

    function makeLimitContext(limits = {}) {
        const state = {
            setting: jest.fn(() => ''),
            $watch: jest.fn(),
            $on: jest.fn(),
            $emit: jest.fn(),
            addMessage: jest.fn(),
            addBuffer: jest.fn((networkid, name) => ({ name, key: '' })),
            setActiveBuffer: jest.fn(),
        };
        const network = {
            id: 1,
            nick: 'TestNick',
            name: 'TestNetwork',
            connection: { server: 'irc.example.com' },
            isupportLimit: jest.fn((name) => limits[name] || 0),
            isChannelName: jest.fn((name) => /^[#&]/.test(name)),
            ircClient: {
                join: jest.fn(),
                setTopic: jest.fn(),
                raw: jest.fn(),
                changeNick: jest.fn(),
            },
        };
        const buffer = {
            name: '#test',
            key: '',
            isChannel: jest.fn(() => true),
            isServer: jest.fn(() => false),
        };
        const handler = new InputHandler(state);

        return { handler, state, network, buffer };
    }

    it('rejects a channel name over CHANNELLEN by byte count', () => {
        const { handler, state, network, buffer } =
            makeLimitContext({ CHANNELLEN: 4 });

        handler.processLine('/join #éé', { network, buffer });

        expect(network.ircClient.join).not.toHaveBeenCalled();
        expect(state.addBuffer).not.toHaveBeenCalled();
        expect(state.addMessage).toHaveBeenCalledWith(
            buffer,
            expect.objectContaining({
                type: 'error',
                message: 'error_channel_too_long',
            })
        );
        expect(tSpy).toHaveBeenCalledWith('error_channel_too_long', {
            current: 5,
            max: 4,
        });
    });

    it('allows a channel name at CHANNELLEN', () => {
        const { handler, state, network, buffer } =
            makeLimitContext({ CHANNELLEN: 5 });

        handler.processLine('/join #éé', { network, buffer });

        expect(network.ircClient.join).toHaveBeenCalledWith('#éé', '');
        expect(state.addMessage).not.toHaveBeenCalled();
    });

    it('rejects topic, kick, away, and nick values over their limits', () => {
        const cases = [
            ['/topic éé', { TOPICLEN: 3 }, 'setTopic', 'error_topic_too_long'],
            ['/kick Other éé', { KICKLEN: 3 }, 'raw', 'error_kick_reason_too_long'],
            ['/away éé', { AWAYLEN: 3 }, 'raw', 'error_away_too_long'],
            ['/nick éé', { NICKLEN: 3 }, 'changeNick', 'error_nick_too_long'],
        ];

        cases.forEach(([line, limits, method, errorKey]) => {
            const { handler, state, network, buffer } = makeLimitContext(limits);

            handler.processLine(line, { network, buffer });

            expect(network.ircClient[method]).not.toHaveBeenCalled();
            expect(state.addMessage).toHaveBeenCalledWith(
                buffer,
                expect.objectContaining({ type: 'error', message: errorKey })
            );
        });
    });
});

describe('InputHandler /search', () => {
    let tSpy;

    beforeEach(() => {
        tSpy = jest.spyOn(TextFormatting, 't').mockImplementation((key) => key);
        ChatLogs.isAvailable.mockReturnValue(false);
    });

    afterEach(() => {
        tSpy.mockRestore();
    });

    function makeSearchContext() {
        const handler = makeHandler();
        const { network, buffer } = makeContext();
        network.id = 7;
        network.state = 'connected';
        return { handler, network, buffer };
    }

    it('opens server search for the current buffer', () => {
        const { handler, network, buffer } = makeSearchContext();
        network.ircClient.search = {
            isSupported: () => true,
        };

        handler.processLine('/search hello there', { network, buffer });

        expect(handler.state.$emit).toHaveBeenCalledWith('chatlogs.open', {
            source: 'server',
            networkId: 7,
            bufferName: '#channel',
            query: 'hello there',
        });
        expect(network.ircClient.raw).not.toHaveBeenCalled();
    });

    it('opens local log search when server search is unavailable', () => {
        ChatLogs.isAvailable.mockReturnValue(true);
        const { handler, network, buffer } = makeSearchContext();

        handler.processLine('/search hello', { network, buffer });

        expect(handler.state.$emit).toHaveBeenCalledWith('chatlogs.open', {
            source: 'local',
            networkId: 7,
            bufferName: '#channel',
            query: 'hello',
        });
        expect(network.ircClient.raw).not.toHaveBeenCalled();
    });

    it('does not send a raw SEARCH command when no source is available', () => {
        const { handler, network, buffer } = makeSearchContext();

        handler.processLine('/search hello', { network, buffer });

        expect(handler.state.addMessage).toHaveBeenCalledWith(
            buffer,
            expect.objectContaining({
                type: 'error',
                message: 'chatlogs_search_unavailable',
            })
        );
        expect(handler.state.$emit).not.toHaveBeenCalledWith(
            'chatlogs.open',
            expect.anything()
        );
        expect(network.ircClient.raw).not.toHaveBeenCalled();
    });

    it('requires search terms', () => {
        const { handler, network, buffer } = makeSearchContext();
        network.ircClient.search = {
            isSupported: () => true,
        };

        handler.processLine('/search', { network, buffer });

        expect(handler.state.addMessage).toHaveBeenCalledWith(
            buffer,
            expect.objectContaining({
                type: 'error',
                message: 'chatlogs_search_usage',
            })
        );
        expect(handler.state.$emit).not.toHaveBeenCalledWith(
            'chatlogs.open',
            expect.anything()
        );
    });
});

describe('special buffer message pending', () => {
    let s;
    let network;
    let handler;

    beforeEach(() => {
        s = appState.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.enabled_caps = ['labeled-response', 'echo-message'];
        handler = new InputHandler(s);
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function lastMessage(buffer) {
        const messages = buffer.getMessages();
        return messages[messages.length - 1];
    }

    it('sends without label in *raw but labels and pends normal channels', () => {
        let buffer = s.getOrAddBufferByName(network.id, '*raw');
        handler.processLine('oops test', { network, buffer });

        expect(network.ircClient.say).toHaveBeenCalledTimes(1);
        let [target, , tags] = network.ircClient.say.mock.calls[0];
        expect(target).toBe('*raw');
        expect(tags.label).toBeUndefined();
        expect(lastMessage(buffer).is_pending).toBe(false);

        network.ircClient.say.mockClear();
        buffer = s.getOrAddBufferByName(network.id, '#chan');
        handler.processLine('hello', { network, buffer });

        expect(network.ircClient.say).toHaveBeenCalledTimes(1);
        [, , tags] = network.ircClient.say.mock.calls[0];
        expect(tags.label).toEqual(expect.any(String));
        const message = lastMessage(buffer);
        expect(message.is_pending).toBe(true);
        expect(buffer.messagesObj.messageLabels[tags.label]).toBe(message);
    });

    it('keeps label and pending state in query buffers', () => {
        const buffer = s.getOrAddBufferByName(network.id, 'SomeNick');
        handler.processLine('hello', { network, buffer });

        const [, , tags] = network.ircClient.say.mock.calls[0];
        expect(tags.label).toEqual(expect.any(String));
        expect(lastMessage(buffer).is_pending).toBe(true);
    });
});

describe('default aliases', () => {
    function makeRewriter() {
        const rewriter = new AliasRewriter();
        rewriter.importFromString(configTemplates.default.aliases);
        return rewriter;
    }

    const vars = {
        channel: '#chan',
        destination: '#chan',
        nick: 'TestNick',
    };

    it('routes service aliases and topic commands', () => {
        const rewriter = makeRewriter();
        expect(rewriter.process('/ns register hunter2', vars))
            .toBe('/msg NickServ register hunter2');
        expect(rewriter.process('/cs register #chan', vars))
            .toBe('/msg ChanServ register #chan');
        expect(rewriter.process('/hs request myhost', vars))
            .toBe('/msg HostServ request myhost');
        expect(rewriter.process('/ms TestNick hello', vars))
            .toBe('/msg MemoServ TestNick hello');
        expect(rewriter.process('/t a brand new topic', vars))
            .toBe('/topic #chan a brand new topic');
        expect(rewriter.process('/t', vars)).toBe('/topic #chan');
    });

    it('routes join and query shorthand', () => {
        const rewriter = makeRewriter();
        expect(rewriter.process('/j #chan', vars)).toBe('/join #chan');
        expect(rewriter.process('/q TestNick', vars)).toBe('/query TestNick');
    });
});

describe('InputHandler typographic replacements', () => {
    function makeOutgoing(settings = {}) {
        const buffer = {
            name: '#channel',
            networkid: 1,
            replying_to: null,
            isChannel: () => true,
            isSpecial: () => false,
            promoteServerContext: jest.fn(),
        };
        const network = {
            id: 1,
            nick: 'me',
            isUtf8: settings.utf8 !== false,
            connection: { server: 'irc.example.com' },
            isChannelName: () => true,
            extractTargetGroup: () => null,
            hasCap: () => false,
            replyTagName: () => '',
            isTwitch: () => false,
            ircClient: {
                say: jest.fn(),
                action: jest.fn(),
                notice: jest.fn(),
                raw: jest.fn(),
            },
        };
        const state = {
            setting: jest.fn((key) => {
                if (key === 'buffers.typographic_replacements') {
                    return settings.enabled !== false;
                }
                return '';
            }),
            $watch: jest.fn(),
            $on: jest.fn(),
            $emit: jest.fn(),
            addMessage: jest.fn(),
            getOrAddBufferByName: jest.fn(() => buffer),
        };

        return {
            handler: new InputHandler(state),
            network,
            buffer,
            state,
            context: { network, buffer },
        };
    }

    test('converts normal messages when the network is UTF-8', () => {
        const { handler, network, state, context } = makeOutgoing();

        handler.processLine('/msg #channel -- hi ... (c)', context);

        expect(network.ircClient.say).toHaveBeenCalledWith(
            '#channel',
            '\u2013 hi \u2026 \u00a9',
            {}
        );
        expect(state.addMessage.mock.calls[0][1]).toEqual(expect.objectContaining({
            raw_text: '\u2013 hi \u2026 \u00a9',
        }));
    });

    test('converts /me actions', () => {
        const { handler, network, context } = makeOutgoing();

        handler.processLine('/action #channel waves --', context);

        expect(network.ircClient.action).toHaveBeenCalledWith(
            '#channel',
            'waves \u2013',
            {}
        );
    });

    test('leaves notices, non-UTF-8 networks, and disabled settings alone', () => {
        const notice = makeOutgoing();
        notice.handler.processLine('/notice #channel --', notice.context);
        expect(notice.network.ircClient.notice).toHaveBeenCalledWith(
            '#channel',
            '--',
            {}
        );

        const nonUtf8 = makeOutgoing({ utf8: false });
        nonUtf8.handler.processLine('/msg #channel --', nonUtf8.context);
        expect(nonUtf8.network.ircClient.say).toHaveBeenCalledWith(
            '#channel',
            '--',
            {}
        );

        const disabled = makeOutgoing({ enabled: false });
        disabled.handler.processLine('/msg #channel --', disabled.context);
        expect(disabled.network.ircClient.say).toHaveBeenCalledWith(
            '#channel',
            '--',
            {}
        );
    });

    test('protects URLs, backticks, and IRC monospace', () => {
        const { handler, network, context } = makeOutgoing();
        const message = 'https://example.com/a--b... `--` \x11--\x11';
        const expected = 'https://example.com/a--b... `--` \x11--\x11';

        handler.processLine(`/msg #channel ${message}`, context);

        expect(network.ircClient.say).toHaveBeenCalledWith(
            '#channel',
            expected,
            {}
        );
    });
});

describe('InputHandler outgoing message filters', () => {
    function makeOutgoing() {
        const buffer = {
            name: '#channel',
            networkid: 1,
            replying_to: null,
            isChannel: () => true,
            isSpecial: () => false,
            promoteServerContext: jest.fn(),
        };
        const network = {
            id: 1,
            nick: 'me',
            isUtf8: true,
            connection: { server: 'irc.example.com' },
            isChannelName: () => true,
            extractTargetGroup: () => null,
            hasCap: () => false,
            replyTagName: () => '',
            isTwitch: () => false,
            ircClient: {
                say: jest.fn(),
                action: jest.fn(),
                notice: jest.fn(),
                raw: jest.fn(),
            },
        };
        const state = {
            setting: jest.fn(() => ''),
            $watch: jest.fn(),
            $on: jest.fn(),
            $emit: jest.fn(),
            addMessage: jest.fn(),
            getOrAddBufferByName: jest.fn(() => buffer),
        };

        return {
            handler: new InputHandler(state),
            network,
            buffer,
            state,
            context: { network, buffer },
        };
    }

    afterEach(() => {
        GlobalApi.singleton().outgoingMessageFilters.length = 0;
    });

    test('sends and echoes the filtered text', () => {
        GlobalApi.singleton().addOutgoingMessageFilter((context) => ({
            wireText: '+OK ' + context.text,
            displayText: context.text + ' ⚷',
            isEncrypted: true,
        }));

        const { handler, network, state, context } = makeOutgoing();
        handler.processLine('/msg #channel hello', context);

        expect(network.ircClient.say).toHaveBeenCalledWith('#channel', '+OK hello', {});

        const echo = state.addMessage.mock.calls[0][1];
        expect(echo).toEqual(expect.objectContaining({
            raw_text: '+OK hello',
            is_encrypted: true,
        }));
        expect(echo.message).toBe('hello ⚷');
    });

    test('holds the message until an asynchronous filter resolves', async() => {
        let release = null;
        GlobalApi.singleton().addOutgoingMessageFilter((context) => (
            new Promise((resolve) => {
                release = () => resolve({ wireText: '+OK ' + context.text });
            })
        ));

        const { handler, network, context } = makeOutgoing();
        handler.processLine('/msg #channel hello', context);

        expect(network.ircClient.say).not.toHaveBeenCalled();

        release();
        await Promise.resolve();
        await Promise.resolve();

        expect(network.ircClient.say).toHaveBeenCalledWith('#channel', '+OK hello', {});
    });

    test('cancels the message and reports why', () => {
        GlobalApi.singleton().addOutgoingMessageFilter(() => ({
            cancel: true,
            error: 'not sent',
        }));

        const { handler, network, buffer, state, context } = makeOutgoing();
        handler.processLine('/msg #channel hello', context);

        expect(network.ircClient.say).not.toHaveBeenCalled();
        expect(state.addMessage).toHaveBeenCalledWith(buffer, expect.objectContaining({
            type: 'error',
            message: 'not sent',
        }));
    });

    test('filters actions and notices too', () => {
        GlobalApi.singleton().addOutgoingMessageFilter((context) => ({
            wireText: '+OK ' + context.text,
        }));

        const { handler, network, context } = makeOutgoing();
        handler.processLine('/action #channel waves', context);
        handler.processLine('/notice #channel hi', context);

        expect(network.ircClient.action).toHaveBeenCalledWith('#channel', '+OK waves', {});
        expect(network.ircClient.notice).toHaveBeenCalledWith('#channel', '+OK hi', {});
    });

    test('parses a multiline bridge card into the local echo', () => {
        const { handler, network, state, context } = makeOutgoing();

        handler.processLine('/msg #channel [EMBED]\nTitle: A title\nBody text', context);

        expect(network.ircClient.say).toHaveBeenCalled();
        const echo = state.addMessage.mock.calls[0][1];
        expect(echo.bridge_card).toEqual(expect.objectContaining({
            marker: 'embed',
            title: 'A title',
            body: 'Body text',
        }));
        expect(echo.message).toBe('Body text');
    });

    test('does not card a single-line bridge marker', () => {
        const { handler, state, context } = makeOutgoing();

        handler.processLine('/msg #channel [EMBED] Title: A title', context);

        const echo = state.addMessage.mock.calls[0][1];
        expect(echo.bridge_card).toBeNull();
        expect(echo.message).toContain('[EMBED]');
    });
});
