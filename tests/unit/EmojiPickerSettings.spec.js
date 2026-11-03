import AppSettings from '@/components/AppSettings.vue';
import EmojiPicker from '@/components/EmojiPicker.vue';
import { emojiData } from '@/res/emojiData';
import { emojiVersions } from '@/res/emojiLookup';

function pickerEnabled(settings, utf8 = true) {
    return AppSettings.computed.emojiPickerEnabled.call({
        activeNetworkIsUtf8: utf8,
        $state: {
            setting: (name) => settings[name],
        },
    });
}

describe('Emoji picker version setting', () => {
    it('is visible when the picker is enabled', () => {
        expect(pickerEnabled({ showEmojiPicker: true })).toBe(true);
        expect(pickerEnabled({ forceShowEmojiPicker: true })).toBe(true);
    });

    it('is hidden when the picker is disabled', () => {
        expect(pickerEnabled({})).toBe(false);
        expect(pickerEnabled({
            showEmojiPicker: false,
            forceShowEmojiPicker: false,
        })).toBe(false);
    });

    it('is hidden on a non-UTF-8 network', () => {
        expect(pickerEnabled({ showEmojiPicker: true }, false)).toBe(false);
    });

    it('lists the Unicode versions available in the data', () => {
        const versions = AppSettings.computed.emojiVersions.call({});

        expect(versions).toContain(13);
        expect(versions).toContain(13.1);
        expect(versions[0]).toBeGreaterThan(versions[versions.length - 1]);
        expect(versions).toEqual(emojiVersions);
    });

    it('filters the picker data by the selected version', () => {
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
    function clickContext(picker) {
        return {
            $state: { ui: { emoji_picker: picker } },
            close: jest.fn(),
        };
    }

    it('inserts a custom token into the input', () => {
        const ircinput = { insertText: jest.fn() };
        const context = clickContext({
            type: 'input',
            ircinput,
        });

        EmojiPicker.methods.onEmojiClick.call(context, {
            char: '',
            insertText: ':kiwi/#test:',
        });

        expect(ircinput.insertText).toHaveBeenCalledWith(':kiwi/#test:');
        expect(context.close).toHaveBeenCalled();
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

    it('still inserts unicode characters', () => {
        const ircinput = { insertText: jest.fn() };
        const context = clickContext({
            type: 'input',
            ircinput,
        });

        EmojiPicker.methods.onEmojiClick.call(context, {
            char: '👍',
        });

        expect(ircinput.insertText).toHaveBeenCalledWith('👍');
    });
});
