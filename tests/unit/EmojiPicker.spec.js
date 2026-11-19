import AppSettings from '@/components/AppSettings.vue';
import EmojiPicker from '@/components/EmojiPicker.vue';
import { emojiData } from '@/res/emojiData';
import { emojiVersions } from '@/res/emojiLookup';

describe('Emoji picker version setting', () => {
    test('lists the Unicode versions and filters picker data', () => {
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
    function clickContext(picker) {
        return {
            $state: { ui: { emoji_picker: picker } },
            close: jest.fn(),
        };
    }

    test('inserts custom tokens and unicode characters into the input', () => {
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

    test('reacts with a custom token', () => {
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

describe('Emoji picker category highlighting', () => {
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
            pickerCategories: Object.keys(sections).map((id) => ({ id })),
            activeCategory,
            $refs: refs,
            clearScrollTarget: EmojiPicker.methods.clearScrollTarget,
            onScroll: EmojiPicker.methods.onScroll,
        };
    }

    test('highlights the topmost visible category and ignores programmatic scrolls', () => {
        let context = scrollContext({ a: -200, b: -10, c: 300 });

        EmojiPicker.methods.onScroll.call(context);

        expect(context.activeCategory).toBe('b');

        context = scrollContext({ a: -500, b: -200, c: -10 });

        EmojiPicker.methods.onScroll.call(context);

        expect(context.activeCategory).toBe('c');

        context = scrollContext({ a: -200, b: -10, c: 300 }, 'c');
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
            pickerCategories: [{ id: 'b' }],
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
