<template functional>
    <div
        :class="[
            `kiwi-messagelist-message-${props.message.type}`,
            props.message.type_extra
                ? `kiwi-messagelist-message-${props.message.type}-${props.message.type_extra}`
                : '',
            props.ml.isMessageHighlight(props.message)
                ? 'kiwi-messagelist-message--highlight'
                : '',
            props.ml.isHoveringOverMessage(props.message)
                ? 'kiwi-messagelist-message--hover'
                : '',
            props.ml.buffer.last_read && props.message.time > props.ml.buffer.last_read
                ? 'kiwi-messagelist-message--unread'
                : '',
            props.message.nick.toLowerCase() === props.ml.ourNick.toLowerCase()
                ? 'kiwi-messagelist-message--own'
                : '',
            props.ml.message_info_open === props.message
                ? 'kiwi-messagelist-message--info-open'
                : '',
            props.ml.message_info_open && props.ml.message_info_open !== props.message
                ? 'kiwi-messagelist-message--blur'
                : '',
            (props.message.user && props.m().userMode(props.message.user))
                ? `kiwi-messagelist-message--user-mode-${props.m().userMode(props.message.user)}`
                : '',
            !props.ml.bufferSetting('show_timestamps')
                ? 'kiwi-messagelist-message--no-timestamps'
                : '',
            data.staticClass,
        ]"
        :data-message-id="props.message.id"
        :data-nick="(props.message.nick || '').toLowerCase()"
        class="kiwi-messagelist-message kiwi-messagelist-message--text"
        @click="props.ml.onMessageClick($event, props.message, true)"
        @dblclick="props.ml.onMessageDblClick($event, props.message)"
    >
        <div>
            <div v-if="props.message.reply" class="kiwi-messagelist-reply-preview" @click="props.ml.maybeScrollToId(props.message.reply)">
                <i class="fa fa-reply" aria-hidden="true" />
                <span v-if="props.m().getReplyMessage(props.message.reply)" class="kiwi-messagelist-reply-preview-nick">
                    {{ props.m().getReplyMessage(props.message.reply).nick }}:
                </span>
                <span v-if="props.m().getReplyMessage(props.message.reply)" class="kiwi-messagelist-reply-preview-message">
                    {{ props.m().getReplyMessage(props.message.reply).message }}
                </span>
                <span v-else class="kiwi-messagelist-reply-preview-id">
                    {{ props.message.reply }}
                </span>
            </div>
            <span
                v-if="props.ml.bufferSetting('show_timestamps')"
                class="kiwi-messagelist-time"
            >
                {{ props.ml.formatTime(props.message.time) }}
            </span>
            <span
                :style="{ color: props.ml.userColour(props.message.user) }"
                :class="[
                    'kiwi-messagelist-nick',
                    (props.message.user && props.m().userMode(props.message.user))
                        ? `kiwi-messagelist-nick--mode-${props.m().userMode(props.message.user)}`
                        : '',
                ]"
                :data-nick="(props.message.nick || '').toLowerCase()"
                @mouseover="props.ml.hover_nick = props.message.nick.toLowerCase();"
                @mouseout="props.ml.hover_nick = '';"
            >
                <span class="kiwi-messagelist-nick--prefix">
                    {{ props.message.user ? props.m().userModePrefix(props.message.user) : '' }}
                </span>
                <a :data-nick="(props.message.nick || '').toLowerCase()">
                    {{ props.m().displayNick() }}
                </a>
            </span>
            <div
                v-if="props.message.bodyTemplate
                    && props.message.bodyTemplate.$el
                    && props.ml.isTemplateVue(props.message.bodyTemplate)"
                v-rawElement="props.message.bodyTemplate.$el"
                class="kiwi-messagelist-body"
            />
            <component
                :is="props.message.bodyTemplate"
                v-else-if="props.message.bodyTemplate"
                v-bind="props.message.bodyTemplateProps"
                :buffer="props.ml.buffer"
                :message="props.message"
                :idx="props.idx"
                :ml="props.ml"
                class="kiwi-messagelist-body"
            />
            <div
                v-else
                class="kiwi-messagelist-body"
                v-html="props.ml.formatMessage(props.message)"
            />
            <component
                :is="injections.components.MessageActions"
                v-if="props.m().canReply(props.message) && props.message.irc_id && props.m().getNetwork().hasCap('message-tags')"
                :message="props.message"
                :buffer="props.ml.buffer"
                layout="inline"
                class="kiwi-messagelist-actions"
            />
        </div>

        <component
            :is="injections.components.MessageInfo"
            v-if="props.ml.message_info_open === props.message"
            :message="props.message"
            :buffer="props.ml.buffer"
            @close="props.ml.toggleMessageInfo()"
        />

        <div v-if="props.message.embed.payload && props.ml.shouldAutoEmbed">
            <component
                :is="injections.components.MediaViewer"
                :url="props.message.embed.payload"
                :show-pin="true"
                @close="props.message.embed.payload = ''"
                @pin="props.ml.openEmbedInPreview(props.message)"
            />
        </div>
    </div>
</template>

<script>

import MediaViewer from './MediaViewer';
import MessageInfo from './MessageInfo';
import MessageActions from './MessageActions';

const methods = {
    props: {},
    getNetwork() {
        let props = this.props;
        return props.ml.buffer.getNetwork();
    },
    displayNick() {
        let props = this.props;
        let suffix = props.message.nick ?
            ':' :
            '';

        return props.message.nick + suffix;
    },
    userMode(user) {
        let props = this.props;
        return props.ml.buffer.userMode(user);
    },
    userModePrefix(user) {
        let props = this.props;
        return props.ml.buffer.userModePrefix(user);
    },
    getReplyMessage(replyId) {
        let props = this.props;
        return props.ml.buffer.messagesObj.messageIds[replyId];
    },
    canReply(message) {
        let types = ['privmsg', 'action', 'message'];
        return types.indexOf(message.type) > -1;
    },
};

export default {
    inject: {
        components: {
            default: {
                MessageInfo,
                MediaViewer,
                MessageActions,
            },
        },
    },
    props: {
        ml: Object,
        message: Object,
        idx: Number,
        m: {
            default: function m() {
                // vue uses this function to generate the prop. `this`==null Return our own function
                return function n() {
                    // Give our methods some props context before its function is called.
                    // This is only safe because the function on the methods object is called on
                    // the same js tick
                    methods.props = this;
                    return methods;
                };
            },
        },
    },
};
</script>

<style lang="less" scoped>

.kiwi-messagelist-message--text {
    position: relative;
    padding: 4px 10px;
    margin: 0;
    text-align: left;
    padding-right: 15px;
}

.kiwi-messagelist-message--no-timestamps.kiwi-messagelist-message--text {
    padding-right: 15px;
}

//Hide the timestamp unless the user hovers over the message in question
.kiwi-messagelist-message--text .kiwi-messagelist-time {
    position: absolute;
    top: 0;
    right: 0;
    padding: 0 10px;
    display: none;
    opacity: 0.8;
}

//display timestamp when hovering over the message
.kiwi-messagelist-message--text:hover .kiwi-messagelist-time {
    display: block;
    border-radius: 5px 0 0 5px;
}

// Hide the unread message seperator
.kiwi-messagelist-message--text .kiwi-messagelist-seperator {
    display: none;
}

.kiwi-messagelist-message--text .kiwi-messagelist-nick {
    display: inline;
    text-align: left;
    margin-right: 2px;
    padding: 0;
}

.kiwi-messagelist-message--text .kiwi-messagelist-nick:hover {
    max-width: none;
    width: auto;
}

.kiwi-messagelist-message--text .kiwi-messagelist-body {
    display: inline;
    padding: 0;
    white-space: pre-wrap;
}

.kiwi-messagelist-reply-preview {
    display: block;
    font-size: 0.85em;
    opacity: 0.7;
    margin-bottom: 4px;
    margin-top: 5px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-left: 2px solid;
    padding-left: 8px;
    width: auto;

    &:hover {
        opacity: 1;
    }

    .fa-reply {
        margin-right: 5px;
    }

    .kiwi-messagelist-reply-preview-nick {
        font-weight: bold;
        margin-right: 5px;
    }
}

.kiwi-messagelist-actions {
    display: none;
    position: absolute;
    right: 72px;
    top: 2px;
}

.kiwi-messagelist-message--no-timestamps .kiwi-messagelist-actions {
    right: 10px;
}

.kiwi-messagelist-message--text:hover {
    z-index: 100;
}

.kiwi-messagelist-message--text:hover .kiwi-messagelist-actions {
    display: block;
}

.kiwi-messagelist-message--text:hover {
    padding-right: 115px;
}

.kiwi-messagelist-message--no-timestamps.kiwi-messagelist-message--text:hover {
    padding-right: 45px;
}

.kiwi-messagelist-message--text .kiwi-messagelist-body a {
    word-break: break-all;
}

.kiwi-messagelist-message--text .kiwi-messagelist-message-privmsg:hover,
.kiwi-messagelist-message--text .kiwi-messagelist-message-action:hover,
.kiwi-messagelist-message--text .kiwi-messagelist-message-notice:hover {
    cursor: pointer;
}

//Channel topic
.kiwi-messagelist-message--text.kiwi-messagelist-message-topic {
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    margin: 10px 0;
}

.kiwi-messagelist-message--text.kiwi-messagelist-message-topic .kiwi-messagelist-body {
    padding-right: 0;
    max-width: 95%;
    margin-left: 20px;
}

.kiwi-messagelist-message--text.kiwi-messagelist-message--unread {
    opacity: 1;
}

.kiwi-messagelist-message--text .kiwi-messagelist-message-traffic .kiwi-messagelist-nick {
    display: none;
}

.kiwi-messagelist-item:last-of-type {
    margin-bottom: 5px;
}

.kiwi-messagelist-message--text.kiwi-messagelist-message-nick .kiwi-messagelist-nick {
    display: none;
}

@media screen and (max-width: 700px) {
    .kiwi-messagelist-message--text.kiwi-messagelist-message-traffic,
    .kiwi-messagelist-message--text.kiwi-messagelist-message-nick .kiwi-messagelist-body,
    .kiwi-messagelist-message--text .kiwi-messagelist-body {
        padding-right: 0;
    }
}

</style>
