import state from '@/libs/state';

describe('CapNotify', () => {
    let s;
    let network;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        // Force creation of frameworkClient
        // eslint-disable-next-line no-unused-vars
        const client = network.ircClient;
    });

    it('updates enabled caps on ACK and DEL', () => {
        const client = network.ircClient;
        client.network.cap.enabled = ['cap1', 'cap2'];
        client.emit('cap ack', { capabilities: { cap1: '', cap2: '' } });

        expect(network.enabled_caps).toEqual(['cap1', 'cap2']);
        expect(network.hasCap('cap1')).toBe(true);
        expect(network.hasCap('cap2')).toBe(true);
        expect(network.hasCap('cap3')).toBe(false);

        client.network.cap.enabled = ['cap1'];
        client.emit('cap del', { capabilities: { cap2: '' } });

        expect(network.enabled_caps).toEqual(['cap1']);

        const serverBuffer = network.serverBuffer();
        const lastMessage = serverBuffer.getLastMessage();
        expect(lastMessage.message).toContain('Capabilities removed: cap2');
    });

    it('requests standard-replies and new caps without enabling them', () => {
        const client = network.ircClient;
        expect(client.request_extra_caps).toContain('standard-replies');

        const requestSpy = jest.spyOn(client, 'requestCap').mockImplementation(() => {});

        client.emit('cap new', { capabilities: { 'message-tags': '' } });

        // Should not update enabled_caps yet (waiting for ACK)
        expect(network.enabled_caps).toEqual([]);
        expect(requestSpy).toHaveBeenCalledWith('message-tags');
        requestSpy.mockRestore();

        const serverBuffer = network.serverBuffer();
        const lastMessage = serverBuffer.getLastMessage();
        expect(lastMessage.message).toContain('Requested new capabilities: message-tags');
    });
});
