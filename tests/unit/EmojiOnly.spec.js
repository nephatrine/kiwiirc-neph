import { isEmojiOnlyBlocks, isEmojiOnlyText } from '@/libs/EmojiProvider';
import MessageList from '@/components/MessageList';
import getState from '@/libs/state';
import parseMessage from '@/libs/MessageParser';

function textBlock(content) {
    return {
        type: 'text',
        content,
        styles: {},
        meta: {},
    };
}

function emojiBlock(meta = {}) {
    return {
        type: 'emoji',
        content: '',
        styles: {},
        meta,
    };
}

describe('Emoji-only detection', () => {
    test('detects literal emoji-only text', () => {
        expect(isEmojiOnlyText('😀')).toBe(true);
        expect(isEmojiOnlyText(' 😀 😃 ')).toBe(true);
        expect(isEmojiOnlyText('😀  😃\n😄')).toBe(true);
        expect(isEmojiOnlyText('👨‍👩‍👦')).toBe(true);
        expect(isEmojiOnlyText('👍🏽')).toBe(true);
        expect(isEmojiOnlyText('🇺🇸')).toBe(true);
        expect(isEmojiOnlyText('1️⃣')).toBe(true);
        expect(isEmojiOnlyText('')).toBe(false);
        expect(isEmojiOnlyText('   ')).toBe(false);
        expect(isEmojiOnlyText('😀 hello')).toBe(false);
        expect(isEmojiOnlyText('hello 😀')).toBe(false);
        expect(isEmojiOnlyText('123')).toBe(false);
        expect(isEmojiOnlyText(':wave:')).toBe(false);
    });

    test('accepts parsed emoji blocks and whitespace-separated emoji', () => {
        expect(isEmojiOnlyBlocks([
            textBlock('😀'),
            emojiBlock({ emoji: '😃', shortcode: 'smile' }),
            textBlock(' '),
        ])).toBe(true);
        expect(isEmojiOnlyBlocks([textBlock('😀 😃')])).toBe(true);
        expect(isEmojiOnlyBlocks([
            emojiBlock({ emoji: '😀', shortcode: 'smile' }),
            textBlock(' '),
            emojiBlock({
                customEmojiUrl: 'https://example.com/wave.png',
                shortcode: 'wave',
            }),
        ])).toBe(true);
        expect(isEmojiOnlyBlocks([
            emojiBlock({
                customEmojiUrl: 'https://example.com/wave.png',
                shortcode: 'wave',
            }),
        ])).toBe(true);

        const state = getState();
        state.setting('buffers.emoji_convert_incoming', true);
        state.setting('customEmojis', {
            doom: 'https://example.com/doom.png',
        });

        try {
            const spaced = parseMessage(':doom: :doom:');
            const adjacent = parseMessage(':doom::doom:');
            expect(isEmojiOnlyBlocks(spaced)).toBe(true);
            expect(isEmojiOnlyBlocks(adjacent)).toBe(true);
        } finally {
            state.setting('customEmojis', {});
        }
    });

    test('rejects mixed blocks and non-text blocks', () => {
        expect(isEmojiOnlyBlocks([])).toBe(false);
        expect(isEmojiOnlyBlocks([textBlock('   ')])).toBe(false);
        expect(isEmojiOnlyBlocks([
            textBlock('😀'),
            textBlock(' hello'),
        ])).toBe(false);
        expect(isEmojiOnlyBlocks([
            textBlock('😀'),
            {
                type: 'url',
                content: 'https://example.com',
                styles: {},
                meta: { url: 'https://example.com' },
            },
        ])).toBe(false);
        expect(isEmojiOnlyBlocks(null)).toBe(false);
    });
});

describe('MessageList emoji-only messages', () => {
    const context = {
        buffer: {
            isSpecial: () => false,
        },
        useExtraFormatting: true,
    };

    function makeMessage(overrides = {}) {
        return Object.assign({
            type: 'privmsg',
            is_redacted: false,
            bodyTemplate: null,
            embed: { payload: null },
            toBlocks: jest.fn(() => [textBlock('😀')]),
        }, overrides);
    }

    function isEmojiOnly(message) {
        return MessageList.methods.isEmojiOnlyMessage.call(context, message);
    }

    test('accepts normal, whitespace-separated, and uppercase chat messages', () => {
        let message = makeMessage();
        expect(isEmojiOnly(message)).toBe(true);
        expect(message.toBlocks).toHaveBeenCalledWith(context.buffer, true);

        message = makeMessage({
            toBlocks: () => [
                textBlock('😀'),
                textBlock(' '),
                emojiBlock({ emoji: '😃', shortcode: 'smile' }),
                textBlock('  '),
                textBlock('😄'),
            ],
        });
        expect(isEmojiOnly(message)).toBe(true);

        expect(isEmojiOnly(makeMessage({ type: 'PRIVMSG' }))).toBe(true);
    });

    test('rejects special buffers and unsupported message types', () => {
        const specialContext = Object.assign({}, context, {
            buffer: { isSpecial: () => true },
        });

        expect(MessageList.methods.isEmojiOnlyMessage.call(
            specialContext,
            makeMessage()
        )).toBe(false);
        expect(isEmojiOnly(makeMessage({ type: 'traffic' }))).toBe(false);
        expect(isEmojiOnly(makeMessage({ type: 'join' }))).toBe(false);
    });

    test('rejects ineligible or non-emoji message content', () => {
        expect(isEmojiOnly(makeMessage({ is_redacted: true }))).toBe(false);
        expect(isEmojiOnly(makeMessage({ bodyTemplate: {} }))).toBe(false);
        expect(isEmojiOnly(makeMessage({
            embed: { payload: 'https://example.com' },
        }))).toBe(false);
        expect(isEmojiOnly(makeMessage({
            toBlocks: () => [textBlock('😀 hello')],
        }))).toBe(false);
    });
});
