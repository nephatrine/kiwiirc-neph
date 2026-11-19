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

    test('handles Tab, Enter, modified Enter, space, punctuation, and Shift+Tab', () => {
        let context = makeContext({ text: 'time' });
        let event = { key: 'Tab', preventDefault: jest.fn() };
        expect(AutoComplete.methods.handleOnKeyDown.call(context, event)).toBe(true);
        expect(context.selectCurrentItem).toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();

        context = makeContext({ text: 'time' });
        event = { key: 'Enter', preventDefault: jest.fn() };
        expect(AutoComplete.methods.handleOnKeyDown.call(context, event)).toBe(true);
        expect(context.selectCurrentItem).toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();

        context = makeContext({ text: 'time' });
        event = { key: 'Enter', shiftKey: true, preventDefault: jest.fn() };
        expect(AutoComplete.methods.handleOnKeyDown.call(context, event)).toBe(false);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();

        context = makeContext({ text: 'time' });
        expect(AutoComplete.methods.handleOnKeyDown.call(context, { key: ' ' }))
            .toBe(false);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(context.cancel).toHaveBeenCalled();

        context = makeContext({ text: 'time' });
        expect(AutoComplete.methods.handleOnKeyDown.call(context, { key: ',' }))
            .toBe(false);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(context.cancel).toHaveBeenCalled();

        context = makeContext({ text: 'time' });
        context.selected_idx = 1;
        context.filteredItems = [{ text: 'one' }, { text: 'two' }];
        event = { key: 'Tab', shiftKey: true, preventDefault: jest.fn() };
        expect(AutoComplete.methods.handleOnKeyDown.call(context, event)).toBe(true);
        expect(context.selected_idx).toBe(0);
        expect(context.selectCurrentItem).not.toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();
    });
});

describe('AutoComplete emoji sources', () => {
    const context = {
        $t: (key) => key,
    };

    test('resolves source labels, titles, and insert text', () => {
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '#channel',
            packName: 'Channel Pack',
            sourceType: 'channel',
        })).toBe('Channel Pack');
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '#channel',
            sourceType: 'channel',
        })).toBe('#channel');
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '',
            sourceType: 'unicode',
        })).toBe('emoji_source_unicode');
        expect(AutoComplete.methods.emojiSource.call(context, {
            packId: '',
            sourceType: 'local',
        })).toBe('emoji_source_local');
        expect(AutoComplete.methods.emojiSourceTitle.call(context, {
            packId: '#channel/pack',
            channelName: '#channel',
        })).toBe('#channel/pack · #channel');
        expect(AutoComplete.methods.itemValue({
            text: ':wave/#channel:',
            insertText: ':wave:',
        })).toBe(':wave:');
        expect(AutoComplete.methods.itemValue({ text: 'nickname' })).toBe('nickname');
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
