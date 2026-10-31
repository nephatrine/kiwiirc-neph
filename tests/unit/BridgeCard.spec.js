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
            fields: [
                { key: 'First', value: 'one' },
                { key: 'Second', value: 'two: three' },
            ],
            thumbnails: ['https://cdn.example/thumb.png'],
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

    test('recognizes labels with leading spaces', () => {
        const card = parseBridgeCard([
            '[PREVIEW]',
            '  Author: Library Productions',
            '  Title: Prey (2017)',
            '  Field: Studio: Arkane',
            '  Thumbnail: https://i.ytimg.com/vi/example/maxresdefault.jpg',
            '  Footer: A footer',
            '  Description: All credit goes to the creators.',
            '  Body line',
        ].join('\n'));

        expect(card.author).toBe('Library Productions');
        expect(card.title).toBe('Prey (2017)');
        expect(card.fields).toEqual([{ key: 'Studio', value: 'Arkane' }]);
        expect(card.thumbnails).toEqual([
            'https://i.ytimg.com/vi/example/maxresdefault.jpg',
        ]);
        expect(card.footer).toBe('A footer');
        expect(card.body).toBe([
            'Description: All credit goes to the creators.',
            'Body line',
        ].join('\n'));
    });

    test('recognizes labels with leading tabs', () => {
        const card = parseBridgeCard([
            '[EMBED]',
            '\tAuthor: Alice',
            '\tTitle: A title',
        ].join('\n'));

        expect(card.author).toBe('Alice');
        expect(card.title).toBe('A title');
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

    test('recognizes an indented opening marker', () => {
        const card = parseBridgeCard('  [FWD] [PREVIEW]  \n  Title: A title');

        expect(card).not.toBeNull();
        expect(card.forwarded).toBe(true);
        expect(card.title).toBe('A title');
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
            fields: [{ key: 'Key', value: 'Value' }],
            thumbnails: ['https://cdn.example/thumb.png'],
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
            fields: [],
            thumbnails,
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
});
