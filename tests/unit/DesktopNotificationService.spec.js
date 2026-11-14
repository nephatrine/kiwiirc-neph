const {
    createNotificationService,
    normalizeNotificationPayload,
} = require('../../desktop/electron/notifications');

class FakeNotification {
    static instances = [];
    static supported = true;

    static isSupported() {
        return FakeNotification.supported;
    }

    constructor(options) {
        this.options = options;
        this.handlers = {};
        this.shown = false;
        this.closed = false;
        FakeNotification.instances.push(this);
    }

    on(event, handler) {
        this.handlers[event] = handler;
    }

    show() {
        this.shown = true;
    }

    close() {
        this.closed = true;
        if (this.handlers.close) {
            this.handlers.close();
        }
    }

    emit(event) {
        if (this.handlers[event]) {
            this.handlers[event]();
        }
    }
}

function makeWindow() {
    return {
        isDestroyed: () => false,
        isMinimized: () => true,
        restore: jest.fn(),
        show: jest.fn(),
        focus: jest.fn(),
    };
}

function makeService(options = {}) {
    return createNotificationService({
        Notification: FakeNotification,
        getWindow: () => makeWindow(),
        onActivate: jest.fn(),
        onClose: jest.fn(),
        ...options,
    });
}

describe('desktop notification service', () => {
    beforeEach(() => {
        FakeNotification.instances = [];
        FakeNotification.supported = true;
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('normalizes valid notification payloads', () => {
        expect(normalizeNotificationPayload({
            id: ' n1 ',
            title: ' Title ',
            body: ' Body ',
            tag: ' tag ',
            ttl: 2500,
        })).toEqual({
            id: 'n1',
            title: 'Title',
            body: 'Body',
            tag: 'tag',
            ttl: 2500,
        });
    });

    it('rejects invalid notification payloads', () => {
        expect(normalizeNotificationPayload(null)).toBeNull();
        expect(normalizeNotificationPayload({ id: '', title: 'Title', body: 'Body' }))
            .toBeNull();
        expect(normalizeNotificationPayload({ id: 'n1', title: '', body: 'Body' }))
            .toBeNull();
        expect(normalizeNotificationPayload({ id: 'n1', title: 'Title', body: '' }))
            .toBeNull();
    });

    it('shows a notification and focuses the window when clicked', () => {
        const window = makeWindow();
        const onActivate = jest.fn();
        const onClose = jest.fn();
        const service = createNotificationService({
            Notification: FakeNotification,
            getWindow: () => window,
            onActivate,
            onClose,
        });

        expect(service.show({
            id: 'n1',
            title: 'Title',
            body: 'Body',
        })).toEqual({ shown: true, id: 'n1' });

        const notification = FakeNotification.instances[0];
        expect(notification.options).toEqual({
            title: 'Title',
            body: 'Body',
        });
        expect(notification.shown).toBe(true);

        notification.emit('click');

        expect(window.restore).toHaveBeenCalled();
        expect(window.show).toHaveBeenCalled();
        expect(window.focus).toHaveBeenCalled();
        expect(onActivate).toHaveBeenCalledWith('n1');
        expect(onClose).toHaveBeenCalledWith('n1', 'click');
    });

    it('replaces an existing notification with the same tag', () => {
        const onClose = jest.fn();
        const service = makeService({ onClose });

        service.show({ id: 'n1', title: 'One', body: 'Body', tag: 'tag' });
        service.show({ id: 'n2', title: 'Two', body: 'Body', tag: 'tag' });

        expect(FakeNotification.instances[0].closed).toBe(true);
        expect(FakeNotification.instances[1].closed).toBe(false);
        expect(onClose).toHaveBeenCalledWith('n1', 'replaced');
    });

    it('closes a notification after its TTL', () => {
        const onClose = jest.fn();
        const service = makeService({ onClose });

        service.show({
            id: 'n1',
            title: 'Title',
            body: 'Body',
            ttl: 1000,
        });

        jest.advanceTimersByTime(1000);

        expect(FakeNotification.instances[0].closed).toBe(true);
        expect(onClose).toHaveBeenCalledWith('n1', 'ttl');
    });

    it('reports unsupported notifications without creating one', () => {
        FakeNotification.supported = false;
        const service = makeService();

        expect(service.show({ id: 'n1', title: 'Title', body: 'Body' }))
            .toEqual({ shown: false, reason: 'unsupported' });
        expect(FakeNotification.instances).toHaveLength(0);
    });

    it('closes all active notifications', () => {
        const service = makeService();

        service.show({ id: 'n1', title: 'One', body: 'Body' });
        service.show({ id: 'n2', title: 'Two', body: 'Body' });
        service.closeAll();

        expect(FakeNotification.instances[0].closed).toBe(true);
        expect(FakeNotification.instances[1].closed).toBe(true);
    });
});
