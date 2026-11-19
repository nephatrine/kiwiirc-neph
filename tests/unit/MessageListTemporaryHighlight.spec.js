import MessageList from '@/components/MessageList';

describe('MessageList temporary message highlight', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function makeContext() {
        return {
            highlighted_message_id: null,
            highlight_timeout: null,
        };
    }

    test('highlights the focused message, clears after the timeout, or immediately', () => {
        let context = makeContext();

        MessageList.methods.highlightMessage.call(context, 42);

        expect(context.highlighted_message_id).toBe(42);
        expect(MessageList.methods.isTemporaryHighlighted.call(
            context,
            { id: 42 }
        )).toBe(true);
        expect(MessageList.methods.isTemporaryHighlighted.call(
            context,
            { id: 43 }
        )).toBe(false);

        jest.advanceTimersByTime(4000);

        expect(context.highlighted_message_id).toBeNull();
        expect(context.highlight_timeout).toBeNull();

        context = makeContext();
        MessageList.methods.highlightMessage.call(context, 7);

        MessageList.methods.clearTemporaryHighlight.call(context);

        expect(context.highlighted_message_id).toBeNull();
        expect(context.highlight_timeout).toBeNull();
    });

    test('replaces an older highlight and its timer', () => {
        const context = makeContext();
        MessageList.methods.highlightMessage.call(context, 1);
        MessageList.methods.highlightMessage.call(context, 2);

        jest.advanceTimersByTime(4000);

        expect(context.highlighted_message_id).toBeNull();
    });
});
