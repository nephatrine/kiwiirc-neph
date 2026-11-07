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

describe('redaction previews', () => {
    it('closes an open inline preview when a message is redacted locally', () => {
        let s = state.create();
        let network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        network.enabled_caps = ['draft/message-redaction'];
        let buffer = s.addBuffer(network.id, '#test');
        let message = new Message({
            nick: 'Other',
            message: 'https://example.com/image.jpg',
            type: 'privmsg',
            tags: { msgid: 'local-msgid' },
        });
        message.embed.payload = 'https://example.com/image.jpg';
        jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});
        const emit = jest.spyOn(s, '$emit');

        buffer.redact(message, 'reason');

        expect(message.is_redacted).toBe(true);
        expect(message.embed.payload).toBe('');
        expect(emit).toHaveBeenCalledWith(
            'message.redaction',
            expect.objectContaining({
                networkId: network.id,
                ircId: 'local-msgid',
                redactedBy: 'TestNick',
                redactionReason: 'reason',
            })
        );
    });

    it('keeps a preview manually reopened after local redaction', () => {
        let s = state.create();
        let network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        network.enabled_caps = ['draft/message-redaction'];
        let buffer = s.addBuffer(network.id, '#test');
        let message = new Message({
            nick: 'Other',
            message: 'https://example.com/image.jpg',
            type: 'privmsg',
            tags: { msgid: 'local-msgid' },
        });
        jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});

        buffer.redact(message, 'reason');
        message.embed.payload = 'https://example.com/reopened.jpg';
        buffer.redact(message, 'again');

        expect(message.embed.payload).toBe('https://example.com/reopened.jpg');
    });

    it('closes an open inline preview when an incoming redaction arrives', () => {
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

        redactionMiddleware(network, 'REDACT', {
            params: ['#test', 'remote-msgid', 'reason'],
            tags: {},
            nick: 'Other',
        }, {
            user: { nick: 'TestNick' },
            caseCompare: (left, right) => (
                String(left).toLowerCase() === String(right).toLowerCase()
            ),
        }, jest.fn());

        expect(target.is_redacted).toBe(true);
        expect(target.closeEmbed).toHaveBeenCalledTimes(1);
        expect(target.embed.payload).toBe('');
    });

    it('emits a log redaction when the target is not loaded', () => {
        const emit = jest.fn();
        const network = {
            id: 1,
            bufferByName: () => undefined,
            resolveMessage: () => null,
            appState: {
                $emit: emit,
                promotePendingLabel: jest.fn(),
            },
        };

        redactionMiddleware(network, 'REDACT', {
            params: ['#test', 'missing-msgid', 'reason'],
            tags: {},
            nick: 'Other',
        }, {
            user: { nick: 'TestNick' },
            caseCompare: (left, right) => (
                String(left).toLowerCase() === String(right).toLowerCase()
            ),
        }, jest.fn());

        expect(emit).toHaveBeenCalledWith(
            'message.redaction',
            expect.objectContaining({
                networkId: 1,
                ircId: 'missing-msgid',
                redactedBy: 'Other',
                redactionReason: 'reason',
            })
        );
    });

    it('keeps a preview manually reopened after an incoming redaction', () => {
        let target = targetMessage(true);
        target.embed.payload = 'https://example.com/reopened.jpg';
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

        redactionMiddleware(network, 'REDACT', {
            params: ['#test', 'remote-msgid', 'again'],
            tags: {},
            nick: 'Other',
        }, {
            user: { nick: 'TestNick' },
            caseCompare: (left, right) => (
                String(left).toLowerCase() === String(right).toLowerCase()
            ),
        }, jest.fn());

        expect(target.closeEmbed).not.toHaveBeenCalled();
        expect(target.embed.payload).toBe('https://example.com/reopened.jpg');
    });

    it('does not auto-embed media on a redacted message', () => {
        let message = new Message({
            nick: 'Other',
            message: 'https://example.com/image.jpg',
            type: 'privmsg',
            is_redacted: true,
        });

        message.toBlocks(messageBuffer(), false);

        expect(message.embed.payload).toBeNull();
    });

    it('closes an open inline preview when a Twitch message is deleted', () => {
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
    });

    it('keeps a preview manually reopened after a Twitch deletion', () => {
        let target = targetMessage(true);
        target.embed.payload = 'https://example.com/reopened.jpg';
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

        expect(target.closeEmbed).not.toHaveBeenCalled();
        expect(target.embed.payload).toBe('https://example.com/reopened.jpg');
    });
});
