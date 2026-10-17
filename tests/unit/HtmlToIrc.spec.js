import { htmlToIrc } from '@/helpers/HtmlToIrc';

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

describe('htmlToIrc', () => {
    test('passes plain text through', () => {
        expect(convert('plain text')).toBe('plain text');
        expect(convert('<span>plain</span>')).toBe('plain');
    });

    test('converts inline tag styles to IRC codes', () => {
        expect(convert('<strong>bold</strong>')).toBe('\x02bold\x0f');
        expect(convert('<b>bold</b>')).toBe('\x02bold\x0f');
        expect(convert('<em>italic</em>')).toBe('\x1ditalic\x0f');
        expect(convert('<u>under</u>')).toBe('\x1funder\x0f');
        expect(convert('<strike>strike</strike>')).toBe('\x1estrike\x0f');
        expect(convert('<del>del</del>')).toBe('\x1edel\x0f');
        expect(convert('<code>mono</code>')).toBe('\x11mono\x0f');
    });

    test('converts style attribute decorations', () => {
        expect(convert('<span style="font-weight: bold">x</span>')).toBe('\x02x\x0f');
        expect(convert('<span style="font-style: italic">x</span>')).toBe('\x1dx\x0f');
        expect(convert('<span style="text-decoration: underline">x</span>')).toBe('\x1fx\x0f');
        expect(convert('<span style="text-decoration: line-through">x</span>')).toBe('\x1ex\x0f');
        expect(convert('<span style="font-family: monospace">x</span>')).toBe('\x11x\x0f');
        expect(convert('<span style="kiwi-reverse: 1">x</span>')).toBe('\x16x\x0f');
    });

    test('converts standard colours via the resolver', () => {
        expect(convert('<span style="color: rgb(255, 0, 0)">red</span>')).toBe('\x0315red\x0f');
        expect(convert('<span style="background-color: rgb(0, 0, 255)">x</span>')).toBe('\x0399,15x\x0f');
    });

    test('converts hex colours to the hex colour protocol', () => {
        expect(convert('<span style="color: #abcdef">hex</span>')).toBe('\x04abcdefhex\x0f');
        expect(convert('<span style="color: #123456; background-color: #654321">both</span>'))
            .toBe('\x04123456,654321both\x0f');
    });

    test('tracks nested styles', () => {
        expect(convert('<strong><em>bold italic</em></strong>')).toBe('\x02\x1dbold italic\x1d\x0f');
        expect(convert('<span style="color: rgb(255, 0, 0)">red <strong>bold red</strong> plain</span>'))
            .toBe('\x0315red \x02bold red\x02 plain\x0f');
    });

    test('turns br and div into newlines and drops empty lines', () => {
        expect(convert('line one<br>line two')).toBe('line one\nline two');
        expect(convert('<div>one</div><div>two</div>')).toBe('one\ntwo');
        expect(convert('<div>outer<div>inner</div></div>')).toBe('outer\ninner');
        expect(convert('<br>')).toBe('');
        expect(convert('text<br>')).toBe('text');
    });

    test('inserts image alt text (emojis)', () => {
        expect(convert('<img alt=":smile:">')).toBe(':smile:');
        expect(convert('hello <img alt=":wave:"> world')).toBe('hello :wave: world');
    });

    test('decodes HTML entities', () => {
        expect(convert('a &amp; b')).toBe('a & b');
        expect(convert('a&nbsp;b')).toBe('a\u00a0b');
    });

    test('disambiguates a colour reset followed by a digit', () => {
        // The \x03 reset must become \x0399 so the following "1" is not read as
        // a colour code.
        expect(convert('<strong><span style="color: rgb(255, 0, 0)">a</span>1</strong>'))
            .toBe('\x02\x0315a\x03991\x0f');
    });

    test('ignores non-element nodes and passes unknown tags through', () => {
        expect(convert('<!-- comment -->text')).toBe('text');
        expect(convert('<p>para</p>')).toBe('para');
        expect(convert('<a href="https://example.com">link</a>')).toBe('link');
    });

    test('handles empty input', () => {
        expect(convert('')).toBe('');
        expect(convert(undefined)).toBe('');
    });
});
