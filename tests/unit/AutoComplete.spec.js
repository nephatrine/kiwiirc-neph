import AutoComplete from '@/components/AutoComplete';

describe('AutoComplete space selection', () => {
    function makeContext(selectedItem) {
        return {
            selectedItem,
            selectCurrentItem: jest.fn(),
            cancel: jest.fn(),
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
