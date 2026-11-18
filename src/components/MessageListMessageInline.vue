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
            props.ml.isTemporaryHighlighted(props.message)
                ? 'kiwi-messagelist-message--temporary-highlight'
                : '',
            props.ml.isHoveringOverMessage(props.message)
                ? 'kiwi-messagelist-message--hover'
                : '',
            props.ml.buffer.last_read && props.message.time > props.ml.buffer.last_read
                ? 'kiwi-messagelist-message--unread'
                : '',
            props.ml.isSelfNick(props.message.nick)
                ? 'kiwi-messagelist-message--own'
                : '',
            props.ml.message_info_open === props.message
                ? 'kiwi-messagelist-message--info-open'
                : '',
            props.ml.message_info_open && props.ml.message_info_open !== props.message
                ? 'kiwi-messagelist-message--blur'
                : '',
            props.message.is_pending
                ? 'kiwi-messagelist-message--pending'
                : '',
            props.message.is_redacted
                ? 'kiwi-messagelist-message--redacted'
                : '',
            (props.message.user && props.m().userMode(props.message.user))
                ? `kiwi-messagelist-message--user-mode-${props.m().userMode(props.message.user)}`
                : '',
            !props.ml.bufferSetting('show_timestamps')
                ? 'kiwi-messagelist-message--no-timestamps'
                : '',
            props.ml.bufferSetting('show_timestamps') && props.ml.usesWideTimestamp()
                ? 'kiwi-messagelist-message--wide-timestamp'
                : '',
            data.staticClass,
        ]"
        :data-message-id="props.message.id"
        :data-nick="(props.message.nick || '').toLowerCase()"
        class="kiwi-messagelist-message kiwi-messagelist-message--text"
        @click="props.ml.onMessageClick($event, props.message, true)"
        @auxclick="props.ml.onMessageAuxClick($event)"
        @dblclick="props.ml.onMessageDblClick($event, props.message)"
    >
        <div>
            <div v-if="props.m().shouldShowReplyPreview()" class="kiwi-messagelist-reply-preview" @click="props.ml.maybeScrollToId(props.message.reply)">
                <i class="bx bx-reply" aria-hidden="true" />
                <span v-if="props.m().getReplyMessage(props.message.reply)" class="kiwi-messagelist-reply-preview-nick">
                    <emoji-text
                        :text="props.ml.displayNickFor(
                            props.m().getReplyMessage(props.message.reply)
                        )"
                    />:
                </span>
                <span v-if="props.m().getReplyMessage(props.message.reply)" class="kiwi-messagelist-reply-preview-message">
                    <emoji-text :text="props.m().getReplyMessageText(props.message.reply)" />
                </span>
                <span v-else class="kiwi-messagelist-reply-preview-id">
                    {{ props.message.reply }}
                </span>
            </div>
            <div class="kiwi-messagelist-inline-meta">
                <component
                    :is="injections.components.MessageActions"
                    v-if="props.m().canReply(props.message) && props.message.irc_id && props.m().getNetwork() && props.m().getNetwork().hasCap('message-tags') && !props.message.is_redacted"
                    :message="props.message"
                    :buffer="props.ml.buffer"
                    layout="inline"
                    class="kiwi-messagelist-actions"
                />
                <span
                    v-if="props.ml.bufferSetting('show_timestamps')"
                    class="kiwi-messagelist-time"
                >
                    {{ props.ml.formatTime(props.message.time) }}
                </span>
            </div>
            <span v-if="props.message.is_bot" :title="props.ml.$t('bot')" class="kiwi-messagelist-nick-bot"><i class="bx bx-bot" aria-hidden="true" /></span>
            <span
                v-if="props.message.is_oper && !props.message.is_bot"
                :title="props.ml.$t('operator')"
                class="kiwi-messagelist-nick-oper"
            ><i class="bx bx-lock-alt" aria-hidden="true" /></span>
            <span
                v-if="props.message.is_rerouted"
                :title="props.ml.$t('rerouted')"
                class="kiwi-messagelist-nick-rerouted"
            >⤮</span><span
                :style="{ color: props.ml.userColourFor(props.message) }"
                :title="props.message.user
                    ? props.message.user.displayTooltip()
                    : props.message.nick"
                :class="[
                    'kiwi-messagelist-nick',
                    !props.message.bridged_nick
                        && props.message.user
                        && props.m().userMode(props.message.user)
                        ? `kiwi-messagelist-nick--mode-${props.m().userMode(props.message.user)}`
                        : '',
                ]"
                :data-nick="(props.message.nick || '').toLowerCase()"
                @mouseover="props.ml.hover_nick = props.message.nick.toLowerCase();"
                @mouseout="props.ml.hover_nick = '';"
            >
                <span
                    v-if="!props.message.bridged_nick"
                    class="kiwi-messagelist-nick--prefix"
                >{{ props.message.user
                    ? props.m().userModePrefix(props.message.user)
                    : '' }}</span><a
                    :style="{ color: props.ml.userColourFor(props.message) }"
                    :data-nick="(props.message.nick || '').toLowerCase()"
                    class="kiwi-messagelist-nick-link"
                ><emoji-text :text="props.m().displayNick()" /></a>
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
                :is="injections.components.MessageReactions"
                :message="props.message"
                :buffer="props.ml.buffer"
            />
            <div v-if="props.message.embed.payload && props.ml.shouldAutoEmbed" class="kiwi-messagelist-embed">
                <component
                    :is="injections.components.MediaViewer"
                    :url="props.message.embed.payload"
                    :show-pin="true"
                    @close="props.message.embed.payload = ''"
                    @pin="props.ml.openEmbedInPreview(props.message)"
                />
            </div>
        </div>

        <component
            :is="injections.components.MessageInfo"
            v-if="props.ml.message_info_open === props.message"
            :message="props.message"
            :buffer="props.ml.buffer"
            @close="props.ml.toggleMessageInfo()"
        />
    </div>
</template>

<script>

import MediaViewer from './MediaViewer';
import * as Misc from '@/helpers/Misc';
import MessageInfo from './MessageInfo';
import MessageReactions from './MessageReactions';
import MessageActions from './MessageActions';

const methods = {
    props: {},
    getNetwork() {
        let props = this.props;
        return props.network || props.ml.buffer.getNetwork();
    },
    shouldShowReplyPreview() {
        let props = this.props;

        if (typeof props.showReplyPreview === 'boolean') {
            return props.showReplyPreview;
        }

        return props.ml.shouldShowReplyPreview(props.message, props.idx);
    },
    displayNick() {
        let props = this.props;
        let suffix = props.message.nick ?
            ': ' :
            '';

        let nick = props.ml.displayNickFor(props.message);

        return nick + suffix;
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
        const network = this.getNetwork();
        const resolved = network && network.resolveMessage(replyId, props.ml.buffer);
        return resolved ? resolved.message : null;
    },
    getReplyMessageText(replyId) {
        let props = this.props;
        let m = props.m().getReplyMessage(replyId);
        return m ? Misc.stripStyles(m.message) : '';
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
                MessageReactions,
                MessageActions,
            },
        },
    },
    props: {
        ml: Object,
        message: Object,
        idx: Number,
        network: Object,
        showWithoutUser: Boolean,
        showRealNames: Boolean,
        showHostNames: Boolean,
        hasExtendedJoin: Boolean,
        showReplyPreview: {
            type: Boolean,
            default: null,
        },
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

// Keep the action button and timestamp together at the right edge.
.kiwi-messagelist-inline-meta {
    display: none;
    position: absolute;
    top: 0;
    right: 0;
    align-items: center;
    gap: 6px;
}

.kiwi-messagelist-message--text:hover .kiwi-messagelist-inline-meta {
    display: flex;
}

.kiwi-messagelist-message--no-timestamps .kiwi-messagelist-inline-meta {
    right: 10px;
}

.kiwi-messagelist-message--text .kiwi-messagelist-time {
    position: static;
    top: auto;
    right: auto;
    flex: 0 0 auto;
    font-variant-numeric: tabular-nums;
    opacity: 0.8;
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

.kiwi-messagelist-message--text .kiwi-messagelist-nick-link {
    color: inherit;
    text-decoration: none;
}

.kiwi-messagelist-nick-bot,
.kiwi-messagelist-nick-oper,
.kiwi-messagelist-nick-rerouted {
    font-size: 1.1em;
}

.kiwi-messagelist-message--text .kiwi-messagelist-body {
    display: inline;
    padding: 0;
    white-space: pre-wrap;
}

.kiwi-messagelist-message--text .kiwi-messagelist-body.kiwi-bridge-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 0;
    white-space: normal;
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

    .bx-reply {
        margin-right: 5px;
    }

    .kiwi-messagelist-reply-preview-nick {
        font-weight: bold;
        margin-right: 5px;
    }
}

.kiwi-messagelist-actions {
    flex: 0 0 auto;
}

.kiwi-messagelist-message--text:hover {
    z-index: 100;
}

.kiwi-messagelist-message--text:hover {
    padding-right: 110px;
}

.kiwi-messagelist-message--text.kiwi-messagelist-message--wide-timestamp:hover {
    padding-right: 130px;
}

.kiwi-messagelist-message--no-timestamps.kiwi-messagelist-message--text:hover {
    padding-right: 40px;
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
