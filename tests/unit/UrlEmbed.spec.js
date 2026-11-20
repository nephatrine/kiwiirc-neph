import Vue from 'vue';
import UrlEmbed from '@/components/UrlEmbed';
import { clearPreviewFailures, isPreviewFailed } from '@/helpers/Misc';
import { resolveLinkPreview } from '@/libs/LinkPreview';
import { resolvePagePreview } from '@/libs/PagePreview';

jest.mock('@/libs/LinkPreview', () => ({
    resolveEmbedFallback: jest.fn(),
    resolveLinkPreview: jest.fn(),
}));

jest.mock('@/libs/PagePreview', () => ({
    ...jest.requireActual('@/libs/PagePreview'),
    resolvePagePreview: jest.fn(),
}));

jest.mock('@/libs/ThemeManager', () => ({
    __esModule: true,
    default: {
        instance: () => ({
            themeMode: () => 'light',
        }),
    },
}));

let testState;

Vue.mixin({
    computed: {
        $state() {
            return testState;
        },
    },
    methods: {
        $t(key) {
            return key;
        },
        listen() {},
    },
});

function mountEmbed(url) {
    const vm = new Vue({
        render: (h) => h(UrlEmbed, {
            props: { url },
        }),
    }).$mount();

    return vm.$children[0];
}

async function flush() {
    await Promise.resolve();
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
    await Promise.resolve();
}

describe('UrlEmbed preview failures', () => {
    beforeEach(() => {
        window.kiwiDesktop = {};
        testState = {
            $emit: jest.fn(),
            $on: jest.fn(),
            $off: jest.fn(),
        };
        clearPreviewFailures();
        resolveLinkPreview.mockReset();
        resolvePagePreview.mockReset();
    });

    afterEach(() => {
        clearPreviewFailures();
        delete window.kiwiDesktop;
    });

    it('marks failed metadata previews and closes the embed', async() => {
        const url = 'https://example.com/article';
        resolvePagePreview.mockRejectedValue(new Error('not available'));

        const embed = mountEmbed(url);
        const closed = jest.fn();
        embed.$on('close', closed);
        await flush();
        await embed.$nextTick();

        expect(resolvePagePreview).toHaveBeenCalledWith(url);
        expect(isPreviewFailed(url)).toBe(true);
        expect(testState.$emit).toHaveBeenCalledWith('link-preview.failed', url);
        expect(closed).toHaveBeenCalled();
    });

    it('marks failed oEmbed previews and closes the embed', async() => {
        const url = 'https://www.flickr.com/photos/user/12345';
        resolveLinkPreview.mockRejectedValue(new Error('not available'));

        const embed = mountEmbed(url);
        const closed = jest.fn();
        embed.$on('close', closed);
        await flush();
        await embed.$nextTick();

        expect(resolveLinkPreview).toHaveBeenCalledWith(url);
        expect(isPreviewFailed(url)).toBe(true);
        expect(testState.$emit).toHaveBeenCalledWith('link-preview.failed', url);
        expect(closed).toHaveBeenCalled();
    });
});
