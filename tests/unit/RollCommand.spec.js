import state from '@/libs/state';
import InputHandler from '@/libs/InputHandler';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key) => key),
    };
});

describe('/roll command', () => {
    let s;
    let network;
    let buffer;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.net',
            port: 6667,
        });
        network.nick = 'TestNick';
        buffer = s.addBuffer(network.id, '#test');
        /* eslint-disable no-new */
        new InputHandler(s);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('sends a single action for a valid roll', () => {
        network.enabled_caps = ['echo-message'];
        const actionSpy = jest.spyOn(network.ircClient, 'action').mockImplementation(() => {});

        s.$emit('input.raw', '/roll 4d6k3', { network, buffer });

        expect(actionSpy).toHaveBeenCalledTimes(1);
        expect(actionSpy.mock.calls[0][0]).toBe('#test');
        expect(actionSpy.mock.calls[0][1]).toBe('dice_roll_breakdown');

        let messages = buffer.getMessages();
        expect(messages).toHaveLength(1);
        expect(messages[0].type).toBe('action');
        expect(messages[0].is_pending).toBe(true);
        expect(messages[0].raw_text).toBe('dice_roll_breakdown');
        expect(messages[0].message).toContain('* TestNick');
    });

    it('confirms the local roll with the server echo instead of duplicating it', () => {
        network.enabled_caps = ['echo-message'];
        jest.spyOn(network.ircClient, 'action').mockImplementation(() => {});

        s.$emit('input.raw', '/roll 4d6k3', { network, buffer });
        expect(buffer.getMessages()).toHaveLength(1);

        s.addMessage(buffer, {
            time: Date.now(),
            nick: 'TestNick',
            message: '* TestNick dice_roll_breakdown',
            raw_text: 'dice_roll_breakdown',
            type: 'action',
            tags: { msgid: 'roll-msgid' },
        });

        let messages = buffer.getMessages();
        expect(messages).toHaveLength(1);
        expect(messages[0].is_pending).toBe(false);
        expect(messages[0].irc_id).toBe('roll-msgid');
    });

    it('includes reply tags when rolling as a reply', () => {
        network.enabled_caps = ['echo-message', 'message-tags'];
        network.isupport.CLIENTTAGDENY = '';
        buffer.replying_to = { irc_id: 'original-msgid' };
        const actionSpy = jest.spyOn(network.ircClient, 'action').mockImplementation(() => {});

        s.$emit('input.raw', '/roll 1d20', { network, buffer });

        expect(actionSpy).toHaveBeenCalledTimes(1);
        expect(actionSpy.mock.calls[0][2]).toEqual({ '+reply': 'original-msgid' });
        expect(buffer.replying_to).toBeNull();
    });

    it('shows a local error and sends nothing for an invalid roll', () => {
        const actionSpy = jest.spyOn(network.ircClient, 'action').mockImplementation(() => {});
        const addMessageSpy = jest.spyOn(s, 'addMessage');

        s.$emit('input.raw', '/roll abc', { network, buffer });

        expect(actionSpy).not.toHaveBeenCalled();
        const errorCall = addMessageSpy.mock.calls.find((call) => call[1].type === 'error');
        expect(errorCall).toBeTruthy();
        expect(errorCall[1].message).toBe('dice_invalid');
    });

    it('reports an empty roll differently from an invalid one', () => {
        const actionSpy = jest.spyOn(network.ircClient, 'action').mockImplementation(() => {});
        const addMessageSpy = jest.spyOn(s, 'addMessage');

        s.$emit('input.raw', '/roll', { network, buffer });

        expect(actionSpy).not.toHaveBeenCalled();
        const errorCall = addMessageSpy.mock.calls.find((call) => call[1].type === 'error');
        expect(errorCall).toBeTruthy();
        expect(errorCall[1].message).toBe('dice_invalid_empty');
    });

    it('no longer handles /dice', () => {
        const actionSpy = jest.spyOn(network.ircClient, 'action').mockImplementation(() => {});
        const rawSpy = jest.spyOn(network.ircClient, 'raw').mockImplementation(() => {});

        s.$emit('input.raw', '/dice 20', { network, buffer });

        expect(actionSpy).not.toHaveBeenCalled();
        expect(rawSpy).toHaveBeenCalledWith('dice 20');
    });
});
