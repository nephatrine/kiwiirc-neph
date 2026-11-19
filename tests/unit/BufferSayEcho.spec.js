import state from '@/libs/state';

describe('BufferState.say echo confirmation', () => {
    let created;

    function fresh(caps) {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.enabled_caps = caps;
        const buffer = s.addBuffer(network.id, '#channel');
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
        created.push(s);
        return { s, network, buffer };
    }

    beforeEach(() => {
        created = [];
    });

    afterEach(() => {
        jest.restoreAllMocks();
        created.forEach((s) => s.$destroy());
        created = [];
    });

    test('confirms labeled and unlabeled echoes without duplicating', () => {
        let ctx = fresh(['echo-message', 'labeled-response']);
        let url = 'https://files.example/upload.txt';

        ctx.buffer.say(url);

        let local = ctx.buffer.getLastMessage();
        expect(local.is_pending).toBe(true);
        expect(local.raw_text).toBe(url);
        expect(local.tags.label).toBeTruthy();

        let count = ctx.buffer.getMessages().length;
        ctx.s.addMessage(ctx.buffer, {
            time: Date.now(),
            nick: ctx.network.nick,
            message: url,
            raw_text: url,
            tags: { label: local.tags.label },
            type: 'privmsg',
        });

        expect(ctx.buffer.getMessages()).toHaveLength(count);
        expect(local.is_pending).toBe(false);

        ctx = fresh(['echo-message']);
        url = 'https://files.example/upload.txt';

        ctx.buffer.say(url);

        local = ctx.buffer.getLastMessage();
        expect(local.is_pending).toBe(true);
        expect(local.raw_text).toBe(url);

        count = ctx.buffer.getMessages().length;
        ctx.s.addMessage(ctx.buffer, {
            time: Date.now(),
            nick: ctx.network.nick,
            message: url,
            raw_text: url,
            tags: {},
            type: 'privmsg',
        });

        expect(ctx.buffer.getMessages()).toHaveLength(count);
        expect(local.is_pending).toBe(false);
    });
});
