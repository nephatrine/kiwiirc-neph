import Vue from 'vue';
import UserAvatar from '@/components/UserAvatar';
import UserAvatarCommon, { getAvatarStatusPoint } from '@/components/UserAvatarCommon';
import ThemeManager from '@/libs/ThemeManager';
import getState from '@/libs/state';
import { clearAvatarCache } from '@/libs/AvatarCache';

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

function mountAvatar(nick) {
    return new Vue({
        render: (h) => h(UserAvatar, {
            props: {
                message: { nick },
            },
        }),
    }).$mount();
}

describe('user avatar fallback cache', () => {
    let state;

    beforeEach(() => {
        jest.useFakeTimers();
        images = [];
        originalImage = global.Image;
        global.Image = FakeImage;
        clearAvatarCache();

        state = getState();
        ThemeManager.instance(state);
        state.setting('avatars.fallback_style', 'custom');
        state.setting(
            'avatars.fallback_avatar_url',
            'https://example.com/{nickname}.svg'
        );
    });

    afterEach(() => {
        clearAvatarCache();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        global.Image = originalImage;

        state.setting(
            'avatars.fallback_style',
            state.getSetting('settings.avatars.fallback_style')
        );
        state.setting(
            'avatars.fallback_avatar_url',
            state.getSetting('settings.avatars.fallback_avatar_url')
        );
    });

    test('shows the local fallback until the shared remote load completes', async() => {
        const vm = mountAvatar('Alice');
        await Vue.nextTick();

        expect(vm.$el.querySelector('img')).toBeNull();

        jest.advanceTimersByTime(100);
        expect(images).toHaveLength(1);

        images[0].onload();
        await Vue.nextTick();

        const image = vm.$el.querySelector('img');
        expect(image).not.toBeNull();
        expect(image.getAttribute('src')).toBe('https://example.com/alice.svg');

        vm.$destroy();
    });

    test('reuses a loaded fallback without another request', async() => {
        const first = mountAvatar('Alice');
        await Vue.nextTick();
        jest.advanceTimersByTime(100);
        images[0].onload();
        await Vue.nextTick();
        first.$destroy();

        const second = mountAvatar('Alice');
        await Vue.nextTick();

        expect(second.$el.querySelector('img')).not.toBeNull();
        expect(images).toHaveLength(1);

        second.$destroy();
    });

    test('does not retry a failed fallback after remounting', async() => {
        const first = mountAvatar('Alice');
        await Vue.nextTick();
        jest.advanceTimersByTime(100);
        images[0].onerror();
        await Vue.nextTick();
        expect(first.$el.querySelector('img')).toBeNull();
        first.$destroy();

        const second = mountAvatar('Alice');
        await Vue.nextTick();
        jest.advanceTimersByTime(100);

        expect(second.$el.querySelector('img')).toBeNull();
        expect(images).toHaveLength(1);

        second.$destroy();
    });

    test('does not defer the avatar image with lazy loading', async() => {
        const vm = mountAvatar('Alice');
        await Vue.nextTick();
        jest.advanceTimersByTime(100);
        images[0].onload();
        await Vue.nextTick();

        const image = vm.$el.querySelector('img');
        expect(image).not.toBeNull();
        expect(image.hasAttribute('loading')).toBe(false);

        vm.$destroy();
    });

    test('hosts the avatar image outside the SVG layout path', async() => {
        const vm = mountAvatar('Alice');
        await Vue.nextTick();
        jest.advanceTimersByTime(100);
        images[0].onload();
        await Vue.nextTick();

        const image = vm.$el.querySelector('img');
        expect(image.closest('svg')).toBeNull();
        expect(image.parentNode.classList.contains('kiwi-avatar-frame')).toBe(true);
        expect(image.parentNode.style.backgroundColor).not.toBe('');

        vm.$destroy();
    });

    test('keeps the same root element when the avatar image arrives', async() => {
        const vm = mountAvatar('Alice');
        await Vue.nextTick();

        const root = vm.$el;
        expect(root.tagName).toBe('SPAN');
        expect(root.classList.contains('kiwi-avatar')).toBe(true);
        expect(root.querySelector('.kiwi-avatar-svg')).not.toBeNull();

        jest.advanceTimersByTime(100);
        images[0].onload();
        await Vue.nextTick();

        // A replaced root loses the parent layout's scoped CSS attribute, which
        // sizes the avatar.
        expect(vm.$el).toBe(root);
        expect(root.querySelector('.kiwi-avatar-svg')).toBeNull();
        expect(root.querySelector('img')).not.toBeNull();

        vm.$destroy();
    });
});

describe('shared avatar definitions', () => {
    test('gives the status mask explicit user-space geometry', () => {
        const vm = new Vue({
            render: (h) => h(UserAvatarCommon),
        }).$mount();
        const mask = vm.$el.querySelector('mask');

        expect(mask).not.toBeNull();
        expect(mask.getAttribute('maskUnits')).toBe('userSpaceOnUse');
        expect(mask.getAttribute('x')).toBe('-10');
        expect(mask.getAttribute('y')).toBe('-10');
        expect(mask.getAttribute('width')).toBe('120');
        expect(mask.getAttribute('height')).toBe('120');

        vm.$destroy();
    });
});

describe('avatar status position', () => {
    test('maps each setting to the corner the SVG circle rotates to', () => {
        const state = getState();
        const original = state.getSetting('settings.avatars.away_status_position');
        const expected = [
            [85.355, 14.645],
            [85.355, 85.355],
            [14.645, 85.355],
            [14.645, 14.645],
        ];

        expected.forEach(([x, y], index) => {
            state.setting('avatars.away_status_position', index + 1);
            const point = getAvatarStatusPoint();

            expect(point.x).toBeCloseTo(x, 2);
            expect(point.y).toBeCloseTo(y, 2);
        });

        state.setting('avatars.away_status_position', original);
    });
});
