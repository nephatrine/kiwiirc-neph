'kiwi public';

import Vue from 'vue';
import parseMessage from '@/libs/MessageParser';
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
        this.tags = message.tags;
        this.type = message.type || 'message';
        this.type_extra = message.type_extra;
        this.ignore = false;
        this.mentioned_urls = [];
        // If embed.payload is truthy, it will be embedded within the message
        this.embed = { type: 'url', payload: null };
        this.html = '';
        this.blocks = [];
        this.hasRendered = false;
        this.hasUserLink = false;
        // template should be null or a Vue component to render this message
        this.template = message.template || null;
        this.templateProps = message.templateProps || {};
        // bodyTemplate should be null or a Vue component to render in the body of the message
        this.bodyTemplate = message.bodyTemplate || null;
        this.bodyTemplateProps = message.bodyTemplateProps || {};
        this.isHighlight = false;
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
        let showEmoticons = state.setting('buffers.show_emoticons') && !messageList.buffer.isSpecial();

        this.toBlocks(messageList.buffer, messageList.useExtraFormatting);

        state.$emit('message.prestyle', { message: this, blocks: this.blocks });

        this.hasUserLink = this.blocks.some((block) => block.type === 'user');

        let content = toHtml(this.blocks, showEmoticons);
        this.html = content;

        state.$emit('message.poststyle', { message: this, blocks: this.blocks });
        return this.html;
    }

    toBlocks(buffer, useExtraFormatting) {
        let state = getState();
        let userList = buffer.users;

        let blocks = parseMessage(
            this.message,
            {
                extras: !buffer.isSpecial() && useExtraFormatting && this.type === 'privmsg',
            },
            userList
        );

        this.mentioned_urls = blocks.filter((block) => block.type === 'url').map((block) => block.meta.url);
        this.maybeAutoEmbed();

        state.$emit('message.blocks', { message: this, blocks: blocks });
        this.blocks = blocks;
        return blocks;
    }

    maybeAutoEmbed() {
        if (!this.mentioned_urls || this.mentioned_urls.length === 0) {
            return;
        }

        // Only auto preview links on user messages. Traffic, topics, notices, etc would get
        // annoying as they usually contain links of some sort
        if (this.type !== 'privmsg') {
            return;
        }

        let url = this.mentioned_urls[0];

        let whitelistRegex = getState().setting('buffers.inline_link_auto_preview_whitelist');
        whitelistRegex = (whitelistRegex || '').trim();
        try {
            if (!whitelistRegex || !(new RegExp(whitelistRegex, 'i')).test(url)) {
                return;
            }
        } catch (err) {
            // A bad regex pattern will throw an error
            return;
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
            tags: this.tags,
            type: this.type,
            type_extra: this.type_extra,
        };
    }
}

function extractMessageId(message) {
    if (!message.tags) {
        return undefined;
    }

    return message.tags.msgid || message.tags['draft/msgid'] || undefined;
}

function extractReplyId(message) {
    if (!message.tags) {
        return undefined;
    }

    return message.tags['+reply'] || message.tags['+draft/reply'] || message.tags.reply || undefined;
}
