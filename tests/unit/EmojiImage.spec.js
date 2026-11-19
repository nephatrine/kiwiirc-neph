import LazyEmojiImage from '@/components/utils/LazyEmojiImage';
import {
    isImageLoaded,
    markImageLoaded,
    scheduleImageLoad
} from '@/libs/ImageLoadQueue';

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

describe('Image load queue', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test('limits concurrency, spaces starts, and cancels queued loads', () => {
        const starts = [];
        const handles = [];

        for (let i = 0; i < 6; i += 1) {
            handles.push(scheduleImageLoad(() => {
                starts.push(i);
            }));
        }

        expect(starts).toEqual([]);

        jest.advanceTimersByTime(100);
        expect(starts).toEqual([0]);

        jest.advanceTimersByTime(300);
        expect(starts).toEqual([0, 1, 2, 3]);

        jest.advanceTimersByTime(500);
        expect(starts).toEqual([0, 1, 2, 3]);

        handles[0].release();
        jest.advanceTimersByTime(100);
        expect(starts).toEqual([0, 1, 2, 3, 4]);

        handles[1].release();
        handles[2].release();
        handles[3].release();
        jest.advanceTimersByTime(100);
        expect(starts).toEqual([0, 1, 2, 3, 4, 5]);

        handles.forEach((handle) => {
            handle.cancel();
        });

        const queued = scheduleImageLoad(() => {
            starts.push('queued');
        });
        queued.cancel();
        jest.advanceTimersByTime(200);
        expect(starts).toEqual([0, 1, 2, 3, 4, 5]);

        const started = scheduleImageLoad(() => {
            starts.push('started');
        });
        jest.advanceTimersByTime(100);
        expect(starts).toEqual([0, 1, 2, 3, 4, 5, 'started']);

        started.cancel();

        const next = scheduleImageLoad(() => {
            starts.push('next');
        });
        jest.advanceTimersByTime(100);
        expect(starts).toEqual([0, 1, 2, 3, 4, 5, 'started', 'next']);

        next.cancel();
    });

    test('tracks loaded image urls', () => {
        const url = 'https://example.com/emoji/one.svg';

        expect(isImageLoaded(url)).toBe(false);
        markImageLoaded(url);
        expect(isImageLoaded(url)).toBe(true);
    });
});
