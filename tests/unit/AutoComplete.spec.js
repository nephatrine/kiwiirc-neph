import AutoComplete from '@/components/AutoComplete';

describe('AutoComplete key handling', () => {
    function makeContext(selectedItem) {
        return {
            selectedItem,
            selectCurrentItem: jest.fn(),
            cancel: jest.fn(),
            itemValue: AutoComplete.methods.itemValue,
        };
    }

    test('selects the highlighted item on Tab', () => {
        const context = makeContext({ text: 'time' });
        const event = { key: 'Tab', preventDefault: jest.fn() };
        const handled = AutoComplete.methods.handleOnKeyDown.call(context, event);

        expect(handled).toBe(true);
        expect(context.selectCurrentItem).toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();
    });

    test('selects the highlighted item on Enter', () => {
        const context = makeContext({ text: 'time' });
        const event = { key: 'Enter', preventDefault: jest.fn() };
        const handled = AutoComplete.methods.handleOnKeyDown.call(context, event);

        expect(handled).toBe(true);
        expect(context.selectCurrentItem).toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();
    });

    test('leaves modified Enter for newline insertion', () => {
        const context = makeContext({ text: 'time' });
        const event = {
            key: 'Enter',
            shiftKey: true,
            preventDefault: jest.fn(),
        };
        const handled = AutoComplete.methods.handleOnKeyDown.call(context, event);

        expect(handled).toBe(false);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('does not select on space and lets the space be typed', () => {
        const context = makeContext({ text: 'time' });
        const handled = AutoComplete.methods.handleOnKeyDown.call(
            context,
            { key: ' ' }
        );

        expect(handled).toBe(false);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(context.cancel).toHaveBeenCalled();
    });

    test('does not select on punctuation and lets it be typed', () => {
        const context = makeContext({ text: 'time' });
        const handled = AutoComplete.methods.handleOnKeyDown.call(
            context,
            { key: ',' }
        );

        expect(handled).toBe(false);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(context.cancel).toHaveBeenCalled();
    });

    test('keeps Shift+Tab as backward navigation', () => {
        const context = makeContext({ text: 'time' });
        context.selected_idx = 1;
        context.filteredItems = [{ text: 'one' }, { text: 'two' }];
        const event = { key: 'Tab', shiftKey: true, preventDefault: jest.fn() };
        const handled = AutoComplete.methods.handleOnKeyDown.call(context, event);

        expect(handled).toBe(true);
        expect(context.selected_idx).toBe(0);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();
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

describe('AutoComplete user display names', () => {
    test('filters users by display-name without changing completion text', () => {
        const items = [{
            text: 'ankle',
            type: 'user',
            displayName: 'Jeremy',
            alias: ['Jeremy'],
        }];

        const filtered = AutoComplete.computed.filteredItems.call({
            items,
            filter: 'jer',
        });

        expect(filtered).toHaveLength(1);
        expect(filtered[0].text).toBe('ankle');
        expect(filtered[0].displayName).toBe('Jeremy');
        expect(AutoComplete.methods.itemValue(filtered[0])).toBe('ankle');
    });
});
