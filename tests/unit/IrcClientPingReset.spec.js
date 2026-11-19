import { throttlePingTimeoutReset } from '@/libs/IrcClient';

describe('IRC ping timeout throttling', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('coalesces resets and wraps a newly assigned reset function', () => {
        const now = jest.spyOn(Date, 'now');
        now.mockReturnValue(1000);
        let original = jest.fn();
        let client = { resetPingTimeoutTimer: original };

        throttlePingTimeoutReset(client, 1000);
        let throttled = client.resetPingTimeoutTimer;

        throttled();
        throttled();
        expect(original).toHaveBeenCalledTimes(1);

        now.mockReturnValue(1999);
        throttled();
        expect(original).toHaveBeenCalledTimes(1);

        now.mockReturnValue(2000);
        throttled();
        expect(original).toHaveBeenCalledTimes(2);

        now.mockReturnValue(1000);
        original = jest.fn();
        client = { resetPingTimeoutTimer: original };

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
