import SidebarSectionSettings from '@/components/SidebarSectionSettings';
import state from '@/libs/state';

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

    test('does not expose markdown or typing settings', () => {
        expect(SidebarSectionSettings.computed.settingExtraFormatting).toBeUndefined();
        expect(SidebarSectionSettings.computed.settingShareTyping).toBeUndefined();
        expect(SidebarSectionSettings.computed.typingSupported).toBeUndefined();
        expect(SidebarSectionSettings.computed.settingShowJoinParts).toBeUndefined();
        expect(SidebarSectionSettings.computed.settingShowTopics).toBeUndefined();
        expect(SidebarSectionSettings.computed.settingShowNickChanges).toBeUndefined();
        expect(SidebarSectionSettings.computed.settingShowModeChanges).toBeUndefined();
    });

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
