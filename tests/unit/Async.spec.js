import { debounce, throttle } from '@/helpers/Async';

describe('Async.debounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    test('defers, resets, keeps latest args, cancels, and preserves context', () => {
        let fn = jest.fn();
        let debounced = debounce(fn, 100);
        debounced();
        jest.advanceTimersByTime(99);
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);

        fn = jest.fn();
        debounced = debounce(fn, 100);
        debounced();
        jest.advanceTimersByTime(50);
        debounced();
        jest.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);

        fn = jest.fn();
        debounced = debounce(fn, 100);
        debounced('a');
        jest.advanceTimersByTime(50);
        debounced('b');
        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('b');

        fn = jest.fn();
        debounced = debounce(fn, 100);
        debounced();
        debounced.cancel();
        jest.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();

        const context = {
            value: 42,
            result: null,
            run() {
                this.result = this.value;
            },
        };
        context.debounced = debounce(context.run, 100);
        context.debounced();
        jest.advanceTimersByTime(100);
        expect(context.result).toBe(42);
    });
});

describe('Async.throttle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    test('handles leading, trailing, latest args, next window, and cancel', () => {
        let fn = jest.fn();
        let throttled = throttle(fn, 100);
        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(50);
        throttled();
        expect(fn).toHaveBeenCalledTimes(1);

        fn = jest.fn();
        throttled = throttle(fn, 100);
        throttled();
        jest.advanceTimersByTime(30);
        throttled();
        jest.advanceTimersByTime(80);
        expect(fn).toHaveBeenCalledTimes(2);

        fn = jest.fn();
        throttled = throttle(fn, 100);
        throttled('a');
        jest.advanceTimersByTime(30);
        throttled('b');
        jest.advanceTimersByTime(80);
        expect(fn).toHaveBeenLastCalledWith('b');

        fn = jest.fn();
        throttled = throttle(fn, 100);
        throttled();
        jest.advanceTimersByTime(150);
        throttled();
        expect(fn).toHaveBeenCalledTimes(2);

        fn = jest.fn();
        throttled = throttle(fn, 100);
        throttled();
        jest.advanceTimersByTime(30);
        throttled();
        throttled.cancel();
        jest.advanceTimersByTime(200);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
