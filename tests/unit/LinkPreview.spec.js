import getState from '@/libs/state';
import Message from '@/libs/Message';
import toHtml from '@/libs/renderers/Html';

function urlBlock(url) {
    return [{
        type: 'url',
        content: url,
        meta: { url },
        styles: {},
    }];
}

function spoilerBlock(url) {
    return [{
        type: 'url',
        content: url,
        meta: { url },
        styles: { color: 'black', background: 'black' },
    }];
}

function messageBuffer() {
    return {
        users: {},
        isSpecial: () => false,
        setting: (name) => (name === 'inline_link_auto_preview_whitelist' ? '.*' : undefined),
    };
}

function autoEmbed(url, extras = false) {
    const message = new Message({
        message: url,
        nick: 'tester',
        type: 'privmsg',
    });
    message.toBlocks(messageBuffer(), extras);
    return message.embed.payload;
}

describe('link preview rendering', () => {
    beforeEach(() => {
        getState().setting('buffers.show_link_previews', true);
    });

    it('does not add a preview handle to a non-media link', () => {
        expect(toHtml(urlBlock('https://example.com/article'), false))
            .not.toContain('data-url');
    });

    it('adds preview handles to native media', () => {
        expect(toHtml(urlBlock('https://example.com/image.jpg'), false))
            .toContain('data-url');
    });

    it('does not auto-embed non-media links', () => {
        expect(autoEmbed('https://example.com/article')).toBeNull();
    });

    it('auto-embeds native media', () => {
        expect(autoEmbed('https://example.com/image.jpg'))
            .toBe('https://example.com/image.jpg');
    });

    it('adds preview handles to extensionless X media previews', () => {
        expect(toHtml(urlBlock('https://jf.x.com/images/media-preview/2115941753798692948'), false))
            .toContain('data-url');
    });

    it('auto-embeds extensionless X media previews', () => {
        expect(autoEmbed('https://jf.x.com/images/media-preview/2115941753798692948'))
            .toBe('https://jf.x.com/images/media-preview/2115941753798692948');
    });

    it('does not auto-embed lookalike hosts', () => {
        expect(autoEmbed('https://notx.com/images/media-preview/2115941753798692948')).toBeNull();
    });

    it('does not add a preview handle to a spoiler URL', () => {
        let html = toHtml(spoilerBlock('https://example.com/image.jpg'), false);
        expect(html).toContain('kiwi-spoiler');
        expect(html).not.toContain('data-url');
    });

    it('does not auto-embed a spoiler URL', () => {
        expect(autoEmbed('||https://example.com/image.jpg||', true)).toBeNull();
    });

    it('does not auto-embed a colour-coded spoiler URL', () => {
        expect(autoEmbed('\x0301,01https://example.com/image.jpg\x03')).toBeNull();
    });

    it('auto-embeds a normal URL after a spoiler URL', () => {
        expect(autoEmbed(
            '||https://example.com/spoiler.jpg|| https://example.com/image.jpg',
            true
        )).toBe('https://example.com/image.jpg');
    });

    it('excludes spoiler URLs from mentioned_urls', () => {
        const message = new Message({
            message: '||https://example.com/spoiler.jpg|| https://example.com/image.jpg',
            nick: 'tester',
            type: 'privmsg',
        });
        message.toBlocks(messageBuffer(), true);
        expect(message.mentioned_urls).toEqual(['https://example.com/image.jpg']);
    });
});
