import LazyEmojiImage from '@/components/utils/LazyEmojiImage';
import { isImageLoaded, markImageLoaded } from '@/libs/ImageLoadQueue';

describe('LazyEmojiImage', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    function makeContext(overrides = {}) {
        return Object.assign({
            release: LazyEmojiImage.methods.release,
            cancelLoad: LazyEmojiImage.methods.cancelLoad,
        }, overrides);
    }

    test('queues the image source before rendering it, or uses the cache', () => {
        const url = 'https://example.com/emoji/lazy-one.svg';
        let context = makeContext({
            src: url,
            renderedSrc: '',
            imageHandle: null,
            loadingStarted: false,
        });

        LazyEmojiImage.methods.startLoad.call(context);
        expect(context.renderedSrc).toBe('');

        jest.advanceTimersByTime(100);
        expect(context.renderedSrc).toBe(url);

        LazyEmojiImage.methods.release.call(context);
        expect(context.imageHandle).toBeNull();

        const cachedUrl = 'https://example.com/emoji/lazy-cached.svg';
        markImageLoaded(cachedUrl);

        context = makeContext({
            src: cachedUrl,
            renderedSrc: '',
            imageHandle: null,
            loadingStarted: false,
        });

        LazyEmojiImage.methods.startLoad.call(context);

        expect(context.renderedSrc).toBe(cachedUrl);
        expect(context.imageHandle).toBeNull();
    });

    test('marks successful images as loaded and clears on error', () => {
        const url = 'https://example.com/emoji/lazy-loaded.svg';
        let release = jest.fn();
        let context = makeContext({
            src: url,
            renderedSrc: url,
            imageHandle: { release },
        });

        LazyEmojiImage.methods.onLoad.call(context);

        expect(isImageLoaded(url)).toBe(true);
        expect(release).toHaveBeenCalled();
        expect(context.imageHandle).toBeNull();

        release = jest.fn();
        context = makeContext({
            src: 'https://example.com/emoji/lazy-error.svg',
            renderedSrc: 'https://example.com/emoji/lazy-error.svg',
            imageHandle: { release },
        });

        LazyEmojiImage.methods.onError.call(context);

        expect(context.renderedSrc).toBe('');
        expect(release).toHaveBeenCalled();
        expect(context.imageHandle).toBeNull();
    });

    test('cancels queued work when reset', () => {
        const cancel = jest.fn();
        const context = makeContext({
            renderedSrc: 'https://example.com/emoji/lazy-reset.svg',
            imageHandle: { cancel },
            loadingStarted: true,
        });

        LazyEmojiImage.methods.reset.call(context);

        expect(cancel).toHaveBeenCalled();
        expect(context.renderedSrc).toBe('');
        expect(context.loadingStarted).toBe(false);
        expect(context.imageHandle).toBeNull();
    });
});
