import Vue from 'vue';
import state from '@/libs/state';
import BridgeCard from '@/components/BridgeCard';
import { isBridgeCardText, isPreviewCard, parseBridgeCard } from '@/helpers/BridgeCard';

describe('bridge card parsing', () => {
    test('parses a preview card with all supported labels', () => {
        const card = parseBridgeCard([
            '[PREVIEW]',
            'Author: Alice',
            'Title: A title',
            'Field: First: one',
            'Field: Second: two: three',
            'Thumbnail: https://cdn.example/thumb.png',
            'Footer: A footer',
            'Body line one',
            'Body line two',
        ].join('\n'));

        expect(card).toEqual({
            marker: 'preview',
            forwarded: false,
            author: 'Alice',
            title: 'A title',
            url: '',
            fields: [
                { key: 'First', value: 'one' },
                { key: 'Second', value: 'two: three' },
            ],
            thumbnails: ['https://cdn.example/thumb.png'],
            images: [],
            footer: 'A footer',
            body: 'Body line one\nBody line two',
        });
    });

    test('parses a forwarded embed card', () => {
        const card = parseBridgeCard('[FWD] [EMBED]\nTitle: Forwarded');

        expect(card.marker).toBe('embed');
        expect(card.forwarded).toBe(true);
        expect(card.title).toBe('Forwarded');
    });

    test('keeps only the first title and footer', () => {
        const card = parseBridgeCard([
            '[PREVIEW]',
            'Title: First title',
            'Title: Second title',
            'Footer: First footer',
            'Footer: Second footer',
        ].join('\n'));

        expect(card.title).toBe('First title');
        expect(card.footer).toBe('First footer');
        expect(card.body).toBe('Title: Second title\nFooter: Second footer');
    });

    test('keeps multiple thumbnails and ignores invalid ones', () => {
        const card = parseBridgeCard([
            '[EMBED]',
            'Thumbnail: https://cdn.example/one.png',
            'Thumbnail: javascript:alert(1)',
            'Thumbnail: https://cdn.example/two.png',
        ].join('\n'));

        expect(card.thumbnails).toEqual([
            'https://cdn.example/one.png',
            'https://cdn.example/two.png',
        ]);
    });

    test('uses a single image as the thumbnail when no thumbnail exists', () => {
        const card = parseBridgeCard([
            '[PREVIEW]',
            'Image: https://cdn.example/image.png',
            'Body line',
        ].join('\n'));

        expect(card.thumbnails).toEqual(['https://cdn.example/image.png']);
        expect(card.images).toEqual([]);
        expect(card.body).toBe('Body line');
    });

    test('keeps an image outside the card when a thumbnail already exists', () => {
        const card = parseBridgeCard([
            '[PREVIEW]',
            'Thumbnail: https://cdn.example/thumb.png',
            'Image: https://cdn.example/full.png',
            'Body line',
        ].join('\n'));

        expect(card.thumbnails).toEqual(['https://cdn.example/thumb.png']);
        expect(card.images).toEqual(['https://cdn.example/full.png']);
        expect(card.body).toBe('Body line');
    });

    test('collects multiple images for a gallery', () => {
        const card = parseBridgeCard([
            '[PREVIEW]',
            'Image: https://cdn.example/one.png',
            'Image: https://cdn.example/two.png',
            'Body line',
        ].join('\n'));

        expect(card.thumbnails).toEqual([]);
        expect(card.images).toEqual([
            'https://cdn.example/one.png',
            'https://cdn.example/two.png',
        ]);
        expect(card.body).toBe('Body line');
    });

    test('ignores unsafe images', () => {
        const card = parseBridgeCard([
            '[PREVIEW]',
            'Image: javascript:alert(1)',
            'Body line',
        ].join('\n'));

        expect(card.thumbnails).toEqual([]);
        expect(card.images).toEqual([]);
        expect(card.body).toBe('Body line');
    });

    test('treats malformed fields and unknown labels as body text', () => {
        const card = parseBridgeCard([
            '[PREVIEW]',
            'Field: missing separator',
            'Unknown: value',
            'Body',
        ].join('\n'));

        expect(card.fields).toEqual([]);
        expect(card.body).toBe('Field: missing separator\nUnknown: value\nBody');
    });

    test('handles leading whitespace and indented markers', () => {
        const spaced = parseBridgeCard([
            '[PREVIEW]',
            '  Author: Library Productions',
            '  Title: Prey (2017)',
            '  Field: Studio: Arkane',
            '  Thumbnail: https://i.ytimg.com/vi/example/maxresdefault.jpg',
            '  Footer: A footer',
            '  Description: All credit goes to the creators.',
            '  Body line',
        ].join('\n'));

        expect(spaced.author).toBe('Library Productions');
        expect(spaced.title).toBe('Prey (2017)');
        expect(spaced.fields).toEqual([{ key: 'Studio', value: 'Arkane' }]);
        expect(spaced.thumbnails).toEqual([
            'https://i.ytimg.com/vi/example/maxresdefault.jpg',
        ]);
        expect(spaced.footer).toBe('A footer');
        expect(spaced.body).toBe([
            'All credit goes to the creators.',
            'Body line',
        ].join('\n'));

        const tabbed = parseBridgeCard([
            '[EMBED]',
            '\tAuthor: Alice',
            '\tTitle: A title',
        ].join('\n'));

        expect(tabbed.author).toBe('Alice');
        expect(tabbed.title).toBe('A title');

        const indented = parseBridgeCard('  [FWD] [PREVIEW]  \n  Title: A title');

        expect(indented).not.toBeNull();
        expect(indented.forwarded).toBe(true);
        expect(indented.title).toBe('A title');
    });

    test('strips description labels and extracts safe card URLs', () => {
        const card = parseBridgeCard([
            '[PREVIEW]',
            'Title: A title',
            'Description: All credit goes to the creators.',
            'URL: https://example.com/post',
            'Body line',
        ].join('\n'));

        expect(card.body).toBe([
            'All credit goes to the creators.',
            'Body line',
        ].join('\n'));
        expect(card.url).toBe('https://example.com/post');
    });

    test('ignores unsafe card URLs', () => {
        const card = parseBridgeCard([
            '[PREVIEW]',
            'URL: javascript:alert(1)',
            'Body line',
        ].join('\n'));

        expect(card.url).toBe('');
        expect(card.body).toBe('Body line');
    });

    test('trims all body lines and turns lone dots into blank lines', () => {
        const card = parseBridgeCard([
            '  [PREVIEW]  ',
            '  Body one  ',
            '  .  ',
            '  Body two  ',
            '   ',
            '.',
            '  .',
        ].join('\n'));

        expect(card.body).toBe('Body one\n\nBody two\n\n\n');
    });

    test('keeps indented duplicate labels in the body', () => {
        const card = parseBridgeCard([
            '[PREVIEW]',
            '  Title: First title',
            '  Title: Second title',
            '  Footer: First footer',
            '  Footer: Second footer',
        ].join('\n'));

        expect(card.title).toBe('First title');
        expect(card.footer).toBe('First footer');
        expect(card.body).toBe([
            'Title: Second title',
            'Footer: Second footer',
        ].join('\n'));
    });

    test('preserves marker-line text as the first body line', () => {
        const card = parseBridgeCard('[PREVIEW] First body line\nSecond body line');

        expect(card.body).toBe('First body line\nSecond body line');
    });

    test('does not parse non-card text', () => {
        expect(isBridgeCardText('hello [PREVIEW]')).toBe(false);
        expect(parseBridgeCard('hello [PREVIEW]')).toBeNull();
        expect(parseBridgeCard('')).toBeNull();
        expect(parseBridgeCard(null)).toBeNull();
    });

    test('recognizes all supported markers', () => {
        expect(isBridgeCardText('[PREVIEW]')).toBe(true);
        expect(isBridgeCardText('[EMBED]')).toBe(true);
        expect(isBridgeCardText('[FWD] [PREVIEW]')).toBe(true);
        expect(isBridgeCardText('[FWD] [EMBED]')).toBe(true);
        expect(isBridgeCardText('  [PREVIEW]')).toBe(true);
    });

    test('identifies only preview cards for hiding', () => {
        expect(isPreviewCard({ bridge_card: { marker: 'preview' } })).toBe(true);
        expect(isPreviewCard({ bridge_card: { marker: 'embed' } })).toBe(false);
        expect(isPreviewCard({ bridge_card: null })).toBe(false);
        expect(isPreviewCard({})).toBe(false);
        expect(isPreviewCard(null)).toBe(false);
    });
});

describe('bridge card messages', () => {
    let s;
    let network;
    let buffer;
    let client;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
        network.state = 'connected';
        network.nick = 'TestNick';
        buffer = s.addBuffer(network.id, '#test');
        client = network.ircClient;
        client.user.nick = 'TestNick';
    });

    function dispatch(message, tags) {
        client.parsed_middleware.handle(['message', {
            type: 'privmsg',
            nick: 'BridgeBot',
            target: '#test',
            message,
            time: Date.now(),
            tags,
        }, client], (err) => {
            if (err) {
                throw err;
            }
        });
    }

    test('attaches the parsed card and keeps labels out of the message body', () => {
        dispatch([
            '[PREVIEW]',
            'Author: Alice',
            'Title: A title',
            'Field: Key: Value',
            'Thumbnail: https://cdn.example/thumb.png',
            'Footer: Footer',
            'Body text',
        ].join('\n'), {
            'kiwi-bridge-card': '1',
        });

        const message = buffer.getMessages()[0];
        expect(message.message).toBe('Body text');
        expect(message.raw_text).toBe('Body text');
        expect(message.tags['kiwi-bridge-card']).toBeUndefined();
        expect(message.bridge_card).toEqual({
            marker: 'preview',
            forwarded: false,
            author: 'Alice',
            title: 'A title',
            url: '',
            fields: [{ key: 'Key', value: 'Value' }],
            thumbnails: ['https://cdn.example/thumb.png'],
            images: [],
            footer: 'Footer',
            body: 'Body text',
        });
        expect(message.bodyTemplate).toBeTruthy();
        expect(message.bodyTemplateProps.card).toBe(message.bridge_card);
    });

    test('does not parse a card without the multiline marker tag', () => {
        dispatch('[PREVIEW]\nTitle: A title\nBody text', {});

        const message = buffer.getMessages()[0];
        expect(message.bridge_card).toBeNull();
        expect(message.bodyTemplate).toBeNull();
        expect(message.message).toBe('[PREVIEW]\nTitle: A title\nBody text');
    });
});

describe('BridgeCard component', () => {
    let s;
    let vm;

    beforeEach(() => {
        s = state.create();
        Vue.prototype.$state = s;
    });

    afterEach(() => {
        if (vm) {
            vm.$destroy();
            vm.$el.remove();
            vm = null;
        }
        delete Vue.prototype.$state;
        jest.restoreAllMocks();
    });

    function mountCard(card) {
        const mountEl = document.createElement('div');
        document.body.appendChild(mountEl);
        vm = new Vue({
            el: mountEl,
            render: (h) => h(BridgeCard, {
                props: {
                    card,
                    buffer: {},
                    message: { message: '' },
                    idx: 0,
                    ml: { formatMessage: () => '' },
                },
            }),
        });
        return vm.$children[0];
    }

    function cardWithThumbnails(thumbnails) {
        return {
            marker: 'preview',
            forwarded: false,
            author: '',
            title: '',
            url: '',
            fields: [],
            thumbnails,
            images: [],
            footer: '',
            body: '',
        };
    }

    test('opens a single thumbnail in the lightbox', async() => {
        const url = 'https://cdn.example/thumb.png';
        const component = mountCard(cardWithThumbnails([url]));
        const notifications = jest.fn();
        s.$on('mediaviewer.show', notifications);

        await Vue.nextTick();
        const root = component.$el;
        expect(root.querySelectorAll('.kiwi-bridge-card-thumbnails img')).toHaveLength(1);

        root.querySelector('.kiwi-bridge-card-thumbnail-image').click();
        await Vue.nextTick();

        expect(s.ui.lightbox_url).toBe(url);
        expect(notifications).not.toHaveBeenCalled();
    });

    test('renders multiple thumbnails in a row', async() => {
        const urls = [
            'https://cdn.example/one.png',
            'https://cdn.example/two.png',
        ];
        const component = mountCard(cardWithThumbnails(urls));

        await Vue.nextTick();
        const images = component.$el.querySelectorAll('.kiwi-bridge-card-thumbnails img');
        expect(images).toHaveLength(2);

        images[1].click();
        await Vue.nextTick();
        expect(s.ui.lightbox_url).toBe(urls[1]);
    });

    test('renders a single external image outside the card surface', async() => {
        const image = 'https://cdn.example/full.png';
        const component = mountCard({
            ...cardWithThumbnails([]),
            images: [image],
        });

        await Vue.nextTick();
        const surface = component.$el.querySelector('.kiwi-bridge-card-surface');
        const gallery = component.$el.querySelector('.kiwi-bridge-card-images');
        const images = gallery.querySelectorAll('.kiwi-bridge-card-image');
        expect(surface.querySelector('.kiwi-bridge-card-image')).toBeNull();
        expect(images).toHaveLength(1);
        expect(gallery.classList.contains('kiwi-bridge-card-images--single')).toBe(true);

        images[0].click();
        await Vue.nextTick();
        expect(s.ui.lightbox_url).toBe(image);
    });

    test('renders multiple external images as a gallery', async() => {
        const images = [
            'https://cdn.example/one.png',
            'https://cdn.example/two.png',
        ];
        const component = mountCard({
            ...cardWithThumbnails([]),
            images,
        });

        await Vue.nextTick();
        const gallery = component.$el.querySelector('.kiwi-bridge-card-images');
        expect(gallery.querySelectorAll('.kiwi-bridge-card-image')).toHaveLength(2);
        expect(gallery.classList.contains('kiwi-bridge-card-images--single')).toBe(false);
    });

    test('does not open the card URL when clicking an external image', async() => {
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        const image = 'https://cdn.example/full.png';
        const component = mountCard({
            ...cardWithThumbnails([]),
            url: 'https://example.com/post',
            images: [image],
        });

        await Vue.nextTick();
        component.$el.querySelector('.kiwi-bridge-card-image').click();
        await Vue.nextTick();

        expect(s.ui.lightbox_url).toBe(image);
        expect(open).not.toHaveBeenCalled();
        open.mockRestore();
    });

    test('renders a linked title when the card has a URL', async() => {
        const component = mountCard({
            ...cardWithThumbnails([]),
            title: 'A title',
            url: 'https://example.com/post',
        });

        await Vue.nextTick();
        const title = component.$el.querySelector('.kiwi-bridge-card-title');
        expect(title.tagName).toBe('A');
        expect(title.getAttribute('href')).toBe('https://example.com/post');
    });

    test('opens the card URL when clicking outside links and thumbnails', async() => {
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        const component = mountCard({
            ...cardWithThumbnails([]),
            title: 'A title',
            url: 'https://example.com/post',
        });

        await Vue.nextTick();
        component.$el.querySelector('.kiwi-bridge-card-surface').click();

        expect(open).toHaveBeenCalledWith(
            'https://example.com/post',
            '_blank',
            'noopener,noreferrer'
        );
        open.mockRestore();
    });

    test('does not open the card URL when clicking a thumbnail', async() => {
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        const url = 'https://cdn.example/thumb.png';
        const component = mountCard({
            ...cardWithThumbnails([url]),
            url: 'https://example.com/post',
        });

        await Vue.nextTick();
        component.$el.querySelector('.kiwi-bridge-card-thumbnail-image').click();
        await Vue.nextTick();

        expect(s.ui.lightbox_url).toBe(url);
        expect(open).not.toHaveBeenCalled();
        open.mockRestore();
    });
});
