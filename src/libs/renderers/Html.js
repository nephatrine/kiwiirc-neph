'kiwi public';

import { escapeHtml } from '@/helpers/Utils';
import { canPreviewUrl, isSpoilerBlock } from '@/helpers/Misc';
import getState from '@/libs/state';
import GlobalApi from '@/libs/GlobalApi';
import * as EmojiProvider from '@/libs/EmojiProvider';

export default render;

function render(blocks, renderEmoticons) {
    const state = getState();
    const showEmoticons = typeof renderEmoticons === 'undefined' ?
        state.setting('buffers.emoji_convert_incoming') :
        !!renderEmoticons;

    const retHtml = blocks.reduce((html, block, i) => {
        // a
        let style = '';
        let classes = '';
        const blockStyles = block.styles || {};

        Object.keys(blockStyles).forEach((s) => {
            if (s === 'underline') {
                style += 'text-decoration:underline;';
            } else if (s === 'strikethrough') {
                style += 'text-decoration:line-through;';
            } else if (s === 'bold') {
                style += 'font-weight:bold;';
            } else if (s === 'italic') {
                style += 'font-style:italic;';
            } else if (s === 'monospace') {
                classes += 'kiwi-formatting-extras-monospace ';
            } else if (s === 'reverse') {
                classes += 'kiwi-formatting-reverse ';
            } else if (s === 'block') {
                classes += 'kiwi-formatting-extras-block ';
            } else if (s === 'color') {
                if (blockStyles[s][0] === '#') {
                    style += `color:${blockStyles[s]};`;
                } else {
                    classes += `irc-fg-colour-${blockStyles[s]} `;
                }
            } else if (s === 'background') {
                if (blockStyles[s][0] === '#') {
                    style += `background-color:${blockStyles[s]};`;
                } else {
                    classes += `irc-bg-colour-${blockStyles[s]} `;
                }
            }
        });

        if (isSpoilerBlock(block)) {
            classes += 'kiwi-spoiler ';
        }

        let content;
        switch (block.type) {
        case 'url':
            content = linkifyUrl(block, {
                addHandle: !isSpoilerBlock(block) &&
                    state.setting('buffers.show_link_previews') &&
                    canPreviewUrl(block.meta.url),
                handleClass: 'bx bx-share u-link kiwi-messagelist-message-linkhandle',
            });
            break;
        case 'user':
            content = linkifyUser(block);
            break;
        case 'channel':
            content = linkifyChannel(block);
            break;
        case 'emoji':
            content = EmojiProvider.blockToHtml(block, blocks.length === 1, showEmoticons);
            break;
        case 'raw':
            content = escapeHtml(block.content);
            break;
        default: {
            const custom = GlobalApi.singleton().getBlockRenderer(block.type);
            content = custom ?
                custom(block, blocks) :
                EmojiProvider.wrapEmojiText(block.content);
        }
        }

        return html + buildSpan(content, classes, style);
    }, '');

    return `${retHtml}`;
}

function linkifyUrl(block, _opts) {
    let opts = _opts || {};
    let nice = '';

    // Shorten the displayed URL if it's going to be too long
    if (block.content.length > 100) {
        nice = escapeHtml(block.content.substr(0, 100)) + '...';
    } else {
        nice = escapeHtml(block.content);
    }

    // Make the link clickable
    let href = block.meta.url.replace(/"/g, '%22');
    let out = `<a target="_blank" href="${href}" rel="noopener noreferrer" class="u-link">${nice}</a>`;

    if (opts.addHandle) {
        let cssClass = opts.handleClass || '';
        let content = opts.handleContent || '';
        out += `<a data-url="${escapeHtml(block.meta.url)}" class="${cssClass}">${content}</a>`;
    }

    return out;
}

function linkifyUser(block) {
    let escaped = escapeHtml(block.meta.user);
    let colour = block.meta.colour;

    return `<a class="kiwi-nick" data-nick="${escaped}"` +
        (colour ? ` style="color:${colour};"` : '') +
        `>${EmojiProvider.wrapEmojiText(block.meta.user)}</a>`;
}

function linkifyChannel(block) {
    return `<a class="u-link kiwi-channel" data-channel-name="${escapeHtml(block.meta.channel)}">${EmojiProvider.wrapEmojiText(block.content)}</a>`;
}

function buildSpan(content, classes, style) {
    if (style === '' && classes === '') {
        return content;
    }

    return (
        '<span' +
        (style !== '' ? ` style="${style}"` : '') +
        (classes !== '' ? ` class="${classes}"` : '') +
        `>${content}</span>`
    );
}
