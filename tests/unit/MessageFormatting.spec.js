import MessageList from '@/components/MessageList';
import state from '@/libs/state';
import { ircToHtml } from '@/helpers/IrcToHtml';
import { htmlToIrc } from '@/helpers/HtmlToIrc';
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

describe('global simple markdown', () => {
    let s;

    beforeEach(() => {
        s = state.create();
    });

    afterEach(() => {
        s.$destroy();
    });

    test('uses the global setting instead of a buffer override', () => {
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#test');
        buffer.setting('extra_formatting', false);
        s.setting('buffers.extra_formatting', true);

        expect(MessageList.computed.useExtraFormatting.call({
            $state: s,
            buffer,
        })).toBe(true);

        s.setting('buffers.extra_formatting', false);

        expect(MessageList.computed.useExtraFormatting.call({
            $state: s,
            buffer,
        })).toBe(false);
    });
});

describe('ircToHtml', () => {
    test('renders IRC formatting and colours', () => {
        expect(ircToHtml('\x02bold\x02')).toContain('font-weight:bold');
        expect(ircToHtml('\x1Ditalic\x1D')).toContain('font-style:italic');
        expect(ircToHtml('\x1Funderline\x1F')).toContain('text-decoration:underline');
        expect(ircToHtml('\x1Estrike\x1E')).toContain('text-decoration:line-through');
        expect(ircToHtml('\x11mono\x11')).toContain('kiwi-formatting-extras-monospace');
        expect(ircToHtml('\x16reverse\x16')).toContain('kiwi-formatting-reverse');
        expect(ircToHtml('\x0304red\x03')).toContain('irc-fg-colour-light-red');
    });

    test('escapes HTML, keeps emoji, and converts shortcodes when enabled', () => {
        const html = ircToHtml('<b>unsafe</b> 👍');

        expect(html).not.toContain('<b>unsafe</b>');
        expect(html).toContain('&lt;b&gt;unsafe&lt;/b&gt;');
        expect(html).toContain('class="kiwi-emoji"');

        const appState = state();
        const previous = appState.setting('buffers.emoji_convert_incoming');
        appState.setting('buffers.emoji_convert_incoming', true);

        try {
            expect(ircToHtml(':thumbsup:')).toContain('kiwi-emoji');
        } finally {
            appState.setting('buffers.emoji_convert_incoming', previous);
        }
    });
});

describe('htmlToIrc', () => {
    // Mirrors how the component resolves a CSS colour into an IRC colour code:
    // a numeric code for standard colours (stubbed here) and the hex string for
    // hex colours.
    const resolveColour = (colour) => {
        if (!colour) return '';
        let value = colour.trim().toLowerCase();
        let m = value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (m) {
            return String((parseInt(m[1], 10) + parseInt(m[2], 10) + parseInt(m[3], 10)) % 16);
        }
        return value;
    };

    const convert = (html) => htmlToIrc(html, resolveColour);

    test('handles plain text, entities, unknown tags, and empty input', () => {
        expect(convert('plain text')).toBe('plain text');
        expect(convert('<span>plain</span>')).toBe('plain');
        expect(convert('a &amp; b')).toBe('a & b');
        expect(convert('a&nbsp;b')).toBe('a\u00a0b');
        expect(convert('<!-- comment -->text')).toBe('text');
        expect(convert('<p>para</p>')).toBe('para');
        expect(convert('<a href="https://example.com">link</a>')).toBe('link');
        expect(convert('')).toBe('');
        expect(convert(undefined)).toBe('');
    });

    test('converts inline tags and style attributes', () => {
        expect(convert('<strong>bold</strong>')).toBe('\x02bold\x0f');
        expect(convert('<b>bold</b>')).toBe('\x02bold\x0f');
        expect(convert('<em>italic</em>')).toBe('\x1ditalic\x0f');
        expect(convert('<u>under</u>')).toBe('\x1funder\x0f');
        expect(convert('<strike>strike</strike>')).toBe('\x1estrike\x0f');
        expect(convert('<del>del</del>')).toBe('\x1edel\x0f');
        expect(convert('<code>mono</code>')).toBe('\x11mono\x0f');
        expect(convert('<span style="font-weight: bold">x</span>')).toBe('\x02x\x0f');
        expect(convert('<span style="font-style: italic">x</span>')).toBe('\x1dx\x0f');
        expect(convert('<span style="text-decoration: underline">x</span>')).toBe('\x1fx\x0f');
        expect(convert('<span style="text-decoration: line-through">x</span>')).toBe('\x1ex\x0f');
        expect(convert('<span style="font-family: monospace">x</span>')).toBe('\x11x\x0f');
        expect(convert('<span style="kiwi-reverse: 1">x</span>')).toBe('\x16x\x0f');
    });

    test('converts standard, hex, nested, and digit-safe colours', () => {
        expect(convert('<span style="color: rgb(255, 0, 0)">red</span>')).toBe('\x0315red\x0f');
        expect(convert('<span style="background-color: rgb(0, 0, 255)">x</span>')).toBe('\x0399,15x\x0f');
        expect(convert('<span style="color: #abcdef">hex</span>')).toBe('\x04abcdefhex\x0f');
        expect(convert('<span style="color: #123456; background-color: #654321">both</span>'))
            .toBe('\x04123456,654321both\x0f');
        expect(convert('<strong><em>bold italic</em></strong>')).toBe('\x02\x1dbold italic\x1d\x0f');
        expect(convert('<span style="color: rgb(255, 0, 0)">red <strong>bold red</strong> plain</span>'))
            .toBe('\x0315red \x02bold red\x02 plain\x0f');
        expect(convert('<strong><span style="color: rgb(255, 0, 0)">a</span>1</strong>'))
            .toBe('\x02\x0315a\x03991\x0f');
    });

    test('converts line breaks and image alt text', () => {
        expect(convert('line one<br>line two')).toBe('line one\nline two');
        expect(convert('<div>one</div><div>two</div>')).toBe('one\ntwo');
        expect(convert('<div>outer<div>inner</div></div>')).toBe('outer\ninner');
        expect(convert('<br>')).toBe('');
        expect(convert('text<br>')).toBe('text');
        expect(convert('<img alt=":smile:">')).toBe(':smile:');
        expect(convert('hello <img alt=":wave:"> world')).toBe('hello :wave: world');
    });
});

describe('timestamp formats', () => {
    test('maps recognized formats to time systems and reserves wide space', () => {
        expect(timeSystemForFormat(FORMAT_12H)).toBe(TIME_SYSTEM_12H);
        expect(timeSystemForFormat(FORMAT_24H)).toBe(TIME_SYSTEM_24H);
        expect(timeSystemForFormat(FORMAT_DECIMAL)).toBe(TIME_SYSTEM_DECIMAL);
        expect(timeSystemForFormat('%Y-%m-%d %H:%M')).toBeNull();
        expect(formatForTimeSystem(TIME_SYSTEM_12H)).toBe(FORMAT_12H);
        expect(formatForTimeSystem(TIME_SYSTEM_24H)).toBe(FORMAT_24H);
        expect(formatForTimeSystem(TIME_SYSTEM_DECIMAL)).toBe(FORMAT_DECIMAL);
        expect(formatForTimeSystem('unknown')).toBe('');

        expect(usesWideTimestampFormat(FORMAT_24H)).toBe(false);
        expect(usesWideTimestampFormat(FORMAT_DECIMAL)).toBe(false);
        expect(usesWideTimestampFormat('')).toBe(false);
        expect(usesWideTimestampFormat(FORMAT_12H)).toBe(true);
        expect(usesWideTimestampFormat('%Y-%m-%d %H:%M')).toBe(true);
    });

    test('formats strftime timestamps and decimal time', () => {
        const date = new Date(2026, 0, 1, 14, 5, 9);

        expect(formatTimestamp('%H:%M', date)).toBe('14:05');
        expect(formatTimestamp('%l:%M:%S %p', date)).toBe(' 2:05:09 PM');

        expect(formatDecimalTime(new Date(2026, 0, 1, 0, 0, 0))).toBe('0:00:00');
        expect(formatDecimalTime(new Date(2026, 0, 1, 2, 24, 0))).toBe('1:00:00');
        expect(formatDecimalTime(new Date(2026, 0, 1, 12, 0, 0))).toBe('5:00:00');
        expect(formatDecimalTime(new Date(2026, 0, 1, 23, 59, 59, 999)))
            .toBe('9:99:99');

        expect(formatTimestamp(FORMAT_DECIMAL, new Date(2026, 0, 1, 12, 0, 0)))
            .toBe('5:00:00');
    });
});
