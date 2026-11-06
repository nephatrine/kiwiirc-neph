import {
    get,
    isAvailable,
    set
} from '@/libs/storage/Desktop';

describe('Desktop storage adapter', () => {
    afterEach(() => {
        delete window.kiwiDesktop;
    });

    it('is unavailable without a desktop bridge', async() => {
        expect(isAvailable()).toBe(false);
        expect(await get('kiwi-state')).toBe(null);
    });

    it('delegates to the desktop storage bridge', async() => {
        const storage = {
            get: jest.fn(async() => '{"networks":[]}'),
            set: jest.fn(async() => {}),
        };
        window.kiwiDesktop = { storage };

        expect(isAvailable()).toBe(true);
        expect(await get('kiwi-state')).toBe('{"networks":[]}');
        await set('kiwi-state', '{"networks":[1]}');

        expect(storage.get).toHaveBeenCalledWith('kiwi-state');
        expect(storage.set).toHaveBeenCalledWith('kiwi-state', '{"networks":[1]}');
    });
});
