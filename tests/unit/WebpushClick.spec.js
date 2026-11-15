import Vue from 'vue';
import state from '@/libs/state';

jest.mock('@/helpers/TextFormatting', () => ({
    ...jest.requireActual('@/helpers/TextFormatting'),
    t: (key) => key,
}));

function makeState() {
    const s = state.create();
    const network = s.addNetwork('TestNet', 'mynick', {
        server: 'irc.example.com',
    });
    network.state = 'connected';
    const buffer = s.addBuffer(network.id, '#chan');
    const message = s.addMessage(buffer, {
        nick: 'nick',
        message: 'hello',
        irc_id: 'abc',
        time: Date.now(),
    });
    return { s, network, buffer, message };
}

describe('webpush notification clicks', () => {
    it('routes to the message buffer by msgid', async() => {
        const { s, network, buffer, message } = makeState();
        const scroll = jest.spyOn(buffer, 'scrollToMessage');

        const handled = s.handleWebpushNotificationClick({
            stateKey: 'kiwi-state',
            networkId: network.id,
            msgid: 'abc',
            target: '#chan',
        });

        expect(handled).toBe(true);
        expect(s.ui.active_network).toBe(network.id);
        expect(s.ui.active_buffer).toBe('#chan');
        await Vue.nextTick();
        expect(scroll).toHaveBeenCalledWith(message.id);
    });

    it('falls back to the target buffer when the message is not loaded', () => {
        const { s, network } = makeState();

        const handled = s.handleWebpushNotificationClick({
            stateKey: 'kiwi-state',
            networkId: network.id,
            msgid: 'missing',
            target: '#chan',
        });

        expect(handled).toBe(true);
        expect(s.ui.active_network).toBe(network.id);
        expect(s.ui.active_buffer).toBe('#chan');
    });

    it('falls back to the sender nick for direct messages', () => {
        const { s, network } = makeState();
        s.addBuffer(network.id, 'nick');

        const handled = s.handleWebpushNotificationClick({
            stateKey: 'kiwi-state',
            networkId: network.id,
            msgid: 'missing',
            target: 'mynick',
            nick: 'nick',
        });

        expect(handled).toBe(true);
        expect(s.ui.active_network).toBe(network.id);
        expect(s.ui.active_buffer).toBe('nick');
    });

    it('searches all networks when the network id is unknown', async() => {
        const { s, network, buffer, message } = makeState();
        const scroll = jest.spyOn(buffer, 'scrollToMessage');

        const handled = s.handleWebpushNotificationClick({
            stateKey: 'kiwi-state',
            networkId: 999,
            msgid: 'abc',
        });

        expect(handled).toBe(true);
        expect(s.ui.active_network).toBe(network.id);
        expect(s.ui.active_buffer).toBe('#chan');
        await Vue.nextTick();
        expect(scroll).toHaveBeenCalledWith(message.id);
    });

    it('ignores clicks for another state key', () => {
        const { s, network } = makeState();

        const handled = s.handleWebpushNotificationClick({
            stateKey: 'other-state',
            networkId: network.id,
            msgid: 'abc',
            target: '#chan',
        });

        expect(handled).toBe(false);
        expect(s.ui.active_network).toBe(0);
    });

    it('ignores clicks with no matching message or buffer', () => {
        const { s, network } = makeState();

        const handled = s.handleWebpushNotificationClick({
            stateKey: 'kiwi-state',
            networkId: network.id,
            msgid: 'missing',
            target: '#missing',
        });

        expect(handled).toBe(false);
    });

    it('uses a shared notification tag for local notifications', () => {
        const { s, network, buffer } = makeState();
        network.nick = 'mynick';
        const events = [];
        s.$on('notification.show', (message, opts) => {
            events.push(opts);
        });

        s.addMessage(buffer, {
            nick: 'nick',
            message: 'mynick: hello',
            type: 'privmsg',
            irc_id: 'abc2',
            time: Date.now(),
        });

        expect(events).toHaveLength(1);
        expect(events[0].tag).toBe('kiwi-webpush:kiwi-state:1:abc2');
    });
});
