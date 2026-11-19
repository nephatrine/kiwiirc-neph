import {
    avatarLoadState,
    clearAvatarCache,
    markAvatarFailed,
    requestAvatarLoad
} from '@/libs/AvatarCache';

const FAILURE_TTL_MS = 10 * 60 * 1000;

let images;
let originalImage;

class FakeImage {
    constructor() {
        images.push(this);
    }

    set src(value) {
        this.srcValue = value;
    }

    get src() {
        return this.srcValue;
    }
}

describe('avatar cache', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        images = [];
        originalImage = global.Image;
        global.Image = FakeImage;
        clearAvatarCache();
    });

    afterEach(() => {
        clearAvatarCache();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        global.Image = originalImage;
    });

    function start(url) {
        requestAvatarLoad(url);
        jest.advanceTimersByTime(100);
    }

    test('deduplicates in-flight and loaded URLs', () => {
        const url = 'https://example.com/alice.svg';

        start(url);
        expect(images).toHaveLength(1);
        expect(avatarLoadState(url)).toBe('loading');

        requestAvatarLoad(url);
        jest.advanceTimersByTime(100);
        expect(images).toHaveLength(1);

        images[0].onload();
        expect(avatarLoadState(url)).toBe('loaded');

        requestAvatarLoad(url);
        jest.advanceTimersByTime(100);
        expect(images).toHaveLength(1);
    });

    test('spaces avatar starts through the image queue', () => {
        const urls = Array.from({ length: 6 }, (_, index) => (
            `https://example.com/${index}.svg`
        ));

        urls.forEach((url) => requestAvatarLoad(url));
        jest.advanceTimersByTime(400);
        expect(images).toHaveLength(4);

        images[0].onload();
        jest.advanceTimersByTime(100);
        expect(images).toHaveLength(5);
    });

    test('does not retry failures before the TTL, and marks failed URLs', () => {
        const url = 'https://example.com/missing.svg';

        start(url);
        images[0].onerror();
        expect(avatarLoadState(url)).toBe('failed');

        requestAvatarLoad(url);
        jest.advanceTimersByTime(100);
        expect(images).toHaveLength(1);

        jest.advanceTimersByTime(FAILURE_TTL_MS);
        requestAvatarLoad(url);
        jest.advanceTimersByTime(100);
        expect(images).toHaveLength(2);

        const loadedUrl = 'https://example.com/alice.svg';
        start(loadedUrl);
        images[images.length - 1].onload();
        expect(avatarLoadState(loadedUrl)).toBe('loaded');

        markAvatarFailed(loadedUrl);
        expect(avatarLoadState(loadedUrl)).toBe('failed');

        const before = images.length;
        requestAvatarLoad(loadedUrl);
        jest.advanceTimersByTime(100);
        expect(images).toHaveLength(before);

        const pendingUrl = 'https://example.com/pending.svg';
        requestAvatarLoad(pendingUrl);
        jest.advanceTimersByTime(100);
        const pendingImage = images[images.length - 1];
        markAvatarFailed(pendingUrl);
        pendingImage.onload();
        expect(avatarLoadState(pendingUrl)).toBe('failed');
    });

    test('times out stuck loads and clears cached state', () => {
        const url = 'https://example.com/slow.svg';

        start(url);
        jest.advanceTimersByTime(15 * 1000);
        expect(avatarLoadState(url)).toBe('failed');

        clearAvatarCache();
        expect(avatarLoadState(url)).toBe('idle');
    });
});
