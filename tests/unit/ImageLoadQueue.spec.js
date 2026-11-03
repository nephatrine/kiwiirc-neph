import {
    isImageLoaded,
    markImageLoaded,
    scheduleImageLoad
} from '@/libs/ImageLoadQueue';

describe('Image load queue', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test('limits concurrency and spaces image starts', () => {
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
    });

    test('cancels queued loads and releases started ones', () => {
        const starts = [];

        const queued = scheduleImageLoad(() => {
            starts.push('queued');
        });
        queued.cancel();
        jest.advanceTimersByTime(200);
        expect(starts).toEqual([]);

        const started = scheduleImageLoad(() => {
            starts.push('started');
        });
        jest.advanceTimersByTime(100);
        expect(starts).toEqual(['started']);

        started.cancel();

        const next = scheduleImageLoad(() => {
            starts.push('next');
        });
        jest.advanceTimersByTime(100);
        expect(starts).toEqual(['started', 'next']);

        next.cancel();
    });

    test('tracks loaded image urls', () => {
        const url = 'https://example.com/emoji/one.svg';

        expect(isImageLoaded(url)).toBe(false);
        markImageLoaded(url);
        expect(isImageLoaded(url)).toBe(true);
    });
});
