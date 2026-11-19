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
    it('routes to the message buffer by msgid across networks', async() => {
        let { s, network, buffer, message } = makeState();
        let scroll = jest.spyOn(buffer, 'scrollToMessage');

        let handled = s.handleWebpushNotificationClick({
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

        ({ s, network, buffer, message } = makeState());
        scroll = jest.spyOn(buffer, 'scrollToMessage');

        handled = s.handleWebpushNotificationClick({
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

    it('falls back to the target buffer, sender nick, or nothing', () => {
        let { s, network } = makeState();

        let handled = s.handleWebpushNotificationClick({
            stateKey: 'kiwi-state',
            networkId: network.id,
            msgid: 'missing',
            target: '#chan',
        });
        expect(handled).toBe(true);
        expect(s.ui.active_network).toBe(network.id);
        expect(s.ui.active_buffer).toBe('#chan');

        ({ s, network } = makeState());
        s.addBuffer(network.id, 'nick');

        handled = s.handleWebpushNotificationClick({
            stateKey: 'kiwi-state',
            networkId: network.id,
            msgid: 'missing',
            target: 'mynick',
            nick: 'nick',
        });
        expect(handled).toBe(true);
        expect(s.ui.active_network).toBe(network.id);
        expect(s.ui.active_buffer).toBe('nick');

        ({ s, network } = makeState());

        handled = s.handleWebpushNotificationClick({
            stateKey: 'other-state',
            networkId: network.id,
            msgid: 'abc',
            target: '#chan',
        });
        expect(handled).toBe(false);
        expect(s.ui.active_network).toBe(0);

        ({ s, network } = makeState());

        handled = s.handleWebpushNotificationClick({
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
