import { sanitizeUrl } from '@/helpers/Misc';

export const BRIDGE_CARD_TAG = 'kiwi-bridge-card';

const MARKER_REGEX = /^(?:<[^>\n]*>\s*)*(?:(\[FWD\] ))?\[(PREVIEW|EMBED)\]/;

function labelValue(line, label) {
    const trimmedLine = line.trimStart();
    if (!trimmedLine.startsWith(label)) {
        return null;
    }

    return trimmedLine.slice(label.length).trim();
}

/**
 * Parse a bridge card message. The caller is responsible for only passing
 * messages that came from a multiline batch.
 * @param {string} text
 * @returns {object|null}
 */
export function parseBridgeCard(text) {
    if (typeof text !== 'string') {
        return null;
    }

    const lines = text.split('\n').map((line) => {
        const trimmed = line.trim();
        return trimmed === '.' ? '' : trimmed;
    });
    const marker = MARKER_REGEX.exec(lines[0] || '');
    if (!marker) {
        return null;
    }

    const card = {
        marker: marker[2].toLowerCase(),
        forwarded: !!marker[1],
        author: '',
        title: '',
        url: '',
        fields: [],
        thumbnails: [],
        images: [],
        footer: '',
        body: '',
    };
    const bodyLines = [];
    const markerRemainder = lines[0].slice(marker[0].length).trim();
    if (markerRemainder) {
        bodyLines.push(markerRemainder);
    }

    let hasAuthor = false;
    let hasTitle = false;
    let hasFooter = false;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        const author = labelValue(line, 'Author:');
        if (author !== null) {
            if (!hasAuthor && author) {
                card.author = author;
                hasAuthor = true;
            } else {
                bodyLines.push(line);
            }
            continue;
        }

        const title = labelValue(line, 'Title:');
        if (title !== null) {
            if (!hasTitle && title) {
                card.title = title;
                hasTitle = true;
            } else {
                bodyLines.push(line);
            }
            continue;
        }

        const field = labelValue(line, 'Field:');
        if (field !== null) {
            const separator = field.indexOf(':');
            const key = separator > 0 ? field.slice(0, separator).trim() : '';
            if (key) {
                card.fields.push({
                    key,
                    value: field.slice(separator + 1).trim(),
                });
            } else {
                bodyLines.push(line);
            }
            continue;
        }

        const thumbnail = labelValue(line, 'Thumbnail:');
        if (thumbnail !== null) {
            const cleanThumbnail = sanitizeUrl(thumbnail);
            if (cleanThumbnail) {
                card.thumbnails.push(cleanThumbnail);
            }
            continue;
        }

        const image = labelValue(line, 'Image:');
        if (image !== null) {
            const cleanImage = sanitizeUrl(image);
            if (cleanImage) {
                card.images.push(cleanImage);
            }
            continue;
        }

        const footer = labelValue(line, 'Footer:');
        if (footer !== null) {
            if (!hasFooter && footer) {
                card.footer = footer;
                hasFooter = true;
            } else {
                bodyLines.push(line);
            }
            continue;
        }

        const description = labelValue(line, 'Description:');
        if (description !== null) {
            if (description) {
                bodyLines.push(description);
            }
            continue;
        }

        const url = labelValue(line, 'URL:');
        if (url !== null) {
            if (!card.url) {
                const cleanUrl = sanitizeUrl(url);
                if (cleanUrl) {
                    card.url = cleanUrl;
                }
            }
            continue;
        }

        bodyLines.push(line);
    }

    if (!card.thumbnails.length && card.images.length === 1) {
        card.thumbnails = card.images.slice();
        card.images = [];
    }

    card.body = bodyLines.join('\n');
    return card;
}

export function isBridgeCardText(text) {
    return typeof text === 'string' && MARKER_REGEX.test(text.trimStart());
}

export function isPreviewCard(message) {
    return !!(
        message &&
        message.bridge_card &&
        message.bridge_card.marker === 'preview'
    );
}
