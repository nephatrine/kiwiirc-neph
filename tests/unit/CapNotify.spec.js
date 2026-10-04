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

    it('should update enabled_caps on cap ack', () => {
        const client = network.ircClient;
        client.network.cap.enabled = ['cap1', 'cap2'];
        client.emit('cap ack', { capabilities: { cap1: '', cap2: '' } });
        expect(network.enabled_caps).toEqual(['cap1', 'cap2']);
        expect(network.hasCap('cap1')).toBe(true);
        expect(network.hasCap('cap2')).toBe(true);
        expect(network.hasCap('cap3')).toBe(false);
    });

    it('should update enabled_caps and add message on cap new', () => {
        const client = network.ircClient;
        client.network.cap.enabled = ['cap1', 'cap2', 'cap3'];
        client.emit('cap new', { capabilities: { cap3: '' } });

        expect(network.enabled_caps).toEqual(['cap1', 'cap2', 'cap3']);

        const serverBuffer = network.serverBuffer();
        const lastMessage = serverBuffer.getLastMessage();
        expect(lastMessage.message).toContain('New capabilities available: cap3');
    });

    it('should update enabled_caps and add message on cap del', () => {
        const client = network.ircClient;
        network.enabled_caps = ['cap1', 'cap2'];
        client.network.cap.enabled = ['cap1'];
        client.emit('cap del', { capabilities: { cap2: '' } });

        expect(network.enabled_caps).toEqual(['cap1']);

        const serverBuffer = network.serverBuffer();
        const lastMessage = serverBuffer.getLastMessage();
        expect(lastMessage.message).toContain('Capabilities removed: cap2');
    });
});
