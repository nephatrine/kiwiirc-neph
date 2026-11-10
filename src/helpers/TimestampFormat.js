import strftime from 'strftime';

export const TIME_SYSTEM_12H = '12h';
export const TIME_SYSTEM_24H = '24h';
export const TIME_SYSTEM_DECIMAL = 'decimal';

export const FORMAT_12H = '%l:%M:%S %p';
export const FORMAT_24H = '%H:%M:%S';
export const FORMAT_DECIMAL = 'decimal';

const TIME_SYSTEM_FORMATS = {
    [TIME_SYSTEM_12H]: FORMAT_12H,
    [TIME_SYSTEM_24H]: FORMAT_24H,
    [TIME_SYSTEM_DECIMAL]: FORMAT_DECIMAL,
};

export function timeSystemForFormat(format) {
    if (format === FORMAT_12H) {
        return TIME_SYSTEM_12H;
    }
    if (format === FORMAT_24H) {
        return TIME_SYSTEM_24H;
    }
    if (format === FORMAT_DECIMAL) {
        return TIME_SYSTEM_DECIMAL;
    }
    return null;
}

export function formatForTimeSystem(system) {
    return TIME_SYSTEM_FORMATS[system] || '';
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

export function formatDecimalTime(date = new Date()) {
    const normalSeconds = date.getHours() * 3600 +
        date.getMinutes() * 60 +
        date.getSeconds() +
        date.getMilliseconds() / 1000;
    const total = Math.floor((normalSeconds / 86400) * 100000);
    const hours = Math.floor(total / 10000);
    const minutes = Math.floor((total % 10000) / 100);
    const seconds = total % 100;

    return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function formatTimestamp(format, date = new Date()) {
    if (format === FORMAT_DECIMAL) {
        return formatDecimalTime(date);
    }
    return strftime(format, date);
}
