const {
    createTrayService,
    formatOverlayDescription,
    formatTrayTooltip,
    normalizeBadgeSummary,
} = require('../../desktop/electron/tray');

class FakeTray {
    static instances = [];
    static fail = false;

    constructor(image) {
        if (FakeTray.fail) {
            throw new Error('tray unavailable');
        }
        this.image = image;
        this.tooltip = '';
        this.menu = null;
        this.handlers = {};
        this.destroyed = false;
        FakeTray.instances.push(this);
    }

    setToolTip(tooltip) {
        this.tooltip = tooltip;
    }

    setContextMenu(menu) {
        this.menu = menu;
    }

    on(event, handler) {
        this.handlers[event] = handler;
    }

    destroy() {
        this.destroyed = true;
    }
}

function makeWindow() {
    let visible = true;
    return {
        isDestroyed: () => false,
        isVisible: () => visible,
        isMinimized: () => false,
        show: jest.fn(() => {
            visible = true;
        }),
        hide: jest.fn(() => {
            visible = false;
        }),
        focus: jest.fn(),
        restore: jest.fn(),
        setOverlayIcon: jest.fn(),
    };
}

function makeService(options = {}) {
    const window = makeWindow();
    const app = {
        setBadgeCount: jest.fn(),
    };
    const menus = [];
    const service = createTrayService({
        app,
        Tray: FakeTray,
        Menu: {
            buildFromTemplate: jest.fn((template) => {
                menus.push(template);
                return template;
            }),
        },
        nativeImage: {
            createFromPath: jest.fn(() => ({
                isEmpty: () => false,
            })),
        },
        getWindow: () => window,
        getSettings: () => ({ closeToTray: true }),
        onChangeCloseToTray: jest.fn(),
        onQuit: jest.fn(),
        trayIconPath: '/tmp/tray.png',
        badgeIconPath: '/tmp/badge.png',
        platform: 'linux',
        ...options,
    });
    return { service, window, app, menus };
}

describe('desktop tray service', () => {
    beforeEach(() => {
        FakeTray.instances = [];
        FakeTray.fail = false;
    });

    it('formats tooltip and overlay text', () => {
        const summary = {
            unread: 1200,
            highlights: 2,
            errors: 1,
        };

        expect(formatTrayTooltip(summary))
            .toBe('Kiwi IRC — 999+ unread, 2 highlights, 1 error');
        expect(formatOverlayDescription(summary))
            .toBe('999+ unread, 2 highlights, 1 error');
        expect(formatTrayTooltip({})).toBe('Kiwi IRC');
    });

    it('normalizes badge summaries', () => {
        expect(normalizeBadgeSummary({
            unread: -1,
            highlights: 2.9,
            errors: '3',
        })).toEqual({
            unread: 0,
            highlights: 2,
            errors: 0,
        });
    });

    it('creates the tray and menu', () => {
        const { service, menus } = makeService();

        expect(service.create()).toBe(true);
        expect(service.isAvailable()).toBe(true);
        expect(FakeTray.instances[0].tooltip).toBe('Kiwi IRC');
        expect(menus).toHaveLength(1);
        expect(menus[0].map((item) => item.label)).toEqual([
            'Hide Kiwi IRC',
            undefined,
            'Close to Tray',
            undefined,
            'Quit Kiwi IRC',
        ]);
    });

    it('adds an update item and opens the release page', () => {
        const onOpenUpdate = jest.fn();
        const { service, menus } = makeService({ onOpenUpdate });
        service.create();

        service.setUpdate({
            updateAvailable: true,
            latestVersion: '2.3.0',
            releaseUrl: 'https://code.nephatrine.net/nephatrine/kiwiirc/releases/tag/v2.3.0',
        });

        const menu = menus[menus.length - 1];
        const updateItem = menu.find((item) => item.label === 'Update Available: 2.3.0');
        expect(updateItem).toBeTruthy();
        updateItem.click();
        expect(onOpenUpdate).toHaveBeenCalledWith({
            latestVersion: '2.3.0',
            releaseUrl: 'https://code.nephatrine.net/nephatrine/kiwiirc/releases/tag/v2.3.0',
        });

        service.setUpdate(null);
        expect(menus[menus.length - 1].map((item) => item.label)).toEqual([
            'Hide Kiwi IRC',
            undefined,
            'Close to Tray',
            undefined,
            'Quit Kiwi IRC',
        ]);
    });

    it('disables close-to-tray when the tray cannot be created', () => {
        FakeTray.fail = true;
        const { service } = makeService();

        expect(service.create()).toBe(false);
        expect(service.isAvailable()).toBe(false);
        expect(service.shouldHideOnClose()).toBe(false);
    });

    it('shows, hides, and toggles the window', () => {
        const { service, window } = makeService();
        service.create();

        service.hideWindow();
        expect(window.hide).toHaveBeenCalled();
        expect(service.shouldHideOnClose()).toBe(true);

        service.showWindow();
        expect(window.show).toHaveBeenCalled();
        expect(window.focus).toHaveBeenCalled();

        service.toggleWindow();
        expect(window.hide).toHaveBeenCalledTimes(2);
    });

    it('updates the OS badge and Windows overlay', () => {
        const window = makeWindow();
        const app = { setBadgeCount: jest.fn() };
        const service = createTrayService({
            app,
            Tray: FakeTray,
            Menu: { buildFromTemplate: jest.fn(() => []) },
            nativeImage: {
                createFromPath: jest.fn(() => ({ isEmpty: () => false })),
            },
            getWindow: () => window,
            getSettings: () => ({ closeToTray: true }),
            trayIconPath: '/tmp/tray.png',
            badgeIconPath: '/tmp/badge.png',
            platform: 'win32',
        });

        service.create();
        service.updateBadge({
            unread: 3,
            highlights: 1,
            errors: 0,
        });

        expect(app.setBadgeCount).toHaveBeenCalledWith(3);
        expect(window.setOverlayIcon).toHaveBeenCalledWith(
            expect.anything(),
            '3 unread, 1 highlight'
        );

        service.updateBadge({ unread: 0, highlights: 0, errors: 0 });
        expect(window.setOverlayIcon).toHaveBeenLastCalledWith(null, '');
    });

    it('destroys the tray', () => {
        const { service } = makeService();
        service.create();
        service.destroy();

        expect(FakeTray.instances[0].destroyed).toBe(true);
        expect(service.isAvailable()).toBe(false);
    });
});
