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
