import { throttlePingTimeoutReset } from '@/libs/IrcClient';

describe('IRC ping timeout throttling', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('coalesces timeout resets while events are arriving', () => {
        const now = jest.spyOn(Date, 'now');
        now.mockReturnValue(1000);
        const original = jest.fn();
        const client = { resetPingTimeoutTimer: original };

        throttlePingTimeoutReset(client, 1000);
        const throttled = client.resetPingTimeoutTimer;

        throttled();
        throttled();
        expect(original).toHaveBeenCalledTimes(1);

        now.mockReturnValue(1999);
        throttled();
        expect(original).toHaveBeenCalledTimes(1);

        now.mockReturnValue(2000);
        throttled();
        expect(original).toHaveBeenCalledTimes(2);
    });

    test('wraps a newly assigned reset function after reconnect', () => {
        const now = jest.spyOn(Date, 'now');
        now.mockReturnValue(1000);
        const client = { resetPingTimeoutTimer: jest.fn() };

        throttlePingTimeoutReset(client, 1000);
        const firstWrapper = client.resetPingTimeoutTimer;

        const replacement = jest.fn();
        client.resetPingTimeoutTimer = replacement;
        throttlePingTimeoutReset(client, 1000);

        expect(client.resetPingTimeoutTimer).not.toBe(firstWrapper);
        client.resetPingTimeoutTimer();
        expect(replacement).toHaveBeenCalledTimes(1);
    });

    test('ignores clients without a reset function', () => {
        expect(() => throttlePingTimeoutReset(null)).not.toThrow();
        expect(() => throttlePingTimeoutReset({})).not.toThrow();
    });
});
