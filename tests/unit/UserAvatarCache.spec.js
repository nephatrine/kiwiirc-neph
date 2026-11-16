import Vue from 'vue';
import UserAvatar from '@/components/UserAvatar';
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

        expect(vm.$el.querySelector('image')).toBeNull();

        jest.advanceTimersByTime(100);
        expect(images).toHaveLength(1);

        images[0].onload();
        await Vue.nextTick();

        const image = vm.$el.querySelector('image');
        expect(image).not.toBeNull();
        expect(image.getAttribute('href')).toBe('https://example.com/alice.svg');

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

        expect(second.$el.querySelector('image')).not.toBeNull();
        expect(images).toHaveLength(1);

        second.$destroy();
    });

    test('does not retry a failed fallback after remounting', async() => {
        const first = mountAvatar('Alice');
        await Vue.nextTick();
        jest.advanceTimersByTime(100);
        images[0].onerror();
        await Vue.nextTick();
        expect(first.$el.querySelector('image')).toBeNull();
        first.$destroy();

        const second = mountAvatar('Alice');
        await Vue.nextTick();
        jest.advanceTimersByTime(100);

        expect(second.$el.querySelector('image')).toBeNull();
        expect(images).toHaveLength(1);

        second.$destroy();
    });
});
