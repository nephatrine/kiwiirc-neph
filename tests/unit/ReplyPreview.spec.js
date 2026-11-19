import { shouldShowReplyPreview } from '@/libs/bufferTools';

const BASE_TIME = 1000000;

function makeMessage(opts = {}) {
    let nick = opts.nick || 'Alice';
    return {
        nick,
        bridged_nick: opts.bridged_nick || '',
        reply: opts.reply,
        type: opts.type || 'privmsg',
        time: opts.time || BASE_TIME,
        day_num: typeof opts.day_num === 'undefined' ? 100 : opts.day_num,
        condenseKey() {
            return this.nick + '\n' + this.bridged_nick;
        },
    };
}

function previewFlags(messages) {
    return messages.map((message, idx) => (
        shouldShowReplyPreview(messages, message, idx)
    ));
}

describe('reply preview grouping', () => {
    it('groups consecutive replies by target, author, time, day, and type', () => {
        let messages = [
            makeMessage({ reply: 'target' }),
            makeMessage({ reply: 'target' }),
            makeMessage({ reply: 'target' }),
        ];
        expect(previewFlags(messages)).toEqual([true, false, false]);

        messages = [
            makeMessage({ reply: 'first' }),
            makeMessage({ reply: 'second' }),
            makeMessage({ reply: 'second' }),
        ];
        expect(previewFlags(messages)).toEqual([true, true, false]);

        messages = [
            makeMessage({ nick: 'Alice', reply: 'target' }),
            makeMessage({ nick: 'Bob', reply: 'target' }),
        ];
        expect(previewFlags(messages)).toEqual([true, true]);

        messages = [
            makeMessage({ reply: 'target' }),
            makeMessage({ reply: 'target', time: BASE_TIME + 60000 }),
        ];
        expect(previewFlags(messages)).toEqual([true, true]);

        messages = [
            makeMessage({ reply: 'target' }),
            makeMessage({ reply: 'target', day_num: 101 }),
        ];
        expect(previewFlags(messages)).toEqual([true, true]);

        messages = [
            makeMessage({ reply: 'target', type: 'privmsg' }),
            makeMessage({ reply: 'target', type: 'action' }),
        ];
        expect(previewFlags(messages)).toEqual([true, true]);
    });

    it('handles non-reply and first-message cases', () => {
        let messages = [
            makeMessage(),
            makeMessage({ reply: 'target' }),
        ];
        expect(previewFlags(messages)).toEqual([false, true]);

        messages = [
            makeMessage({ reply: 'target' }),
            makeMessage(),
        ];
        expect(previewFlags(messages)).toEqual([true, false]);
    });
});
