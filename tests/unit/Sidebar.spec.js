import Sidebar from '@/components/Sidebar';
import StateBrowser from '@/components/StateBrowser';
import StateBrowserUsermenu from '@/components/StateBrowserUsermenu';
import SidebarSectionSettings from '@/components/SidebarSectionSettings';
import state from '@/libs/state';

function clickEvent(handle) {
    return {
        target: {
            closest: jest.fn(() => handle),
        },
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
    };
}

describe('Sidebar link handles', () => {
    it('opens a previewable link handle in the pinned media viewer', () => {
        let emit = jest.fn();
        let handle = {
            getAttribute: jest.fn(() => 'https://example.com/image.jpg'),
        };
        let event = clickEvent(handle);

        Sidebar.methods.onSidebarClick.call({
            $state: {
                $emit: emit,
            },
        }, event);

        expect(event.target.closest).toHaveBeenCalledWith('a[data-url]');
        expect(emit).toHaveBeenCalledWith(
            'mediaviewer.show',
            'https://example.com/image.jpg'
        );
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('ignores a link-only handle', () => {
        let emit = jest.fn();
        let handle = {
            getAttribute: jest.fn(() => 'https://example.com/article'),
        };
        let event = clickEvent(handle);

        Sidebar.methods.onSidebarClick.call({
            $state: {
                $emit: emit,
            },
        }, event);

        expect(emit).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });

    it('leaves normal sidebar links alone', () => {
        let emit = jest.fn();
        let event = clickEvent(null);

        Sidebar.methods.onSidebarClick.call({ $state: { $emit: emit } }, event);

        expect(emit).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });

    it('ignores link handles without a URL', () => {
        let emit = jest.fn();
        let handle = {
            getAttribute: jest.fn(() => ''),
        };
        let event = clickEvent(handle);

        Sidebar.methods.onSidebarClick.call({ $state: { $emit: emit } }, event);

        expect(emit).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });
});

describe('StateBrowser notification toggle', () => {
    test('defaults to enabled and toggles the global pause state', () => {
        const ui = {};
        const context = {
            $state: { ui },
        };

        expect(StateBrowser.computed.notificationsEnabled.call(context)).toBe(true);

        context.notificationsEnabled = true;
        StateBrowser.methods.toggleNotifications.call(context);

        expect(ui.notifications_enabled).toBe(false);
    });

    test('user menu emits its open state', () => {
        const emit = jest.fn();

        StateBrowserUsermenu.watch.is_usermenu_open.call({ $emit: emit }, true);

        expect(emit).toHaveBeenCalledWith('toggle', true);
    });
});

describe('per-buffer sidebar settings', () => {
    let s;
    let network;
    let buffer;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        buffer = s.addBuffer(network.id, '#test');
    });

    afterEach(() => {
        s.$destroy();
    });

    function context() {
        return {
            buffer,
            $delete: (target, key) => s.$delete(target, key),
        };
    }

    test('shows channel settings only for channel operators', () => {
        expect(SidebarSectionSettings.computed.channelSettingsVisible.call({
            buffer: { isChannel: () => true },
            areWeAnOp: true,
        })).toBe(true);

        expect(SidebarSectionSettings.computed.channelSettingsVisible.call({
            buffer: { isChannel: () => true },
            areWeAnOp: false,
        })).toBe(false);

        expect(SidebarSectionSettings.computed.channelSettingsVisible.call({
            buffer: { isChannel: () => false },
            areWeAnOp: true,
        })).toBe(false);
    });

    test('reads and writes the per-buffer unread badge policy', () => {
        expect(SidebarSectionSettings.computed.settingUnreadBadge.get.call(context()))
            .toBe('default');

        SidebarSectionSettings.computed.settingUnreadBadge.set.call(context(), 'hide');
        expect(buffer.settings.unread_badge).toBe('hide');
        expect(SidebarSectionSettings.computed.settingUnreadBadge.get.call(context()))
            .toBe('hide');

        SidebarSectionSettings.computed.settingUnreadBadge.set.call(context(), 'show');
        expect(buffer.settings.unread_badge).toBe('show');

        SidebarSectionSettings.computed.settingUnreadBadge.set.call(context(), 'default');
        expect(buffer.settings.unread_badge).toBeUndefined();
    });

    test('favoriting clears a Never notification override', () => {
        buffer.setting('alert_on', 'never');

        SidebarSectionSettings.computed.settingFavorite.set.call(context(), true);

        expect(buffer.settings.alert_on).toBeUndefined();
        expect(buffer.setting('favorite')).toBe(true);
        expect(SidebarSectionSettings.computed.notificationNever.call(context()))
            .toBe(false);
    });

    test('reports Never notification state from buffer settings', () => {
        expect(SidebarSectionSettings.computed.notificationNever.call(context()))
            .toBe(false);

        buffer.setting('alert_on', 'never');

        expect(SidebarSectionSettings.computed.notificationNever.call(context()))
            .toBe(true);
        expect(SidebarSectionSettings.computed.favoriteDisabledHint.call({
            notificationNever: true,
            $t: (key) => key,
        })).toBe('settings_favorite_disabled_hint');
        expect(SidebarSectionSettings.computed.favoriteDisabledHint.call({
            notificationNever: false,
            $t: (key) => key,
        })).toBeNull();
    });
});
