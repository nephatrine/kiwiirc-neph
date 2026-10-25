import AppSettings from '@/components/AppSettings.vue';
import EmojiPicker from '@/components/EmojiPicker.vue';
import { emojiData } from '@/res/emojis';

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
