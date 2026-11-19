import Vue from 'vue';
import UserState from '@/libs/state/UserState';
import SidebarState from '@/components/SidebarState';

function makeSidebar(activeBuffer) {
    Vue.prototype.listen = () => {};
    Vue.prototype.$state = {
        setting: () => false,
        ui: { app_width: 1024 },
        getActiveBuffer: () => activeBuffer,
    };
    let sidebar = new SidebarState();
    sidebar.sidebarOpen = true;
    sidebar.sidebarSection = 'user';
    return sidebar;
}

function channelBuffer(hasNick) {
    return {
        id: 1,
        isQuery: () => false,
        isChannel: () => true,
        hasNick: () => hasNick,
    };
}

describe('draft/relaymsg', () => {
    test('keeps the relayer nick on the spoofed user', () => {
        let user = new UserState(1, {
            nick: 'x2Tuff4Ux/bridged',
            relayed_by: 'DiscordBot',
        });
        expect(user.nick).toBe('x2Tuff4Ux/bridged');
        expect(user.relayed_by).toBe('DiscordBot');

        user = new UserState(1, { nick: 'Someone' });
        expect(user.relayed_by).toBe('');
    });

    test('keeps the user section while relaying and falls back to the nicklist', () => {
        let sidebar = makeSidebar(channelBuffer(false));
        sidebar.sidebarUser = { nick: 'x2Tuff4Ux/bridged', relayed_by: 'DiscordBot' };
        expect(sidebar.section()).toBe('user');
        expect(sidebar.sidebarSection).toBe('user');

        sidebar = makeSidebar(channelBuffer(false));
        sidebar.sidebarUser = { nick: 'Someone', relayed_by: '' };
        expect(sidebar.section()).toBe('nicklist');

        sidebar = makeSidebar(channelBuffer(true));
        sidebar.sidebarUser = { nick: 'Someone', relayed_by: '' };
        expect(sidebar.section()).toBe('user');
    });
});
