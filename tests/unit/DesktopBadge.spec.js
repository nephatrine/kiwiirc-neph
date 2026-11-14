import { listenForUnread } from '@/libs/DesktopBadge';
import * as DesktopTray from '@/libs/desktop/Tray';

jest.mock('@/libs/desktop/Tray', () => ({
    isAvailable: jest.fn(() => true),
    setBadge: jest.fn(),
}));

function makeBuffer(unread, highlight = false) {
    return {
        flags: {
            unread,
            highlight,
            error: false,
        },
        isSpecial: () => false,
        setting: () => false,
    };
}

describe('desktop unread badge', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        DesktopTray.setBadge.mockClear();
        DesktopTray.isAvailable.mockReturnValue(true);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('sends the initial summary and updates on changes', () => {
        const state = {
            networks: [{
                buffers: [makeBuffer(2)],
            }],
            $watch: jest.fn(),
        };

        listenForUnread(state);

        expect(DesktopTray.setBadge).toHaveBeenCalledWith({
            unread: 2,
            highlights: 0,
            errors: 0,
        });

        const watcher = state.$watch.mock.calls[0][0];
        const callback = state.$watch.mock.calls[0][1];
        state.networks[0].buffers[0].flags.unread = 4;

        callback(watcher());
        jest.advanceTimersByTime(250);

        expect(DesktopTray.setBadge).toHaveBeenLastCalledWith({
            unread: 4,
            highlights: 0,
            errors: 0,
        });
    });

    it('does nothing when the tray is unavailable', () => {
        DesktopTray.isAvailable.mockReturnValue(false);
        const state = {
            networks: [],
            $watch: jest.fn(),
        };

        listenForUnread(state);

        expect(DesktopTray.setBadge).not.toHaveBeenCalled();
        expect(state.$watch).not.toHaveBeenCalled();
    });
});
