'kiwi public';

import Vue from 'vue';
import parseMessage from '@/libs/MessageParser';
import { stripStyles, sanitizeUrl } from '@/helpers/Misc';
import toHtml from '@/libs/renderers/Html';
import GlobalApi from '@/libs/GlobalApi';
import getState from './state';

let nextId = 0;

function def(target, key, value) {
    Object.defineProperty(target, key, {
        writable: true,
        value,
    });
}

export default class Message {
    constructor(message, user) {
        // instance_num is a running number for all messages created within Kiwi. Used to order
        // messages if the message time is the same.
        this.instance_num = nextId++;
        this.id = nextId++;
        this.irc_id = extractMessageId(message);

        // internal_time is used to allow for a getter/setter
        // so day_num can be updated if the time is changed
        this.internal_time = null;
        this.day_num = null;
        this.reply = extractReplyId(message);

        // Two different times;
        //   time = time in the users local time (getter/setter)
        //   server_time = time the server gave us
        this.time = message.time || Date.now();
        this.server_time = message.server_time || this.time;
        this.nick = message.nick;
        this.message = message.message;
        // Raw text as it was sent on the wire, before any formatting was
        // applied. Used to match an echo back to the local pending copy.
        this.raw_text = typeof message.raw_text === 'string' ? message.raw_text : this.message;
        this.tags = message.tags;
        this.type = message.type || 'message';
        this.type_extra = message.type_extra;
        this.ignore = false;
        this.mentioned_urls = [];
        // If embed.payload is truthy, it will be embedded within the message
        this.embed = { type: 'url', payload: null };
        this.html = '';
        this.blocks = [];
        this.hasParsed = false;
        this.lastUsedExtraFormatting = null;
        this.hasRendered = false;
        this.hasUserLink = false;
        // template should be null or a Vue component to render this message
        this.template = message.template || null;
        this.templateProps = message.templateProps || {};
        // bodyTemplate should be null or a Vue component to render in the body of the message
        this.bodyTemplate = message.bodyTemplate || null;
        this.bodyTemplateProps = message.bodyTemplateProps || {};
        this.isHighlight = false;
        this.is_bot = !!(message.tags && typeof message.tags.bot !== 'undefined');
        this.bridged_nick = '';
        if (this.is_bot && typeof this.message === 'string') {
            let bridged = /^<([^<>\s][^<>]{0,63})>\s+/.exec(this.message);
            if (bridged) {
                let cleanNick = stripStyles(bridged[1]).trim();
                if (cleanNick) {
                    this.bridged_nick = cleanNick;
                    this.message = this.message.slice(bridged[0].length);
                }
            }
        }
        this.bridged_avatar = '';
        let avatarTag = message.tags && message.tags['+avatar'];
        if (typeof avatarTag === 'string' && avatarTag) {
            let cleanAvatar = sanitizeUrl(avatarTag);
            if (cleanAvatar) {
                this.bridged_avatar = cleanAvatar;
            }
        }
        this.is_history = !!(message.tags && (
            typeof message.tags['draft/chathistory-context'] !== 'undefined' ||
            typeof message.tags['kiwi-history'] !== 'undefined'
        ));
        this.is_pending = !!message.is_pending;
        this.is_new = !!message.is_new;
        this.is_rerouted = !!message.is_rerouted;
        this.protocol_target = message.protocol_target || '';
        this.is_redacted = !!message.is_redacted;
        this.redacted_by = message.redacted_by || '';
        this.redaction_reason = message.redaction_reason || '';
        this.is_redacted_revealed = !!message.is_redacted_revealed;
        this.reactions = {};

        // We don't want the user object to be enumerable
        def(this, 'user', user || null);

        Vue.observable(this);
    }

    get time() {
        return this.internal_time;
    }

    set time(newTime) {
        this.internal_time = newTime;
        // txOffset is the milliseconds needed to get localtime to UTC
        // eg UTC+1 = -3,600,000
        const tzOffset = (new Date(newTime)).getTimezoneOffset() * 60000;
        // 68400000 equals one day in milliseconds
        this.day_num = Math.floor((newTime - tzOffset) / 86400000);
    }

    condenseKey() {
        return (this.nick || '') + '\n' + (this.bridged_nick || '');
    }

    render() {
        // Allow plugins to render their own messages if needed
        GlobalApi.singleton().emit('message.render', { message: this });
        return this;
    }

    toHtml(messageList) {
        if (this.hasRendered) {
            return this.html;
        }

        this.hasRendered = true;

        let state = getState();
        let network = messageList.buffer.getNetwork();
        let showEmoticons = state.setting('buffers.emoji_convert_incoming') &&
            !messageList.buffer.isSpecial() &&
            (!network || network.isUtf8);

        this.toBlocks(messageList.buffer, messageList.useExtraFormatting);

        state.$emit('message.prestyle', { message: this, blocks: this.blocks });

        this.hasUserLink = this.blocks.some((block) => block.type === 'user');

        let content = toHtml(this.blocks, showEmoticons);
        this.html = content;

        state.$emit('message.poststyle', { message: this, blocks: this.blocks });
        return this.html;
    }

    toBlocks(buffer, useExtraFormatting) {
        if (this.hasParsed && this.lastUsedExtraFormatting === useExtraFormatting) {
            return this.blocks;
        }

        let state = getState();
        let userList = buffer.users;

        let isSpecial = buffer.isSpecial();
        let blocks = parseMessage(
            this.message,
            {
                extras: !isSpecial && useExtraFormatting && this.type === 'privmsg',
                noformatting: isSpecial,
                visibleControlChars: isSpecial,
            },
            userList
        );

        this.mentioned_urls = blocks.filter((block) => block.type === 'url').map((block) => block.meta.url);
        this.maybeAutoEmbed(buffer);

        state.$emit('message.blocks', { message: this, blocks: blocks });
        this.blocks = blocks;
        this.hasParsed = true;
        this.lastUsedExtraFormatting = useExtraFormatting;
        return blocks;
    }

    maybeAutoEmbed(buffer) {
        if (!this.mentioned_urls || this.mentioned_urls.length === 0) {
            return;
        }

        // Only auto preview links on user messages. Traffic, topics, notices, etc would get
        // annoying as they usually contain links of some sort
        const type = (this.type || '').toLowerCase();
        if (type !== 'privmsg' && type !== 'message') {
            return;
        }

        let url = this.mentioned_urls[0];

        // Ensure we have a valid whitelist, defaulting to allow-all
        let whitelistRegex = buffer.setting('inline_link_auto_preview_whitelist') || '.*';
        whitelistRegex = (whitelistRegex || '').trim() || '.*';
        try {
            if (!(new RegExp(whitelistRegex, 'i')).test(url)) {
                return;
            }
        } catch (err) {
            // A bad regex pattern should not block all previews
        }

        this.embed.payload = url;
        this.embed.type = 'url';
    }

    serialise() {
        return {
            id: this.id,
            time: this.time,
            server_time: this.server_time,
            nick: this.nick,
            message: this.message,
            raw_text: this.raw_text,
            tags: this.tags,
            type: this.type,
            type_extra: this.type_extra,
            is_history: this.is_history,
            is_pending: this.is_pending,
            is_new: this.is_new,
            is_rerouted: this.is_rerouted,
            protocol_target: this.protocol_target,
            is_redacted: this.is_redacted,
            redacted_by: this.redacted_by,
            redaction_reason: this.redaction_reason,
            is_redacted_revealed: this.is_redacted_revealed,
        };
    }
}

function extractMessageId(message) {
    if (message.irc_id) {
        return message.irc_id;
    }

    if (!message.tags) {
        return undefined;
    }

    return message.tags.msgid || message.tags['draft/msgid'] || undefined;
}

function extractReplyId(message) {
    if (!message.tags) {
        return undefined;
    }

    return message.tags['+reply'] ||
        message.tags['+draft/reply'] ||
        message.tags['reply-parent-msg-id'] ||
        message.tags.reply ||
        undefined;
}
