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

function messageBuffer() {
    return {
        users: {},
        isSpecial: () => false,
        setting: (name) => (name === 'inline_link_auto_preview_whitelist' ? '.*' : undefined),
    };
}

function autoEmbed(url) {
    const message = new Message({
        message: url,
        nick: 'tester',
        type: 'privmsg',
    });
    message.toBlocks(messageBuffer(), false);
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
});
