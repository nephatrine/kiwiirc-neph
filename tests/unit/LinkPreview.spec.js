import getState from '@/libs/state';
import Message from '@/libs/Message';
import toHtml from '@/libs/renderers/Html';
import { clearPreviewFailures, markPreviewFailed } from '@/helpers/Misc';

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

function messageBuffer(resolveMessage) {
    return {
        users: {},
        isSpecial: () => false,
        setting: (name) => (name === 'inline_link_auto_preview_whitelist' ? '.*' : undefined),
        getNetwork: () => ({
            resolveMessage: resolveMessage || (() => null),
        }),
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

function autoEmbedReply(text, original, tags) {
    const buffer = messageBuffer(() => (
        original ? { message: original, buffer } : null
    ));
    const message = new Message({
        message: text,
        nick: 'tester',
        type: 'privmsg',
        tags,
    });
    message.toBlocks(buffer, false);
    return message.embed.payload;
}

describe('link preview rendering', () => {
    beforeEach(() => {
        getState().setting('buffers.show_link_previews', true);
        getState().setting('buffers.inline_link_auto_previews', true);
        getState().setting('buffers.generic_link_previews', false);
        clearPreviewFailures();
    });

    afterEach(() => {
        clearPreviewFailures();
        delete window.kiwiDesktop;
        delete window.kiwi;
    });

    it('does not add a preview handle to a non-media link without desktop', () => {
        expect(toHtml(urlBlock('https://example.com/article'), false))
            .not.toContain('data-url');
    });

    it('adds a manual preview handle to generic links on desktop', () => {
        window.kiwiDesktop = {};
        window.kiwi = { state: getState() };

        expect(toHtml(urlBlock('https://example.com/article'), false))
            .toContain('data-url');
    });

    it('adds preview handles to native media', () => {
        expect(toHtml(urlBlock('https://example.com/image.jpg'), false))
            .toContain('data-url');
    });

    it('hides the preview handle after a metadata preview fails', () => {
        const url = 'https://example.com/article';
        window.kiwiDesktop = {};
        window.kiwi = { state: getState() };

        expect(toHtml(urlBlock(url), false)).toContain('data-url');
        markPreviewFailed(url);
        expect(toHtml(urlBlock(url), false)).not.toContain('data-url');
    });

    it('does not auto-embed non-media links', () => {
        expect(autoEmbed('https://example.com/article')).toBeNull();
    });

    it('auto-embeds generic metadata previews when metadata previews are enabled', () => {
        const state = getState();
        state.setting('buffers.inline_link_auto_previews', true);
        state.setting('buffers.generic_link_previews', true);
        window.kiwiDesktop = {};
        window.kiwi = { state };

        expect(autoEmbed('https://example.com/article'))
            .toBe('https://example.com/article');
    });

    it('does not auto-embed generic metadata previews when metadata previews are disabled', () => {
        const state = getState();
        state.setting('buffers.inline_link_auto_previews', true);
        state.setting('buffers.generic_link_previews', false);
        window.kiwiDesktop = {};
        window.kiwi = { state };

        expect(autoEmbed('https://example.com/article')).toBeNull();
    });

    it('auto-embeds native media', () => {
        expect(autoEmbed('https://example.com/image.jpg'))
            .toBe('https://example.com/image.jpg');
    });

    it('does not auto-embed anything when media previews are disabled', () => {
        const state = getState();
        state.setting('buffers.inline_link_auto_previews', false);
        state.setting('buffers.generic_link_previews', true);
        window.kiwiDesktop = {};
        window.kiwi = { state };

        expect(autoEmbed('https://example.com/image.jpg')).toBeNull();
        expect(autoEmbed('https://example.com/article')).toBeNull();
    });

    it('does not auto-embed a [PREVIEW] reply when the original preview is open', () => {
        const original = {
            embed: { payload: 'https://example.com/image.jpg' },
        };
        expect(autoEmbedReply(
            '[PREVIEW] https://example.com/image.jpg',
            original,
            { '+reply': 'original-msgid' }
        )).toBeNull();
    });

    it('does not auto-embed a [FWD] [PREVIEW] reply when the original preview is open', () => {
        const original = {
            embed: { payload: 'https://example.com/image.jpg' },
        };
        expect(autoEmbedReply(
            '[FWD] [PREVIEW] https://example.com/image.jpg',
            original,
            { '+reply': 'original-msgid' }
        )).toBeNull();
    });

    it('auto-embeds a [PREVIEW] reply when the original preview is closed', () => {
        const original = {
            embed: { payload: '' },
        };
        expect(autoEmbedReply(
            '[PREVIEW] https://example.com/image.jpg',
            original,
            { '+reply': 'original-msgid' }
        )).toBe('https://example.com/image.jpg');
    });

    it('auto-embeds a [PREVIEW] reply when the original cannot be resolved', () => {
        expect(autoEmbedReply(
            '[PREVIEW] https://example.com/image.jpg',
            null,
            { '+reply': 'missing-msgid' }
        )).toBe('https://example.com/image.jpg');
    });

    it('auto-embeds a [PREVIEW] message without a reply tag', () => {
        const original = {
            embed: { payload: 'https://example.com/image.jpg' },
        };
        expect(autoEmbedReply(
            '[PREVIEW] https://example.com/image.jpg',
            original,
            {}
        )).toBe('https://example.com/image.jpg');
    });

    it('does not treat [PREVIEW] in the middle of a message as a bridge preview', () => {
        const original = {
            embed: { payload: 'https://example.com/image.jpg' },
        };
        expect(autoEmbedReply(
            'See [PREVIEW] https://example.com/image.jpg',
            original,
            { '+reply': 'original-msgid' }
        )).toBe('https://example.com/image.jpg');
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
