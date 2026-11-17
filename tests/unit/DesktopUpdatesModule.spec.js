import * as DesktopUpdates from '@/libs/desktop/Updates';

describe('desktop update bridge adapter', () => {
    afterEach(() => {
        delete window.kiwiDesktop;
    });

    it('reports unavailable without a desktop bridge', async() => {
        expect(DesktopUpdates.isAvailable()).toBe(false);
        expect(DesktopUpdates.currentVersion()).toBe('');
        await expect(DesktopUpdates.check())
            .rejects.toThrow('desktop update checks are unavailable');
        await expect(DesktopUpdates.status()).resolves.toBe(null);
        expect(DesktopUpdates.onStatus(() => {})()).toBeUndefined();
    });

    it('uses the exposed update bridge', async() => {
        const check = jest.fn(() => Promise.resolve({ updateAvailable: true }));
        const status = jest.fn(() => Promise.resolve({ updateAvailable: false }));
        const onStatus = jest.fn(() => jest.fn());
        window.kiwiDesktop = {
            version: '2.2.0',
            updates: {
                check,
                status,
                onStatus,
            },
        };

        expect(DesktopUpdates.isAvailable()).toBe(true);
        expect(DesktopUpdates.currentVersion()).toBe('2.2.0');
        await expect(DesktopUpdates.check()).resolves.toEqual({ updateAvailable: true });
        await expect(DesktopUpdates.status()).resolves.toEqual({ updateAvailable: false });

        const handler = jest.fn();
        const remove = DesktopUpdates.onStatus(handler);
        expect(onStatus).toHaveBeenCalledWith(handler);
        expect(typeof remove).toBe('function');
    });
});
