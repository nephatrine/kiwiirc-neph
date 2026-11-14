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

    it('uses the native bridge and routes click callbacks', () => {
        const bridge = makeNativeBridge();
        const Notifications = loadNotifications();
        const state = makeState();
        const onclick = jest.fn();

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

        const id = bridge.show.mock.calls[0][0].id;
        bridge.emitClick(id);

        expect(onclick).toHaveBeenCalledTimes(1);
    });

    it('drops native click callbacks when a notification closes', () => {
        const bridge = makeNativeBridge();
        const Notifications = loadNotifications();
        const state = makeState();
        const onclick = jest.fn();

        Notifications.listenForNewMessages(state);
        notificationHandler(state)('hello', {
            title: 'Title',
            onclick,
            force: true,
        });

        const id = bridge.show.mock.calls[0][0].id;
        bridge.emitClose(id);
        bridge.emitClick(id);

        expect(onclick).not.toHaveBeenCalled();
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

    it('falls back to browser notifications and attaches onclick', () => {
        delete window.kiwiDesktop;

        class WebNotification {
            static permission = 'granted';
            static requestPermission = jest.fn();
            static instances = [];

            constructor(title, options) {
                this.title = title;
                this.options = options;
                this.close = jest.fn();
                WebNotification.instances.push(this);
            }
        }
        window.Notification = WebNotification;

        const Notifications = loadNotifications();
        const state = makeState();
        const onclick = jest.fn();

        Notifications.listenForNewMessages(state);
        notificationHandler(state)('hello', {
            title: 'Title',
            onclick,
            force: true,
        });

        expect(WebNotification.instances).toHaveLength(1);
        expect(WebNotification.instances[0].title).toBe('Title');
        expect(WebNotification.instances[0].onclick).toBe(onclick);
    });

    it('closes browser notifications after their TTL', () => {
        delete window.kiwiDesktop;

        class WebNotification {
            static permission = 'granted';
            static requestPermission = jest.fn();
            static instances = [];

            constructor(title, options) {
                this.title = title;
                this.options = options;
                this.close = jest.fn();
                WebNotification.instances.push(this);
            }
        }
        window.Notification = WebNotification;

        const Notifications = loadNotifications();
        const state = makeState();

        Notifications.listenForNewMessages(state);
        notificationHandler(state)('hello', {
            title: 'Title',
            ttl: 1000,
            force: true,
        });

        jest.advanceTimersByTime(1000);

        expect(WebNotification.instances[0].close).toHaveBeenCalled();
    });
});
