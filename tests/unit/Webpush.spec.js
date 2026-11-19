import Vue from 'vue';
import state from '@/libs/state';
import swUtils from '../../static/sw-utils.js';

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

describe('webpush service worker parser', () => {
    it('parses tagged, untagged, and prefixless messages', () => {
        let message = swUtils.parseIrcMessage(
            ':nick!user@host PRIVMSG #chan :hello there'
        );
        expect(message.nick).toBe('nick');
        expect(message.command).toBe('PRIVMSG');
        expect(message.params).toEqual(['#chan', 'hello there']);

        message = swUtils.parseIrcMessage(
            '@time=2026-10-26T18:00:00.000Z;msgid=abc :nick!user@host ' +
            'PRIVMSG #chan :hello'
        );
        expect(message.tags.msgid).toBe('abc');
        expect(message.tags.time).toBe('2026-10-26T18:00:00.000Z');
        expect(message.nick).toBe('nick');
        expect(message.command).toBe('PRIVMSG');
        expect(message.params).toEqual(['#chan', 'hello']);

        message = swUtils.parseIrcMessage(
            'NOTE WEBPUSH REGISTERED Push notifications enabled'
        );
        expect(message.nick).toBe('');
        expect(message.command).toBe('NOTE');
        expect(message.params).toEqual([
            'WEBPUSH',
            'REGISTERED',
            'Push',
            'notifications',
            'enabled',
        ]);
    });
});

describe('webpush service worker notifications', () => {
    it('builds notifications for PRIVMSG, NOTICE, ACTION, and INVITE', () => {
        let note = swUtils.buildNotification(
            '@msgid=abc :nick!user@host PRIVMSG #chan :hello'
        );
        expect(note.title).toBe('nick');
        expect(note.body).toBe('hello');
        expect(note.data).toEqual({
            nick: 'nick',
            target: '#chan',
            msgid: 'abc',
            command: 'PRIVMSG',
        });

        note = swUtils.buildNotification(
            ':nick!user@host NOTICE TestNick :hello'
        );
        expect(note.title).toBe('nick');
        expect(note.body).toBe('hello');
        expect(note.data.target).toBe('TestNick');

        note = swUtils.buildNotification(
            ':nick!user@host PRIVMSG #chan :\x01ACTION waves\x01'
        );
        expect(note).not.toBeNull();
        expect(note.title).toBe('nick');

        note = swUtils.buildNotification(
            ':nick!user@host INVITE TestNick #chan'
        );
        expect(note.title).toBe('nick');
        expect(note.body).toBe('Invited you to #chan');
        expect(note.data.target).toBe('#chan');
    });

    it('ignores CTCP, control, server, and empty pushes', () => {
        expect(swUtils.buildNotification(
            ':bot!user@host NOTICE TestNick ' +
            ':\x01RELAYMETA ERR target UNKNOWN_TARGET\x01'
        )).toBeNull();
        expect(swUtils.buildNotification(
            ':bot!user@host NOTICE TestNick :\x01CLIENTINFO ACTION VERSION\x01'
        )).toBeNull();
        expect(swUtils.buildNotification('MARKREAD #chan 123')).toBeNull();
        expect(swUtils.buildNotification(
            'NOTE WEBPUSH REGISTERED Push notifications enabled'
        )).toBeNull();
        expect(swUtils.buildNotification('')).toBeNull();
        expect(swUtils.buildNotification('TAGMSG #chan')).toBeNull();
        expect(swUtils.buildNotification(
            ':nick!user@host PRIVMSG * :hello'
        )).toBeNull();
        expect(swUtils.buildNotification(
            ':nick!user@host PRIVMSG $server :hello'
        )).toBeNull();
        expect(swUtils.buildNotification(
            ':nick!user@host PRIVMSG #chan :'
        )).toBeNull();
    });
});

describe('webpush service worker focus handling', () => {
    it('suppresses focused pushes and client-disabled notifications', () => {
        expect(swUtils.shouldSuppressPush([{ focused: true }])).toBe(true);
        expect(swUtils.shouldSuppressPush([
            { focused: false },
            { focused: true },
        ])).toBe(true);
        expect(swUtils.shouldSuppressPush()).toBe(false);
        expect(swUtils.shouldSuppressPush([])).toBe(false);
        expect(swUtils.shouldSuppressPush([{ focused: false }])).toBe(false);
        expect(swUtils.anyNotificationsDisabled([true, false])).toBe(true);
        expect(swUtils.anyNotificationsDisabled([true, true])).toBe(false);
        expect(swUtils.anyNotificationsDisabled()).toBe(false);
        expect(swUtils.anyNotificationsDisabled([])).toBe(false);
    });
});

describe('webpush service worker scopes', () => {
    it('extracts scopes and builds notification tags', () => {
        let scope = 'https://example.com/kiwi/static/webpush/kiwi-state/42/';
        expect(swUtils.stateKeyFromScope(scope)).toBe('kiwi-state');
        expect(swUtils.networkIdFromScope(scope)).toBe('42');
        expect(swUtils.appRootFromScope(scope)).toBe('https://example.com/kiwi/');

        scope = 'https://example.com/static/webpush/kiwi-state/42/';
        expect(swUtils.appRootFromScope(scope)).toBe('https://example.com/');

        scope = 'https://example.com/static/webpush/webpush/42/';
        expect(swUtils.stateKeyFromScope(scope)).toBe('webpush');
        expect(swUtils.networkIdFromScope(scope)).toBe('42');

        expect(swUtils.notificationTag('kiwi-state', 42, 'abc')).toBe(
            'kiwi-webpush:kiwi-state:42:abc'
        );
        expect(swUtils.notificationTag('kiwi-state', 42, '')).toBe('');
    });
});
