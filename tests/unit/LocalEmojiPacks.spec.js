import getState from '@/libs/state';
import {
    getInstalledEmojiPackages,
    getLocalEmojiPacks,
    localEmojiPackState,
    refreshLocalEmojiPacks,
    setLocalEmojiPacks
} from '@/libs/LocalEmojiPacks';

function makePackage(overrides = {}) {
    return {
        id: 'kiwi-pack-abcd1234',
        name: 'Kiwi Pack',
        installedAt: 10,
        packs: [{
            id: 'kiwi',
            name: 'Kiwi Pack',
            description: 'Local kiwi emoji',
            authors: ['Kiwi'],
            homepage: 'https://example.com/kiwi',
            supported: true,
            emoji: {
                kiwi: {
                    url: 'kiwi-emoji://kiwi-pack-abcd1234/images/kiwi.png',
                    alt: 'kiwi bird',
                },
            },
        }],
        ...overrides,
    };
}

describe('local emoji packs', () => {
    let state;

    beforeEach(() => {
        state = getState();
        state.resetState();
        setLocalEmojiPacks([]);
    });

    afterEach(() => {
        setLocalEmojiPacks([]);
        state.resetState();
        delete window.kiwiDesktop;
    });

    test('flattens installed packages into renderer packs', () => {
        setLocalEmojiPacks([makePackage()]);

        expect(getInstalledEmojiPackages()).toHaveLength(1);
        expect(getInstalledEmojiPackages()[0]).toMatchObject({
            id: 'kiwi-pack-abcd1234',
            name: 'Kiwi Pack',
        });

        const packs = getLocalEmojiPacks();
        expect(packs).toHaveLength(1);
        expect(packs[0]).toMatchObject({
            id: 'kiwi',
            name: 'Kiwi Pack',
            desktopEmojiPackId: 'kiwi-pack-abcd1234',
            supported: true,
        });
        expect(packs[0].emoji.kiwi).toEqual({
            url: 'kiwi-emoji://kiwi-pack-abcd1234/images/kiwi.png',
            alt: 'kiwi bird',
        });
    });

    test('sorts newer packages last and drops unusable entries', () => {
        setLocalEmojiPacks([
            makePackage({ id: 'older', installedAt: 1 }),
            makePackage({
                id: 'newer',
                installedAt: 2,
                packs: [{
                    id: 'newer-pack',
                    name: 'Newer Pack',
                    emoji: {
                        kiwi: {
                            url: 'https://example.com/newer.png',
                            alt: '',
                        },
                        bad: {
                            url: 'file:///tmp/bad.png',
                        },
                    },
                }],
            }),
        ]);

        expect(getInstalledEmojiPackages().map((pkg) => pkg.id))
            .toEqual(['older', 'newer']);
        expect(getLocalEmojiPacks().map((pack) => pack.id))
            .toEqual(['kiwi', 'newer-pack']);
        expect(getLocalEmojiPacks()[1].emoji.bad).toBeUndefined();
    });

    test('emits an event whenever the installed list changes', () => {
        const listener = jest.fn();
        state.$on('emoji.local-packs', listener);

        setLocalEmojiPacks([makePackage()]);
        setLocalEmojiPacks([]);

        expect(listener).toHaveBeenCalledTimes(2);
        expect(localEmojiPackState.packs).toEqual([]);
    });

    test('refreshes from the desktop bridge', async() => {
        const list = jest.fn(() => Promise.resolve([makePackage()]));
        window.kiwiDesktop = {
            emojiPacks: {
                list,
                install: jest.fn(),
                uninstall: jest.fn(),
            },
        };

        await refreshLocalEmojiPacks();

        expect(list).toHaveBeenCalledTimes(1);
        expect(getLocalEmojiPacks()).toHaveLength(1);
    });
});
