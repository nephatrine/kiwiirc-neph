import EmojiPicker from '@/components/EmojiPicker.vue';

function scrollContext(sections, activeCategory = 'a') {
    const refs = {
        scroller: {
            scrollTop: 0,
            getBoundingClientRect: () => ({ top: 0 }),
        },
    };
    Object.entries(sections).forEach(([id, top]) => {
        refs[`cat-${id}`] = [{
            getBoundingClientRect: () => ({ top }),
        }];
    });

    return {
        filter: '',
        scrollTarget: null,
        scrollTargetTop: null,
        scrollTimer: null,
        categories: Object.keys(sections).map((id) => ({ id })),
        activeCategory,
        $refs: refs,
        clearScrollTarget: EmojiPicker.methods.clearScrollTarget,
        onScroll: EmojiPicker.methods.onScroll,
    };
}

describe('Emoji picker category highlighting', () => {
    test('highlights the topmost visible category, not the centered one', () => {
        const context = scrollContext({ a: -200, b: -10, c: 300 });

        EmojiPicker.methods.onScroll.call(context);

        expect(context.activeCategory).toBe('b');
    });

    test('highlights the last category when it cannot be centered', () => {
        const context = scrollContext({ a: -500, b: -200, c: -10 });

        EmojiPicker.methods.onScroll.call(context);

        expect(context.activeCategory).toBe('c');
    });

    test('ignores scroll events while a category scroll is in progress', () => {
        const context = scrollContext({ a: -200, b: -10, c: 300 }, 'c');
        context.scrollTarget = 'c';
        context.scrollTargetTop = 100;
        context.$refs.scroller.scrollTop = 10;

        EmojiPicker.methods.onScroll.call(context);

        expect(context.activeCategory).toBe('c');
    });

    test('scrolls only the emoji list and keeps the clicked category active', () => {
        jest.useFakeTimers();
        const scroller = {
            scrollTop: 100,
            getBoundingClientRect: () => ({ top: 50 }),
            scrollTo: jest.fn(),
        };
        const el = {
            getBoundingClientRect: () => ({ top: 250 }),
        };
        const context = {
            filter: '',
            activeCategory: 'a',
            scrollTarget: null,
            scrollTargetTop: null,
            scrollTimer: null,
            categories: [{ id: 'b' }],
            $refs: {
                scroller,
                'cat-b': [el],
            },
            clearScrollTarget: EmojiPicker.methods.clearScrollTarget,
            onScroll: EmojiPicker.methods.onScroll,
        };

        EmojiPicker.methods.scrollToCategory.call(context, 'b');

        expect(context.activeCategory).toBe('b');
        expect(scroller.scrollTo).toHaveBeenCalledWith({
            top: 300,
            behavior: 'smooth',
        });
        expect(context.scrollTarget).toBe('b');

        jest.advanceTimersByTime(600);
        expect(context.scrollTarget).toBeNull();
        jest.useRealTimers();
    });
});
