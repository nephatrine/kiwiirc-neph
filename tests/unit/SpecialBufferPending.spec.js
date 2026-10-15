import state from '@/libs/state';
import InputHandler from '@/libs/InputHandler';

describe('special buffer message pending', () => {
    let s;
    let network;
    let handler;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.enabled_caps = ['labeled-response', 'echo-message'];
        handler = new InputHandler(s);
        jest.spyOn(network.ircClient, 'say').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function lastMessage(buffer) {
        const messages = buffer.getMessages();
        return messages[messages.length - 1];
    }

    it('sends without label and without pending state in *raw', () => {
        let buffer = s.getOrAddBufferByName(network.id, '*raw');
        handler.processLine('oops test', { network, buffer });

        expect(network.ircClient.say).toHaveBeenCalledTimes(1);
        let [target, , tags] = network.ircClient.say.mock.calls[0];
        expect(target).toBe('*raw');
        expect(tags.label).toBeUndefined();
        expect(lastMessage(buffer).is_pending).toBe(false);
    });

    it('keeps label and pending state in normal channels', () => {
        let buffer = s.getOrAddBufferByName(network.id, '#chan');
        handler.processLine('hello', { network, buffer });

        expect(network.ircClient.say).toHaveBeenCalledTimes(1);
        let [, , tags] = network.ircClient.say.mock.calls[0];
        expect(tags.label).toEqual(expect.any(String));
        let message = lastMessage(buffer);
        expect(message.is_pending).toBe(true);
        expect(buffer.messagesObj.messageLabels[tags.label]).toBe(message);
    });

    it('keeps label and pending state in query buffers', () => {
        let buffer = s.getOrAddBufferByName(network.id, 'SomeNick');
        handler.processLine('hello', { network, buffer });

        let [, , tags] = network.ircClient.say.mock.calls[0];
        expect(tags.label).toEqual(expect.any(String));
        expect(lastMessage(buffer).is_pending).toBe(true);
    });
});
