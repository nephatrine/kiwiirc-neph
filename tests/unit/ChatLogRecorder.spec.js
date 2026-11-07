import state from '@/libs/state';
import {
    isLoggableMessage,
    toLogEntry
} from '@/libs/ChatLogRecorder';

function makeBuffer() {
    const s = state.create();
    s.settings.startupOptions = {};
    const network = s.addNetwork('TestNet', 'Nick', {
        server: 'irc.example.com',
    });
    const buffer = s.addBuffer(network.id, '#test');
    return { buffer, network };
}

describe('Chat log recorder', () => {
    it('builds a log entry for channel chat messages', () => {
        const { buffer } = makeBuffer();
        const message = {
            type: 'privmsg',
            nick: 'Alice',
            message: 'hello there',
            raw_text: 'hello there',
            time: 12345,
            server_time: 12340,
            irc_id: 'msg-1',
            user: { account: 'alice' },
        };

        expect(isLoggableMessage(buffer, message)).toBe(true);
        expect(toLogEntry(buffer, message)).toEqual({
            network_id: 1,
            network_name: 'TestNet',
            buffer_name: '#test',
            time: 12345,
            server_time: 12340,
            nick: 'Alice',
            account: 'alice',
            type: 'privmsg',
            message: 'hello there',
            raw_text: 'hello there',
            irc_id: 'msg-1',
            is_history: false,
            is_pending: false,
            client_id: expect.any(String),
        });
    });

    it('skips system, ignored, and redacted messages', () => {
        const { buffer } = makeBuffer();

        expect(isLoggableMessage(buffer, { type: 'join' })).toBe(false);
        expect(isLoggableMessage(buffer, { type: 'privmsg', ignore: true })).toBe(false);
        expect(isLoggableMessage(buffer, { type: 'privmsg', is_redacted: true })).toBe(false);
    });

    it('skips server buffers', () => {
        const { buffer } = makeBuffer();
        const serverBuffer = buffer.getNetwork().serverBuffer();
        expect(isLoggableMessage(serverBuffer, {})).toBe(false);
    });
});
