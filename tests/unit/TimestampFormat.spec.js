import {
    FORMAT_12H,
    FORMAT_24H,
    FORMAT_DECIMAL,
    TIME_SYSTEM_12H,
    TIME_SYSTEM_24H,
    TIME_SYSTEM_DECIMAL,
    formatDecimalTime,
    formatForTimeSystem,
    formatTimestamp,
    timeSystemForFormat,
    usesWideTimestampFormat
} from '@/helpers/TimestampFormat';

describe('timestamp formats', () => {
    test('maps recognized formats to time systems', () => {
        expect(timeSystemForFormat(FORMAT_12H)).toBe(TIME_SYSTEM_12H);
        expect(timeSystemForFormat(FORMAT_24H)).toBe(TIME_SYSTEM_24H);
        expect(timeSystemForFormat(FORMAT_DECIMAL)).toBe(TIME_SYSTEM_DECIMAL);
        expect(timeSystemForFormat('%Y-%m-%d %H:%M')).toBeNull();
        expect(formatForTimeSystem(TIME_SYSTEM_12H)).toBe(FORMAT_12H);
        expect(formatForTimeSystem(TIME_SYSTEM_24H)).toBe(FORMAT_24H);
        expect(formatForTimeSystem(TIME_SYSTEM_DECIMAL)).toBe(FORMAT_DECIMAL);
        expect(formatForTimeSystem('unknown')).toBe('');
    });

    test('reserves wider timestamp space only for 12-hour and custom formats', () => {
        expect(usesWideTimestampFormat(FORMAT_24H)).toBe(false);
        expect(usesWideTimestampFormat(FORMAT_DECIMAL)).toBe(false);
        expect(usesWideTimestampFormat('')).toBe(false);
        expect(usesWideTimestampFormat(FORMAT_12H)).toBe(true);
        expect(usesWideTimestampFormat('%Y-%m-%d %H:%M')).toBe(true);
    });

    test('formats conventional timestamps through strftime', () => {
        const date = new Date(2026, 0, 1, 14, 5, 9);

        expect(formatTimestamp('%H:%M', date)).toBe('14:05');
        expect(formatTimestamp('%l:%M:%S %p', date)).toBe(' 2:05:09 PM');
    });

    test('formats decimal time from local elapsed seconds', () => {
        expect(formatDecimalTime(new Date(2026, 0, 1, 0, 0, 0))).toBe('0:00:00');
        expect(formatDecimalTime(new Date(2026, 0, 1, 2, 24, 0))).toBe('1:00:00');
        expect(formatDecimalTime(new Date(2026, 0, 1, 12, 0, 0))).toBe('5:00:00');
        expect(formatDecimalTime(new Date(2026, 0, 1, 23, 59, 59, 999)))
            .toBe('9:99:99');
    });

    test('uses decimal formatting for the decimal sentinel', () => {
        const date = new Date(2026, 0, 1, 12, 0, 0);

        expect(formatTimestamp(FORMAT_DECIMAL, date)).toBe('5:00:00');
    });
});
