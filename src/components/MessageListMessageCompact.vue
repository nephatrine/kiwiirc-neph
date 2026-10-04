<template functional>
    <div
        :class="[
            props.m().isRepeat()
                ? 'kiwi-messagelist-message--authorrepeat'
                : 'kiwi-messagelist-message--authorfirst',
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
        class="kiwi-messagelist-message kiwi-messagelist-message--compact"
        @click="props.ml.onMessageClick($event, props.message, true)"
        @dblclick="props.ml.onMessageDblClick($event, props.message)"
    >
        <div
            v-if="props.ml.bufferSetting('show_timestamps')"
            :title="props.ml.formatTimeFull(props.message.time)"
            class="kiwi-messagelist-time"
        >
            {{ props.ml.formatTime(props.message.time) }}
        </div>
        <a
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
            <component
                :is="injections.components.AwayStatusIndicator"
                v-if="props.message.user"
                :network="props.m().getNetwork()" :user="props.message.user"
                :toggle="false"
            />
            <span class="kiwi-messagelist-nick--prefix">
                {{ props.message.user ? props.m().userModePrefix(props.message.user) : '' }}
            </span>
            {{ props.message.nick }}
        </a>

        <div class="kiwi-messagelist-body-container">
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
            <div v-else class="kiwi-messagelist-body" v-html="props.ml.formatMessage(props.message)" />
        </div>

        <component
            :is="injections.components.MessageActions"
            v-if="props.m().canReply(props.message) && props.message.irc_id && props.m().getNetwork().hasCap('message-tags')"
            :message="props.message"
            :buffer="props.ml.buffer"
            layout="compact"
            class="kiwi-messagelist-actions"
        />

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
'kiwi public';

// eslint-plugin-vue's max-len rule reads the entire file, including the CSS. so we can't use this
// here as some of the rules cannot be broken up any smaller
/* eslint-disable max-len */

import MediaViewer from './MediaViewer';
import AwayStatusIndicator from './AwayStatusIndicator';
import MessageInfo from './MessageInfo';
import MessageActions from './MessageActions';

const methods = {
    props: {},
    getNetwork() {
        let props = this.props;
        return props.ml.buffer.getNetwork();
    },
    isRepeat() {
        let props = this.props;
        let ml = props.ml;
        let idx = props.idx;
        let message = props.message;
        let prevMessage = ml.filteredMessages[idx - 1];

        return !!prevMessage &&
            prevMessage.nick === message.nick &&
            message.time - prevMessage.time < 60000 &&
            prevMessage.type !== 'traffic' &&
            message.type !== 'traffic' &&
            message.type === prevMessage.type;
    },
    isHoveringOverMessage(message) {
        let props = this.props;
        return message.nick && message.nick.toLowerCase() === props.hover_nick.toLowerCase();
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
        return props.ml.buffer.messagesObj.messages.find((m) => m.id === replyId);
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
                AwayStatusIndicator,
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

.kiwi-messagelist-message--compact {
    position: relative;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-message-privmsg:hover,
.kiwi-messagelist-message--compact .kiwi-messagelist-message-action:hover,
.kiwi-messagelist-message--compact .kiwi-messagelist-message-notice:hover {
    cursor: pointer;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-message--blur {
    opacity: 0.5;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-nick {
    width: 110px;
    min-width: 110px;
    display: inline-block;
    left: 8px;
    top: -1px;
    position: absolute;
    white-space: nowrap;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-nick:hover {
    width: auto;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-time {
    display: inline-block;
    position: absolute;
    right: 10px;
    top: 2px;
    font-size: 12px;
    opacity: 0.8;
}

.kiwi-messagelist-body-container {
    display: block;
    margin-left: 120px;
    padding-right: 90px;
}

.kiwi-messagelist-message--no-timestamps .kiwi-messagelist-body-container {
    padding-right: 45px;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-body {
    display: block;
    white-space: pre-wrap;
    word-wrap: break-word;
}

.kiwi-messagelist-message--compact .kiwi-messagelist-body a {
    word-break: break-all;
}

.kiwi-messagelist-message--compact .kiwi-messageinfo {
    padding-left: 100px; /* 130px */
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

.kiwi-messagelist-message--compact:hover {
    z-index: 100;
}

.kiwi-messagelist-message--compact:hover .kiwi-messagelist-actions {
    display: block;
}

//Channel traffic messages
.kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic {
    margin: 0;
    padding: 1px 0;
}

.kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic .kiwi-messagelist-body-container {
    margin-left: 131px;
}

//Channel topic
.kiwi-messagelist-message--compact.kiwi-messagelist-message-topic {
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    margin: 1em 0;
}

.kiwi-messagelist-message--compact.kiwi-messagelist-message-topic .kiwi-messagelist-body-container {
    padding-right: 0;
    max-width: 95%;
    margin-left: 20px;
}

//Repeat messages, remove the time and author name
.kiwi-messagelist-message--compact.kiwi-messagelist-message--authorrepeat {
    .kiwi-messagelist-time,
    .kiwi-messagelist-nick {
        display: none;
    }
}

// Traffic messages have an opacity lower than 1, so we do a blanket statment to make sure all
// messages are opacity: 1, rather than just specifying one.
.kiwi-messagelist-message--compact.kiwi-messagelist-message--unread {
    opacity: 1;
}

// Mobile layout (matches this.$state.ui.is_narrow)
@media screen and (max-width: 769px) {
    .kiwi-messagelist-message--compact {
        padding: 5px;
    }

    .kiwi-messagelist-message--compact .kiwi-messagelist-nick {
        display: inline;
        width: auto;
        min-width: auto;
        float: left;
        position: static;
        padding-left: 0;
    }

    .kiwi-messagelist-message--compact .kiwi-messagelist-time {
        text-align: right;
    }

    .kiwi-messagelist-message--compact .kiwi-messagelist-body-container {
        float: left;
        width: 100%;
        margin-left: 0;
        box-sizing: border-box;
        padding-right: 130px;
    }

    .kiwi-messagelist-message--no-timestamps .kiwi-messagelist-body-container {
        padding-right: 60px;
    }

    .kiwi-messagelist-message--compact.kiwi-messagelist-message--unread .kiwi-messagelist-body-container {
        padding-left: 10px;
    }

    .kiwi-messagelist-message--compact .kiwi-messagelist-message--authorrepeat .kiwi-messagelist-nick {
        display: none;
    }

    .kiwi-messagelist-message--compact .kiwi-messageinfo {
        padding-left: 2px;
    }

    .kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic .kiwi-messagelist-body-container {
        margin-left: 0;
    }

    .kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic {
        margin-left: 10px;
    }

    .kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic.kiwi-messagelist-message--unread {
        margin-left: 0;
        padding-left: 10px;
    }
}

.kiwi-messagelist-message--compact .kiwi-messagelist-message-traffic .kiwi-messagelist-nick {
    display: none;
}

.kiwi-messagelist-item:last-of-type {
    margin-bottom: 5px;
}

// Moderate screen size
// Give more space to the nickname column on larger screens
@media screen and (min-width: 1000px) {
    // Nicknames
    .kiwi-messagelist-message--compact .kiwi-messagelist-nick {
        width: 160px;
        min-width: 160px;
    }

    .kiwi-messagelist-message--compact .kiwi-messagelist-nick:hover {
        width: auto;
    }

    // Messages
    .kiwi-messagelist-message--compact .kiwi-messagelist-body-container {
        margin-left: 170px;
    }

    .kiwi-messagelist-message--compact .kiwi-messageinfo {
        padding-left: 180px;
    }

    .kiwi-messagelist-message--compact.kiwi-messagelist-message-traffic .kiwi-messagelist-body-container {
        margin-left: 181px;
    }
}

</style>
