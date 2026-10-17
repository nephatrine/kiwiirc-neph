import { debounce, throttle } from '@/helpers/Async';

describe('Async.debounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    test('defers the call until the wait has passed', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced();
        jest.advanceTimersByTime(99);
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('resets the timer on each call', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced();
        jest.advanceTimersByTime(50);
        debounced();
        jest.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('uses the latest arguments', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced('a');
        jest.advanceTimersByTime(50);
        debounced('b');
        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('b');
    });

    test('cancel stops a pending call', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced();
        debounced.cancel();
        jest.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();
    });

    test('preserves the calling context', () => {
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

    test('invokes on the leading edge', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('does not invoke again inside the wait window', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled();
        jest.advanceTimersByTime(50);
        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('invokes once more on the trailing edge', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled();
        jest.advanceTimersByTime(30);
        throttled();
        jest.advanceTimersByTime(80);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    test('uses the latest arguments on the trailing call', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled('a');
        jest.advanceTimersByTime(30);
        throttled('b');
        jest.advanceTimersByTime(80);
        expect(fn).toHaveBeenLastCalledWith('b');
    });

    test('invokes again on the leading edge of the next window', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled();
        jest.advanceTimersByTime(150);
        throttled();
        expect(fn).toHaveBeenCalledTimes(2);
    });

    test('cancel stops a pending trailing call', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled();
        jest.advanceTimersByTime(30);
        throttled();
        throttled.cancel();
        jest.advanceTimersByTime(200);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
