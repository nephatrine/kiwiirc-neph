import StateBrowser from '@/components/StateBrowser';
import StateBrowserUsermenu from '@/components/StateBrowserUsermenu';

describe('StateBrowser notification toggle', () => {
    test('defaults to enabled', () => {
        const context = {
            $state: {
                ui: {},
            },
        };

        expect(StateBrowser.computed.notificationsEnabled.call(context)).toBe(true);
    });

    test('toggles the global notification pause state', () => {
        const ui = {
            notifications_enabled: true,
        };
        const context = {
            $state: {
                ui,
            },
            notificationsEnabled: true,
        };

        StateBrowser.methods.toggleNotifications.call(context);

        expect(ui.notifications_enabled).toBe(false);
    });

    test('user menu emits its open state', () => {
        const emit = jest.fn();

        StateBrowserUsermenu.watch.is_usermenu_open.call({ $emit: emit }, true);

        expect(emit).toHaveBeenCalledWith('toggle', true);
    });
});
