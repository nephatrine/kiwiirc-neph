import AutoComplete from '@/components/AutoComplete';

describe('AutoComplete space selection', () => {
    function makeContext(selectedItem) {
        return {
            selectedItem,
            selectCurrentItem: jest.fn(),
            cancel: jest.fn(),
            itemValue: AutoComplete.methods.itemValue,
        };
    }

    test('does not select a multi-word item on space', () => {
        const context = makeContext({ text: 'geography timezone' });
        const handled = AutoComplete.methods.handleOnKeyDown.call(
            context,
            { key: ' ' }
        );

        expect(handled).toBe(false);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(context.cancel).not.toHaveBeenCalled();
    });

    test('selects a single-word item on space', () => {
        const context = makeContext({ text: 'time' });
        const handled = AutoComplete.methods.handleOnKeyDown.call(
            context,
            { key: ' ' }
        );

        expect(handled).toBe(true);
        expect(context.selectCurrentItem).toHaveBeenCalled();
    });
});

describe('AutoComplete emoji sources', () => {
    const context = {
        $t: (key) => key,
    };

    test('uses the pack name when present', () => {
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '#channel',
            packName: 'Channel Pack',
            sourceType: 'channel',
        })).toBe('Channel Pack');
    });

    test('uses the pack id when no pack name is present', () => {
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '#channel',
            sourceType: 'channel',
        })).toBe('#channel');
    });

    test('falls back to the source label', () => {
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '',
            sourceType: 'unicode',
        })).toBe('emoji_source_unicode');
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '',
            sourceType: 'local',
        })).toBe('emoji_source_local');
    });

    test('shows the pack id and channel in the source title', () => {
        expect(AutoComplete.methods.emojiSourceTitle.call(context, {
            packId: '#channel/pack',
            channelName: '#channel',
        })).toBe('#channel/pack · #channel');
    });

    test('inserts the short text when an item provides one', () => {
        expect(AutoComplete.methods.itemValue({
            text: ':wave/#channel:',
            insertText: ':wave:',
        })).toBe(':wave:');
    });

    test('falls back to the display text when no insert text is present', () => {
        expect(AutoComplete.methods.itemValue({
            text: 'nickname',
        })).toBe('nickname');
    });
});
