import state from '@/libs/state';

describe('BufferState.say echo confirmation', () => {
    let s;
    let network;
    let buffer;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        buffer = s.addBuffer(network.id, '#channel');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        s.$destroy();
    });

    test('marks labeled outgoing messages pending and confirms their echo', () => {
        network.enabled_caps = ['echo-message', 'labeled-response'];
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
        const url = 'https://files.example/upload.txt';

        buffer.say(url);

        const local = buffer.getLastMessage();
        expect(local.is_pending).toBe(true);
        expect(local.raw_text).toBe(url);
        expect(local.tags.label).toBeTruthy();

        const count = buffer.getMessages().length;
        s.addMessage(buffer, {
            time: Date.now(),
            nick: network.nick,
            message: url,
            raw_text: url,
            tags: { label: local.tags.label },
            type: 'privmsg',
        });

        expect(buffer.getMessages()).toHaveLength(count);
        expect(local.is_pending).toBe(false);
    });

    test('confirms an unlabeled echo by its raw text', () => {
        network.enabled_caps = ['echo-message'];
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
        const url = 'https://files.example/upload.txt';

        buffer.say(url);

        const local = buffer.getLastMessage();
        expect(local.is_pending).toBe(true);
        expect(local.raw_text).toBe(url);

        const count = buffer.getMessages().length;
        s.addMessage(buffer, {
            time: Date.now(),
            nick: network.nick,
            message: url,
            raw_text: url,
            tags: {},
            type: 'privmsg',
        });

        expect(buffer.getMessages()).toHaveLength(count);
        expect(local.is_pending).toBe(false);
    });
});
