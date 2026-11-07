import state from '@/libs/state';

function addChatMessage(s, buffer, overrides = {}) {
    return s.addMessage(buffer, {
        type: 'privmsg',
        nick: 'Alice',
        message: 'history message',
        raw_text: 'history message',
        ...overrides,
    });
}

function makeBuffer() {
    const s = state.create();
    const network = s.addNetwork('TestNet', 'TestNick', {
        server: 'irc.example.com',
    });
    const buffer = s.addBuffer(network.id, '#test');
    return { s, network, buffer };
}

describe('history context gaps', () => {
    it('tracks a gap between disjoint loaded history windows', () => {
        const { s, buffer } = makeBuffer();

        addChatMessage(s, buffer, {
            time: 1000,
            server_time: 1000,
            tags: { msgid: 'live-1' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            tags: { msgid: 'live-2' },
        });
        addChatMessage(s, buffer, {
            time: 3000,
            server_time: 3000,
            tags: { 'msgid': 'history-1', 'kiwi-history': true },
        });
        addChatMessage(s, buffer, {
            time: 4000,
            server_time: 4000,
            tags: { 'msgid': 'history-2', 'kiwi-history': true },
        });
        buffer.noteHistoryWindow(3000, 4000);

        expect(buffer.historySegments).toHaveLength(2);
        expect(buffer.historyGaps).toHaveLength(1);
        expect(buffer.historyGaps[0].from).toBe(2000);
        expect(buffer.historyGaps[0].to).toBe(3000);
    });

    it('merges overlapping history windows without creating a gap', () => {
        const { s, buffer } = makeBuffer();

        addChatMessage(s, buffer, {
            time: 1000,
            server_time: 1000,
            tags: { msgid: 'live-1' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            tags: { msgid: 'live-2' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            tags: { 'msgid': 'history-1', 'kiwi-history': true },
        });
        addChatMessage(s, buffer, {
            time: 3000,
            server_time: 3000,
            tags: { 'msgid': 'history-2', 'kiwi-history': true },
        });
        buffer.noteHistoryWindow(2000, 3000);

        expect(buffer.historySegments).toHaveLength(1);
        expect(buffer.historyGaps).toHaveLength(0);
    });

    it('loads a disjoint context window and exposes the resulting gap', async() => {
        const { s, network, buffer } = makeBuffer();

        addChatMessage(s, buffer, {
            time: 1000,
            server_time: 1000,
            tags: { msgid: 'live-1' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            tags: { msgid: 'live-2' },
        });

        const around = jest.fn(async() => {
            addChatMessage(s, buffer, {
                time: 3000,
                server_time: 3000,
                tags: { 'msgid': 'context-1', 'kiwi-history': true },
            });
            addChatMessage(s, buffer, {
                time: 4000,
                server_time: 4000,
                tags: { 'msgid': 'context-2', 'kiwi-history': true },
            });
            return {
                commands: [
                    { time: 3000, tags: { msgid: 'context-1' } },
                    { time: 4000, tags: { msgid: 'context-2' } },
                ],
                is_end: false,
            };
        });
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['msgid'],
            around,
        };

        const loaded = await buffer.jumpToMessage({
            irc_id: 'context-1',
            server_time: 3000,
        });

        expect(loaded).toBe(true);
        expect(around).toHaveBeenCalledWith('#test', 'context-1');
        expect(buffer.historySegments).toHaveLength(2);
        expect(buffer.historyGaps).toHaveLength(1);
        expect(buffer.historyGaps[0].from).toBe(2000);
        expect(buffer.historyGaps[0].to).toBe(3000);
    });

    it('connects a BEFORE window to the newer segment despite time gaps', () => {
        const { s, buffer } = makeBuffer();

        addChatMessage(s, buffer, {
            time: 1000,
            server_time: 1000,
            tags: { msgid: 'live-1' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            tags: { msgid: 'live-2' },
        });
        addChatMessage(s, buffer, {
            time: 3000,
            server_time: 3000,
            tags: { 'msgid': 'context-1', 'kiwi-history': true },
        });
        addChatMessage(s, buffer, {
            time: 4000,
            server_time: 4000,
            tags: { 'msgid': 'context-2', 'kiwi-history': true },
        });
        addChatMessage(s, buffer, {
            time: 2500,
            server_time: 2500,
            tags: { 'msgid': 'context-0', 'kiwi-history': true },
        });

        buffer.noteHistoryWindow(3000, 4000, 'around');
        buffer.noteHistoryWindow(2500, 2500, 'before');

        expect(buffer.historySegments).toHaveLength(2);
        expect(buffer.historyGaps).toHaveLength(1);
        expect(buffer.historyGaps[0].from).toBe(2000);
        expect(buffer.historyGaps[0].to).toBe(2500);
    });

    it('requests the correct history reference for each gap direction', async() => {
        const { s, network, buffer } = makeBuffer();

        addChatMessage(s, buffer, {
            time: 1000,
            server_time: 1000,
            tags: { msgid: 'live-1' },
        });
        addChatMessage(s, buffer, {
            time: 2000,
            server_time: 2000,
            tags: { msgid: 'live-2' },
        });
        addChatMessage(s, buffer, {
            time: 3000,
            server_time: 3000,
            tags: { 'msgid': 'history-1', 'kiwi-history': true },
        });
        addChatMessage(s, buffer, {
            time: 4000,
            server_time: 4000,
            tags: { 'msgid': 'history-2', 'kiwi-history': true },
        });
        buffer.noteHistoryWindow(3000, 4000);

        const before = jest.fn().mockResolvedValue({
            commands: [],
            is_end: true,
        });
        const after = jest.fn().mockResolvedValue({
            commands: [],
            is_end: true,
        });
        network.ircClient.chathistory = {
            isSupported: () => true,
            supportedRefTypes: () => ['msgid'],
            before,
            after,
        };

        const gap = buffer.historyGaps[0];
        await buffer.requestHistoryGap(gap, 'older');
        await buffer.requestHistoryGap(gap, 'newer');

        expect(before).toHaveBeenCalledWith('#test', 'history-1');
        expect(after).toHaveBeenCalledWith('#test', 'live-2');
    });
});
