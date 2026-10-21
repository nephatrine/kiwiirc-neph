import state from '@/libs/state';
import { theMiddleware, isTwitchNoticeError } from '@/libs/TwitchMiddleware';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key) => key),
        formatText: jest.fn((formatId, params) => `${formatId}:${params.text}`),
    };
});

function makeNetwork(overrides = {}) {
    const currentUser = { nick: 'Me', metadata: {} };
    const actorUser = { nick: 'streamer', metadata: { 'display-name': 'Streamer' } };
    const channel = {
        name: '#channel',
        messagesObj: {
            messages: [],
            messageIds: {},
        },
    };
    const network = {
        currentUser: jest.fn(() => currentUser),
        userByTwitchId: jest.fn(() => undefined),
        bufferByName: jest.fn(() => channel),
        applyTwitchUserTags: jest.fn((user) => user),
        applyTwitchUserModes: jest.fn(),
        ensureTwitchUser: jest.fn(() => actorUser),
        isTwitch: jest.fn(() => true),
        hasTwitchCommands: jest.fn(() => true),
        hasCap: jest.fn(() => true),
        ircClient: {
            connection: {
                auto_reconnect: false,
            },
        },
        appState: {
            $emit: jest.fn(),
            addMessage: jest.fn((buffer, message) => ({ ...message, buffer })),
        },
        ...overrides,
    };

    return { network, currentUser, actorUser, channel };
}

function dispatch(network, command, params = [], tags = {}) {
    const next = jest.fn();
    theMiddleware(network, 'unknown command', {
        command,
        params,
        tags,
    }, {}, next);
    return next;
}

function chatMessage(nick, userId, type = 'privmsg') {
    return {
        nick,
        type,
        tags: { 'user-id': userId },
        is_redacted: false,
    };
}

describe('TwitchMiddleware', () => {
    it('applies GLOBALUSERSTATE tags to the current user', () => {
        const { network, currentUser } = makeNetwork();
        const tags = {
            'user-id': '123',
            'display-name': 'Bongo',
            'color': '#ff00aa',
            'badges': 'subscriber/1',
            'emote-sets': '0,1',
            'turbo': '0',
        };

        const next = dispatch(network, 'GLOBALUSERSTATE', [], tags);

        expect(network.applyTwitchUserTags).toHaveBeenCalledWith(currentUser, tags);
        expect(network.applyTwitchUserModes).not.toHaveBeenCalled();
        expect(network.appState.$emit).toHaveBeenCalledWith('twitch.globaluserstate', {
            network,
            buffer: undefined,
            user: currentUser,
            tags,
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('applies USERSTATE tags using the channel and mapped user', () => {
        const mappedUser = { nick: 'Other', metadata: {} };
        const { network, channel } = makeNetwork({
            userByTwitchId: jest.fn(() => mappedUser),
        });

        const next = dispatch(network, 'USERSTATE', ['#channel'], {
            'user-id': '456',
            'display-name': 'Other',
        });

        expect(network.userByTwitchId).toHaveBeenCalledWith('456');
        expect(network.applyTwitchUserTags).toHaveBeenCalledWith(mappedUser, {
            'user-id': '456',
            'display-name': 'Other',
        });
        expect(network.applyTwitchUserModes).toHaveBeenCalledWith(channel, mappedUser, {
            'user-id': '456',
            'display-name': 'Other',
        });
        expect(network.appState.$emit).toHaveBeenCalledWith('twitch.userstate', {
            network,
            buffer: channel,
            user: mappedUser,
            tags: {
                'user-id': '456',
                'display-name': 'Other',
            },
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('leaves unsupported Twitch commands for normal server handling', () => {
        const { network } = makeNetwork();
        const next = dispatch(network, 'HOSTTARGET', ['#channel'], {});

        expect(next).toHaveBeenCalled();
        expect(network.appState.$emit).not.toHaveBeenCalledWith(
            'twitch.command',
            expect.anything()
        );
    });

    it('posts the initial ROOMSTATE mode message and emits state', () => {
        const { network, channel } = makeNetwork();

        const next = dispatch(network, 'ROOMSTATE', ['#channel'], {
            'emote-only': '1',
            'followers-only': '10',
            'r9k': '1',
            'slow': '5',
            'subs-only': '1',
            'room-id': '123',
        });

        const roomStateEvents = network.appState.$emit.mock.calls
            .filter(([name]) => name === 'twitch.roomstate');
        expect(roomStateEvents).toHaveLength(1);

        const event = roomStateEvents[0][1];
        expect(event.network).toBe(network);
        expect(event.buffer).toBe(channel);
        expect(event.changed).toBe(true);
        expect(event.state).toEqual(expect.objectContaining({
            emoteOnly: true,
            followersOnly: 10,
            r9k: true,
            slow: 5,
            subsOnly: true,
            roomId: '123',
        }));
        expect(event.message).toEqual(expect.objectContaining({
            type: 'mode',
            type_extra: 'twitch_roomstate',
            nick: '',
        }));
        expect(network.appState.addMessage).toHaveBeenCalledWith(channel, expect.objectContaining({
            type: 'mode',
            type_extra: 'twitch_roomstate',
            nick: '',
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('merges incremental ROOMSTATE tags and posts when modes change', () => {
        const { network } = makeNetwork();
        dispatch(network, 'ROOMSTATE', ['#channel'], {
            'emote-only': '1',
            'followers-only': '0',
            'slow': '5',
        });

        const next = dispatch(network, 'ROOMSTATE', ['#channel'], {
            slow: '0',
        });

        const roomStateEvents = network.appState.$emit.mock.calls
            .filter(([name]) => name === 'twitch.roomstate');
        const event = roomStateEvents[roomStateEvents.length - 1][1];
        expect(event.changed).toBe(true);
        expect(event.state).toEqual(expect.objectContaining({
            emoteOnly: true,
            followersOnly: 0,
            slow: 0,
        }));
        expect(network.appState.addMessage).toHaveBeenCalledTimes(2);
        expect(next).not.toHaveBeenCalled();
    });

    it('does not post duplicate ROOMSTATE messages when nothing changed', () => {
        const { network } = makeNetwork();
        const tags = { 'emote-only': '1', 'slow': '5' };
        dispatch(network, 'ROOMSTATE', ['#channel'], tags);

        const next = dispatch(network, 'ROOMSTATE', ['#channel'], tags);

        const roomStateEvents = network.appState.$emit.mock.calls
            .filter(([name]) => name === 'twitch.roomstate');
        const event = roomStateEvents[roomStateEvents.length - 1][1];
        expect(event.changed).toBe(false);
        expect(event.message).toBeUndefined();
        expect(network.appState.addMessage).toHaveBeenCalledTimes(1);
        expect(next).not.toHaveBeenCalled();
    });

    it('handles ROOMSTATE without a channel buffer safely', () => {
        const { network } = makeNetwork({
            bufferByName: jest.fn(() => undefined),
        });

        const next = dispatch(network, 'ROOMSTATE', ['#missing'], { slow: '5' });

        expect(network.appState.addMessage).not.toHaveBeenCalled();
        expect(network.appState.$emit).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    it('redacts all chat messages in the channel on CLEARCHAT', () => {
        const { network, channel } = makeNetwork();
        const alice = chatMessage('alice', '1');
        const bob = chatMessage('bob', '2', 'action');
        const traffic = { nick: '', type: 'traffic', tags: {}, is_redacted: false };
        channel.messagesObj.messages.push(alice, bob, traffic);

        const next = dispatch(network, 'CLEARCHAT', ['#channel'], {});

        expect(alice.is_redacted).toBe(true);
        expect(bob.is_redacted).toBe(true);
        expect(traffic.is_redacted).toBe(false);
        expect(alice.redacted_by).toBe('Twitch');
        expect(alice.redaction_reason).toBe('Chat cleared');
        expect(channel.messagesObj.messages).toHaveLength(3);
        expect(network.appState.$emit).toHaveBeenCalledWith('message.redaction', {
            message: alice,
            buffer: channel,
        });
        expect(network.appState.$emit).toHaveBeenCalledWith('twitch.clearchat', {
            network,
            buffer: channel,
            targetUserId: undefined,
            targetNick: '',
            tags: {},
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('redacts only a target user on CLEARCHAT', () => {
        const { network, channel } = makeNetwork();
        const alice = chatMessage('alice', '1');
        const bob = chatMessage('bob', '2');
        channel.messagesObj.messages.push(alice, bob);

        const next = dispatch(network, 'CLEARCHAT', ['#channel', 'alice'], {
            'target-user-id': '1',
            'ban-duration': '600',
        });

        expect(alice.is_redacted).toBe(true);
        expect(bob.is_redacted).toBe(false);
        expect(alice.redaction_reason).toBe('Timed out for 600 seconds');
        expect(next).not.toHaveBeenCalled();
    });

    it('falls back to the username when target-user-id is absent', () => {
        const { network, channel } = makeNetwork();
        const alice = chatMessage('alice', '1');
        const bob = chatMessage('bob', '2');
        channel.messagesObj.messages.push(alice, bob);

        const next = dispatch(network, 'CLEARCHAT', ['#channel', 'alice'], {});

        expect(alice.is_redacted).toBe(true);
        expect(bob.is_redacted).toBe(false);
        expect(alice.redaction_reason).toBe('Banned');
        expect(next).not.toHaveBeenCalled();
    });

    it('redacts only the target message on CLEARMSG', () => {
        const { network, channel } = makeNetwork();
        const alice = chatMessage('alice', '1');
        const bob = chatMessage('bob', '2');
        alice.irc_id = 'msg-1';
        channel.messagesObj.messages.push(alice, bob);
        channel.messagesObj.messageIds['msg-1'] = alice;

        const next = dispatch(network, 'CLEARMSG', ['#channel'], {
            'target-msg-id': 'msg-1',
        });

        expect(alice.is_redacted).toBe(true);
        expect(bob.is_redacted).toBe(false);
        expect(alice.redaction_reason).toBe('Message deleted');
        expect(network.appState.$emit).toHaveBeenCalledWith('twitch.clearmsg', {
            network,
            buffer: channel,
            targetMsgId: 'msg-1',
            message: alice,
            tags: {
                'target-msg-id': 'msg-1',
            },
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('allows one reconnect on RECONNECT', () => {
        const { network } = makeNetwork();

        const next = dispatch(network, 'RECONNECT');

        expect(network.ircClient.connection.auto_reconnect).toBe(true);
        expect(network.appState.$emit).toHaveBeenCalledWith('twitch.reconnect', {
            network,
            message: expect.any(Object),
        });
        expect(network.appState.$emit).not.toHaveBeenCalledWith(
            'twitch.command',
            expect.anything()
        );
        expect(next).not.toHaveBeenCalled();
    });

    it('handles RECONNECT without an ircClient safely', () => {
        const { network } = makeNetwork({ ircClient: undefined });

        const next = dispatch(network, 'RECONNECT');

        expect(network.appState.$emit).toHaveBeenCalledWith('twitch.reconnect', {
            network,
            message: expect.any(Object),
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('handles RECONNECT without a connection safely', () => {
        const { network } = makeNetwork({ ircClient: {} });

        const next = dispatch(network, 'RECONNECT');

        expect(network.appState.$emit).toHaveBeenCalledWith('twitch.reconnect', {
            network,
            message: expect.any(Object),
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('renders USERNOTICE as a rich event message', () => {
        const { network, channel } = makeNetwork();
        const tags = {
            'msg-id': 'resub',
            'system-msg': 'Streamer subscribed at Tier 1.',
            'login': 'streamer',
            'display-name': 'Streamer',
            'id': 'notice-1',
            'tmi-sent-ts': '1700000000000',
            'emotes': '25:12-16',
        };

        const next = dispatch(
            network,
            'USERNOTICE',
            ['#channel', 'Nice stream Kappa'],
            tags
        );

        expect(network.ensureTwitchUser).toHaveBeenCalledWith(
            'streamer',
            'streamer',
            '',
            tags
        );
        expect(network.appState.addMessage).toHaveBeenCalledWith(channel, expect.objectContaining({
            type: 'twitch_usernotice',
            type_extra: 'resub',
            nick: 'streamer',
            message: 'Nice stream :Kappa:',
            raw_text: 'Nice stream Kappa',
            tags,
            irc_id: 'notice-1',
            template: expect.anything(),
        }));

        const added = network.appState.addMessage.mock.calls[0][1];
        expect(added.time.getTime()).toBe(1700000000000);
        expect(added.server_time).toBe(added.time);

        expect(network.appState.$emit).toHaveBeenCalledWith('twitch.usernotice', {
            network,
            buffer: channel,
            message: expect.objectContaining({
                type: 'twitch_usernotice',
            }),
            tags,
            msgId: 'resub',
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('renders an unknown USERNOTICE type with the generic event card', () => {
        const { network, channel } = makeNetwork();
        const tags = {
            'msg-id': 'future-event',
            'system-msg': 'Something happened.',
            'login': 'streamer',
        };

        const next = dispatch(network, 'USERNOTICE', ['#channel'], tags);

        expect(network.appState.addMessage).toHaveBeenCalledWith(channel, expect.objectContaining({
            type: 'twitch_usernotice',
            type_extra: 'future-event',
            nick: 'streamer',
            message: '',
            raw_text: '',
            template: expect.anything(),
        }));
        expect(network.appState.$emit).toHaveBeenCalledWith(
            'twitch.usernotice',
            expect.objectContaining({
                msgId: 'future-event',
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it('handles USERNOTICE without a channel buffer safely', () => {
        const { network } = makeNetwork({
            bufferByName: jest.fn(() => undefined),
        });

        const next = dispatch(network, 'USERNOTICE', ['#missing'], {
            'msg-id': 'sub',
            'login': 'streamer',
        });

        expect(network.ensureTwitchUser).not.toHaveBeenCalled();
        expect(network.appState.addMessage).not.toHaveBeenCalled();
        expect(network.appState.$emit).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    it('processes commands by capability even on non-Twitch hosts', () => {
        const { network } = makeNetwork({
            isTwitch: jest.fn(() => false),
            hasTwitchCommands: jest.fn(() => true),
        });
        const next = dispatch(network, 'USERSTATE', ['#channel']);

        expect(next).not.toHaveBeenCalled();
        expect(network.appState.$emit).toHaveBeenCalledWith(
            'twitch.userstate',
            expect.any(Object)
        );
    });

    it('passes commands through when the Twitch commands cap is absent', () => {
        const { network } = makeNetwork({
            hasTwitchCommands: jest.fn(() => false),
        });
        const next = dispatch(network, 'GLOBALUSERSTATE');

        expect(next).toHaveBeenCalled();
        expect(network.appState.$emit).not.toHaveBeenCalled();
    });

    it('passes unrelated unknown commands through', () => {
        const { network } = makeNetwork();
        const next = dispatch(network, 'SOMETHINGELSE');

        expect(next).toHaveBeenCalled();
        expect(network.appState.$emit).not.toHaveBeenCalled();
    });

    it('handles a missing message safely', () => {
        const next = jest.fn();
        theMiddleware(makeNetwork().network, 'unknown command', null, {}, next);

        expect(next).toHaveBeenCalled();
    });
});

describe('Twitch message IDs', () => {
    it('stores a supplied Twitch id as irc_id and messageIds', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        const buffer = s.getOrAddBufferByName(network.id, '#channel');
        const message = {
            nick: 'Alice',
            message: 'hello',
            raw_text: 'hello',
            type: 'privmsg',
            tags: { id: 'twitch-message-id' },
            irc_id: 'twitch-message-id',
        };

        const added = s.addMessage(buffer, message);

        expect(added.irc_id).toBe('twitch-message-id');
        expect(buffer.messagesObj.messageIds['twitch-message-id']).toBe(added);
    });
});

describe('Twitch notice classification', () => {
    it.each([
        'msg_banned',
        'msg_channel_suspended',
        'msg_timedout',
        'bad_command',
        'whisper_restricted',
        'usage_ban',
        'already_banned',
        'tos_ban',
        'unrecognized_cmd',
    ])('marks %s as an error notice', (msgId) => {
        expect(isTwitchNoticeError(msgId)).toBe(true);
    });

    it.each([
        'emote_only_on',
        'subs_off',
        'delete_message_success',
        'ban_success',
        undefined,
        '',
    ])('keeps %s as a normal notice', (msgId) => {
        expect(isTwitchNoticeError(msgId)).toBe(false);
    });
});
