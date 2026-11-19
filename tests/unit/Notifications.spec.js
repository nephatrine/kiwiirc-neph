import appState from '@/libs/state';
import { AudioManager } from '@/libs/AudioManager';

const originalNotification = window.Notification;

function loadNotifications() {
    let notifications = null;
    jest.isolateModules(() => {
        notifications = jest.requireActual('@/libs/Notifications');
    });
    return notifications;
}

function makeState() {
    return {
        ui: {
            app_has_focus: false,
        },
        $on: jest.fn(),
        $emit: jest.fn(),
    };
}

function notificationHandler(state) {
    const call = state.$on.mock.calls.find(([event]) => (
        event === 'notification.show'
    ));
    return call && call[1];
}

function makeNativeBridge() {
    const clickHandlers = new Set();
    const closeHandlers = new Set();
    const show = jest.fn((payload) => Promise.resolve({
        shown: true,
        id: payload.id,
    }));

    window.kiwiDesktop = {
        notifications: {
            isAvailable: () => true,
            show,
            close: jest.fn(() => Promise.resolve(true)),
            onClick: (handler) => {
                clickHandlers.add(handler);
                return () => clickHandlers.delete(handler);
            },
            onClose: (handler) => {
                closeHandlers.add(handler);
                return () => closeHandlers.delete(handler);
            },
        },
    };

    return {
        show,
        emitClick(id) {
            clickHandlers.forEach((handler) => handler(id));
        },
        emitClose(id) {
            closeHandlers.forEach((handler) => handler(id));
        },
    };
}

function makeBrowserNotification() {
    const instances = [];

    class WebNotification {
        static permission = 'granted';
        static requestPermission = jest.fn();

        constructor(title, options) {
            this.title = title;
            this.options = options;
            this.close = jest.fn();
            instances.push(this);
        }
    }

    window.Notification = WebNotification;

    return { WebNotification, instances };
}

describe('desktop notifications', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        delete window.kiwiDesktop;
        if (originalNotification) {
            window.Notification = originalNotification;
        } else {
            delete window.Notification;
        }
        jest.useRealTimers();
    });

    it('uses the native bridge and honors do not disturb and close', () => {
        let bridge = makeNativeBridge();
        let Notifications = loadNotifications();
        let state = makeState();
        let onclick = jest.fn();

        Notifications.listenForNewMessages(state);
        notificationHandler(state)('hello', {
            title: 'Title',
            onclick,
            force: true,
        });

        expect(bridge.show).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Title',
            body: 'hello',
            id: expect.any(String),
        }));

        let id = bridge.show.mock.calls[0][0].id;
        bridge.emitClick(id);
        expect(onclick).toHaveBeenCalledTimes(1);

        bridge = makeNativeBridge();
        Notifications = loadNotifications();
        state = makeState();
        onclick = jest.fn();

        Notifications.listenForNewMessages(state);
        notificationHandler(state)('hello', {
            title: 'Title',
            onclick,
            force: true,
        });

        id = bridge.show.mock.calls[0][0].id;
        bridge.emitClose(id);
        bridge.emitClick(id);
        expect(onclick).not.toHaveBeenCalled();

        bridge = makeNativeBridge();
        Notifications = loadNotifications();
        state = makeState();
        state.ui.notifications_enabled = false;

        Notifications.listenForNewMessages(state);
        notificationHandler(state)('hello', {
            title: 'Title',
            force: true,
        });

        expect(bridge.show).not.toHaveBeenCalled();
    });

    it('does not request browser permission when native notifications exist', () => {
        makeNativeBridge();
        window.Notification = {
            permission: 'default',
            requestPermission: jest.fn(),
        };
        const Notifications = loadNotifications();
        const state = makeState();

        Notifications.requestPermission(state);

        expect(window.Notification.requestPermission).not.toHaveBeenCalled();
        expect(state.$emit).toHaveBeenCalledWith('notification.enabled');
    });

    it('answers service worker notification state requests', () => {
        const originalServiceWorker = Object.getOwnPropertyDescriptor(
            navigator,
            'serviceWorker'
        );
        const listeners = [];
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: {
                addEventListener: (type, handler) => {
                    if (type === 'message') {
                        listeners.push(handler);
                    }
                },
            },
        });

        try {
            const Notifications = loadNotifications();
            const state = makeState();
            state.ui.notifications_enabled = false;

            Notifications.listenForWebpushClicks(state);

            const mutedPort = { postMessage: jest.fn() };
            listeners[0]({
                data: { type: 'kiwi-notifications-state-request' },
                ports: [mutedPort],
            });
            expect(mutedPort.postMessage).toHaveBeenCalledWith({
                notificationsEnabled: false,
            });

            state.ui.notifications_enabled = true;
            const enabledPort = { postMessage: jest.fn() };
            listeners[0]({
                data: { type: 'kiwi-notifications-state-request' },
                ports: [enabledPort],
            });
            expect(enabledPort.postMessage).toHaveBeenCalledWith({
                notificationsEnabled: true,
            });
        } finally {
            if (originalServiceWorker) {
                Object.defineProperty(
                    navigator,
                    'serviceWorker',
                    originalServiceWorker
                );
            } else {
                delete navigator.serviceWorker;
            }
        }
    });

    it('falls back to browser notifications and closes them after the TTL', () => {
        delete window.kiwiDesktop;

        let browser = makeBrowserNotification();
        let Notifications = loadNotifications();
        let state = makeState();
        const onclick = jest.fn();

        Notifications.listenForNewMessages(state);
        notificationHandler(state)('hello', {
            title: 'Title',
            onclick,
            force: true,
        });

        expect(browser.instances).toHaveLength(1);
        expect(browser.instances[0].title).toBe('Title');
        expect(browser.instances[0].onclick).toBe(onclick);

        browser = makeBrowserNotification();
        Notifications = loadNotifications();
        state = makeState();

        Notifications.listenForNewMessages(state);
        notificationHandler(state)('hello', {
            title: 'Title',
            ttl: 1000,
            force: true,
        });

        jest.advanceTimersByTime(1000);

        expect(browser.instances[0].close).toHaveBeenCalled();
    });
});

describe('notification settings', () => {
    let s;
    let network;
    let buffer;
    let notifications;

    beforeEach(() => {
        s = appState.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        buffer = s.addBuffer(network.id, '#test');
        buffer.setting('alert_on', 'message');
        s.ui.app_has_focus = false;
        notifications = [];
        s.$on('notification.show', (message, opts) => {
            notifications.push({ message, opts });
        });
    });

    afterEach(() => {
        s.$destroy();
    });

    function addMessage(target, message) {
        return s.addMessage(target, Object.assign({
            nick: 'OtherUser',
            time: Date.now(),
        }, message));
    }

    test('global desktop notifications gate message notifications', () => {
        s.setting('buffers.show_notifications', false);
        addMessage(buffer, {
            message: 'hello',
            type: 'privmsg',
        });
        expect(notifications).toHaveLength(0);

        s.setting('buffers.show_notifications', true);
        addMessage(buffer, {
            message: 'hello again',
            type: 'privmsg',
        });
        expect(notifications).toHaveLength(1);
    });

    test('global notification sounds gate message and startup sounds', () => {
        let ctx = { s, network, buffer, addMessage };
        let audio = { play: jest.fn() };
        let manager = new AudioManager(audio);
        manager.watchForMessages(ctx.s);
        manager.listen(ctx.s);

        ctx.s.setting('notificationSounds', false);
        ctx.addMessage(ctx.buffer, {
            message: 'quiet',
            type: 'privmsg',
        });
        ctx.s.$emit('audio.play', 'startup', ctx.network);
        expect(audio.play).not.toHaveBeenCalled();

        ctx = {
            s: appState.create(),
            network: null,
            buffer: null,
            addMessage: null,
        };
        ctx.network = ctx.s.addNetwork('TestNetwork', 'TestNick', {});
        ctx.network.nick = 'TestNick';
        ctx.buffer = ctx.s.addBuffer(ctx.network.id, '#test');
        ctx.buffer.setting('alert_on', 'message');
        ctx.s.ui.app_has_focus = false;
        ctx.addMessage = (target, message) => ctx.s.addMessage(target, Object.assign({
            nick: 'OtherUser',
            time: Date.now(),
        }, message));
        audio = { play: jest.fn() };
        manager = new AudioManager(audio);
        manager.watchForMessages(ctx.s);
        manager.listen(ctx.s);
        ctx.s.setting('notificationSounds', true);
        ctx.addMessage(ctx.buffer, {
            message: 'loud',
            type: 'privmsg',
        });
        ctx.s.$emit('audio.play', 'startup', ctx.network);
        expect(audio.play).toHaveBeenCalledWith('startup');
        ctx.s.$destroy();
    });

    test('per-buffer Never and do not disturb gate message sounds', () => {
        function fresh() {
            const app = appState.create();
            const net = app.addNetwork('TestNetwork', 'TestNick', {});
            net.nick = 'TestNick';
            const buf = app.addBuffer(net.id, '#test');
            buf.setting('alert_on', 'message');
            app.ui.app_has_focus = false;
            const audio = { play: jest.fn() };
            const manager = new AudioManager(audio);
            manager.watchForMessages(app);
            const send = (message) => app.addMessage(buf, {
                nick: 'OtherUser',
                time: Date.now(),
                message,
                type: 'privmsg',
            });
            return {
                appState: app, buf, audio, send,
            };
        }

        let ctx = fresh();
        ctx.buf.setting('alert_on', 'never');
        ctx.send('quiet');
        expect(ctx.audio.play).not.toHaveBeenCalled();

        ctx = fresh();
        ctx.buf.setting('alert_on', 'message');
        ctx.send('loud');
        expect(ctx.audio.play).toHaveBeenCalled();

        ctx = fresh();
        ctx.appState.ui.notifications_enabled = false;
        ctx.send('quiet');
        expect(ctx.audio.play).not.toHaveBeenCalled();

        ctx = fresh();
        ctx.appState.ui.notifications_enabled = true;
        ctx.send('loud');
        expect(ctx.audio.play).toHaveBeenCalled();
    });

    test('traffic and server activity follow the alert level', () => {
        s.setting('buffers.traffic_as_activity', true);
        addMessage(buffer, {
            message: 'OtherUser joined',
            type: 'traffic',
        });
        expect(notifications).toHaveLength(1);

        buffer.setting('alert_on', 'highlight');
        addMessage(buffer, {
            message: 'OtherUser left',
            type: 'traffic',
        });
        expect(notifications).toHaveLength(1);

        s.setting('buffers.server_as_activity', true);
        const server = network.serverBuffer();
        server.setting('alert_on', 'message');
        addMessage(server, {
            message: 'server message',
            type: 'notice',
        });
        expect(notifications).toHaveLength(2);
    });
});

describe('CTCP notifications', () => {
    let s;
    let network;
    let buffer;
    let notifications;
    let titleFlashes;

    beforeEach(() => {
        s = appState.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.nick = 'TestNick';
        buffer = network.serverBuffer();
        buffer.setting('alert_on', 'message');
        buffer.setting('flash_title', 'message');
        s.setting('buffers.server_as_activity', true);
        s.ui.app_has_focus = false;

        notifications = [];
        titleFlashes = [];
        s.$on('notification.show', (message, opts) => {
            notifications.push({ message, opts });
        });
        s.$on('notification.title', () => {
            titleFlashes.push(true);
        });
    });

    it('ignores CTCP messages but notifies for normal ones', () => {
        s.addMessage(buffer, {
            nick: '',
            message: '[CTCP Other reply] TIME Fri Oct 30 12:00:00 2026',
            type: 'ctcp',
            time: Date.now(),
        });

        expect(notifications).toHaveLength(0);
        expect(titleFlashes).toHaveLength(0);
        expect(buffer.flags.unread || 0).toBe(0);

        s.addMessage(buffer, {
            nick: 'Other',
            message: 'hello',
            type: 'notice',
            time: Date.now(),
        });

        expect(notifications).toHaveLength(1);
        expect(titleFlashes).toHaveLength(1);
        expect(buffer.flags.unread).toBe(1);
    });

    it('does not play an alert sound for CTCP messages', () => {
        const audio = { play: jest.fn() };
        const manager = new AudioManager(audio);
        manager.watchForMessages(s);

        s.addMessage(buffer, {
            nick: '',
            message: '[CTCP Other reply] TIME Fri Oct 30 12:00:00 2026',
            type: 'ctcp',
            time: Date.now(),
        });
        expect(audio.play).not.toHaveBeenCalled();

        s.addMessage(buffer, {
            nick: 'Other',
            message: 'hello',
            type: 'notice',
            time: Date.now(),
        });
        expect(audio.play).toHaveBeenCalledWith('message');
    });
});
