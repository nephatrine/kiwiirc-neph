import state from '@/libs/state';
import Message from '@/libs/Message';
import { theMiddleware as redactionMiddleware } from '@/libs/RedactionMiddleware';
import { theMiddleware as twitchMiddleware } from '@/libs/TwitchMiddleware';

function messageBuffer() {
    return {
        users: {},
        isSpecial: () => false,
        setting: (name) => (name === 'inline_link_auto_preview_whitelist' ? '.*' : undefined),
    };
}

function targetMessage(isRedacted = false) {
    return {
        type: 'privmsg',
        is_redacted: isRedacted,
        embed: { type: 'url', payload: 'https://example.com/image.jpg' },
        closeEmbed: jest.fn(function closeEmbed() {
            this.embed.payload = '';
        }),
    };
}

function makeLocalContext(msgid = 'local-msgid') {
    const s = state.create();
    const network = s.addNetwork('TestNetwork', 'TestNick', {});
    network.nick = 'TestNick';
    network.enabled_caps = ['draft/message-redaction'];
    const buffer = s.addBuffer(network.id, '#test');
    const message = new Message({
        nick: 'Other',
        message: 'https://example.com/image.jpg',
        type: 'privmsg',
        tags: { msgid },
    });
    message.embed.payload = 'https://example.com/image.jpg';
    jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
    return {
        s, network, buffer, message,
    };
}

const redactionEvent = (params, nick = 'Other') => ({
    params,
    tags: {},
    nick,
});

const middlewareClient = () => ({
    user: { nick: 'TestNick' },
    caseCompare: (left, right) => (
        String(left).toLowerCase() === String(right).toLowerCase()
    ),
});

describe('redaction previews', () => {
    it('closes an open inline preview on local redaction unless reopened', () => {
        let ctx = makeLocalContext();
        let emit = jest.spyOn(ctx.s, '$emit');

        ctx.buffer.redact(ctx.message, 'reason');

        expect(ctx.message.is_redacted).toBe(true);
        expect(ctx.message.embed.payload).toBe('');
        expect(emit).toHaveBeenCalledWith(
            'message.redaction',
            expect.objectContaining({
                networkId: ctx.network.id,
                ircId: 'local-msgid',
                redactedBy: 'TestNick',
                redactionReason: 'reason',
            })
        );

        ctx = makeLocalContext();
        ctx.buffer.redact(ctx.message, 'reason');
        ctx.message.embed.payload = 'https://example.com/reopened.jpg';
        ctx.buffer.redact(ctx.message, 'again');
        expect(ctx.message.embed.payload).toBe('https://example.com/reopened.jpg');
    });

    it('closes, logs, or keeps previews for incoming redactions', () => {
        let target = targetMessage();
        let buffer = { messagesObj: { messageIds: { 'remote-msgid': target } } };
        let network = {
            id: 1,
            bufferByName: () => buffer,
            resolveMessage: () => ({ message: target, buffer }),
            appState: {
                $emit: jest.fn(),
                promotePendingLabel: jest.fn(),
            },
        };

        redactionMiddleware(network, 'REDACT', redactionEvent(
            ['#test', 'remote-msgid', 'reason']
        ), middlewareClient(), jest.fn());

        expect(target.is_redacted).toBe(true);
        expect(target.closeEmbed).toHaveBeenCalledTimes(1);
        expect(target.embed.payload).toBe('');

        let emit = jest.fn();
        network = {
            id: 1,
            bufferByName: () => undefined,
            resolveMessage: () => null,
            appState: {
                $emit: emit,
                promotePendingLabel: jest.fn(),
            },
        };
        redactionMiddleware(network, 'REDACT', redactionEvent(
            ['#test', 'missing-msgid', 'reason']
        ), middlewareClient(), jest.fn());

        expect(emit).toHaveBeenCalledWith(
            'message.redaction',
            expect.objectContaining({
                networkId: 1,
                ircId: 'missing-msgid',
                redactedBy: 'Other',
                redactionReason: 'reason',
            })
        );

        target = targetMessage(true);
        target.embed.payload = 'https://example.com/reopened.jpg';
        buffer = { messagesObj: { messageIds: { 'remote-msgid': target } } };
        network = {
            id: 1,
            bufferByName: () => buffer,
            resolveMessage: () => ({ message: target, buffer }),
            appState: {
                $emit: jest.fn(),
                promotePendingLabel: jest.fn(),
            },
        };
        redactionMiddleware(network, 'REDACT', redactionEvent(
            ['#test', 'remote-msgid', 'again']
        ), middlewareClient(), jest.fn());

        expect(target.closeEmbed).not.toHaveBeenCalled();
        expect(target.embed.payload).toBe('https://example.com/reopened.jpg');
    });

    it('does not auto-embed media on a redacted message', () => {
        const message = new Message({
            nick: 'Other',
            message: 'https://example.com/image.jpg',
            type: 'privmsg',
            is_redacted: true,
        });

        message.toBlocks(messageBuffer(), false);

        expect(message.embed.payload).toBeNull();
    });

    it('closes a Twitch-deleted preview unless reopened', () => {
        let target = targetMessage();
        let buffer = { messagesObj: { messageIds: { 'twitch-msgid': target } } };
        let network = {
            hasTwitchCommands: () => true,
            bufferByName: () => buffer,
            appState: { $emit: jest.fn() },
        };

        twitchMiddleware(network, 'CLEARMSG', {
            params: ['#test'],
            tags: { 'target-msg-id': 'twitch-msgid' },
        }, {}, jest.fn());

        expect(target.is_redacted).toBe(true);
        expect(target.closeEmbed).toHaveBeenCalledTimes(1);
        expect(target.embed.payload).toBe('');

        target = targetMessage(true);
        target.embed.payload = 'https://example.com/reopened.jpg';
        buffer = { messagesObj: { messageIds: { 'twitch-msgid': target } } };
        network = {
            hasTwitchCommands: () => true,
            bufferByName: () => buffer,
            appState: { $emit: jest.fn() },
        };
        twitchMiddleware(network, 'CLEARMSG', {
            params: ['#test'],
            tags: { 'target-msg-id': 'twitch-msgid' },
        }, {}, jest.fn());

        expect(target.closeEmbed).not.toHaveBeenCalled();
        expect(target.embed.payload).toBe('https://example.com/reopened.jpg');
    });
});
