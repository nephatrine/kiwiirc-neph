import AppSettings from '@/components/AppSettings.vue';
import EmojiPicker from '@/components/EmojiPicker.vue';
import { emojiData } from '@/res/emojiData';
import { emojiVersions } from '@/res/emojiLookup';

function clickContext(picker) {
    return {
        $state: { ui: { emoji_picker: picker } },
        close: jest.fn(),
    };
}

describe('Emoji picker version setting', () => {
    it('lists the Unicode versions and filters picker data', () => {
        const versions = AppSettings.computed.emojiVersions.call({});

        expect(versions).toContain(13);
        expect(versions).toContain(13.1);
        expect(versions[0]).toBeGreaterThan(versions[versions.length - 1]);
        expect(versions).toEqual(emojiVersions);

        const visible = EmojiPicker.computed.visibleEmojiData.call({
            emojiData,
            emojiPickerMaxVersion: 13,
        });
        const emojis = Object.values(visible).flat();

        expect(emojis.every((emoji) => !emoji.version || emoji.version <= 13)).toBe(true);
        expect(emojis.some((emoji) => emoji.shortcode === 'melting_face')).toBe(false);
        expect(emojis.some((emoji) => emoji.shortcode === 'zap')).toBe(true);
    });
});

describe('Emoji picker custom items', () => {
    it('inserts custom tokens and unicode characters into the input', () => {
        let ircinput = { insertText: jest.fn() };
        let context = clickContext({
            type: 'input',
            ircinput,
        });

        EmojiPicker.methods.onEmojiClick.call(context, {
            char: '',
            insertText: ':kiwi/#test:',
        });

        expect(ircinput.insertText).toHaveBeenCalledWith(':kiwi/#test:');
        expect(context.close).toHaveBeenCalled();

        ircinput = { insertText: jest.fn() };
        context = clickContext({
            type: 'input',
            ircinput,
        });

        EmojiPicker.methods.onEmojiClick.call(context, {
            char: '👍',
        });

        expect(ircinput.insertText).toHaveBeenCalledWith('👍');
    });

    it('reacts with a custom token', () => {
        const buffer = { react: jest.fn() };
        const message = { id: 1 };
        const context = clickContext({
            type: 'reaction',
            buffer,
            message,
        });

        EmojiPicker.methods.onEmojiClick.call(context, {
            char: '',
            insertText: ':kiwi:',
        });

        expect(buffer.react).toHaveBeenCalledWith(message, ':kiwi:');
        expect(context.close).toHaveBeenCalled();
    });
});
