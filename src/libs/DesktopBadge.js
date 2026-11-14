import { throttle } from '@/helpers/Async';
import { unreadSummary } from '@/helpers/UnreadSummary';
import * as DesktopTray from '@/libs/desktop/Tray';

export function listenForUnread(state) {
    if (!DesktopTray.isAvailable()) {
        return;
    }

    const update = throttle((summary) => {
        DesktopTray.setBadge(summary);
    }, 250);

    update(unreadSummary(state));
    state.$watch(() => unreadSummary(state), (summary) => {
        update(summary);
    });
}
