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
            props.ml.isEmojiOnlyMessage(props.message)
                ? 'kiwi-messagelist-message--emoji-only'
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
            props.m().isMessage(props.message)
                && props.ml.bufferSetting('show_timestamps')
                && props.ml.usesWideTimestamp()
                ? 'kiwi-messagelist-message--wide-timestamp'
                : '',
            data.staticClass,
        ]"
        :data-message-id="props.message.id"
        :data-nick="(props.message.nick || '').toLowerCase()"
        class="kiwi-messagelist-message kiwi-messagelist-message--cyberdeck"
        @click="props.ml.onMessageClick($event, props.message, true)"
        @auxclick="props.ml.onMessageAuxClick($event)"
        @dblclick="props.ml.onMessageDblClick($event, props.message)"
    >
        <div class="kiwi-messagelist-cyberdeck-gutter">
            <div
                v-if="props.m().isMessage(props.message)
                    && props.ml.bufferSetting('show_timestamps')"
                :title="props.ml.formatTimeFull(props.message.time)"
                class="kiwi-messagelist-time kiwi-messagelist-cyberdeck-time"
            >
                {{ props.ml.formatTime(props.message.time) }}
            </div>
            <div
                v-if="props.m().displayAvatar(props.message)"
                class="kiwi-messagelist-cyberdeck-avatar"
            >
                <component
                    :is="injections.components.UserAvatar"
                    :data-nick="props.message.nick"
                    :user="props.message.user"
                    :network="props.network || props.m().getNetwork()"
                    :message="props.message"
                    shape="square"
                />
            </div>
            <span
                v-else
                class="kiwi-messagelist-cyberdeck-marker"
                aria-hidden="true"
            />
        </div>
        <div class="kiwi-messagelist-cyberdeck-content">
            <div v-if="props.m().shouldShowReplyPreview()" class="kiwi-messagelist-reply-preview" @click="props.m().scrollToReply(props.message.reply)">
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
            <div class="kiwi-messagelist-top kiwi-messagelist-cyberdeck-header">
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
                >⤮</span><a
                    v-if="props.message.nick"
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
                    :data-nick="(props.message.nick).toLowerCase()"
                    @mouseover="props.ml.hover_nick = props.message.nick.toLowerCase();"
                    @mouseout="props.ml.hover_nick = '';"
                >
                    <span v-if="!props.message.bridged_nick" class="kiwi-messagelist-nick-prefix">{{
                        props.message.user
                            ? props.m().userModePrefix(props.message.user)
                            : ''
                    }}</span><emoji-text :text="props.ml.displayNickFor(props.message)" />
                </a>
                <div
                    v-if="props.m().showRealName() || props.m().showHostName()"
                    class="kiwi-messagelist-realname"
                    @click="props.m().onRealnameClick($event)"
                    @mouseover="props.ml.hover_nick = props.message.nick.toLowerCase();"
                    @mouseout="props.ml.hover_nick = '';"
                >
                    <span
                        v-if="props.m().showRealName()"
                        v-html="props.m().realnameHtml()"
                    />
                    <span v-else>{{ props.m().hostName() }}</span>
                </div>
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

            <component
                :is="injections.components.MessageActions"
                v-if="props.m().canReply(props.message) && props.message.irc_id && props.m().getNetwork() && props.m().getNetwork().hasCap('message-tags') && !props.message.is_redacted"
                :message="props.message"
                :buffer="props.ml.buffer"
                layout="cyberdeck"
                class="kiwi-messagelist-actions"
            />

            <component
                :is="injections.components.MessageInfo"
                v-if="props.ml.message_info_open === props.message"
                :message="props.message"
                :buffer="props.ml.buffer"
                @close="props.ml.toggleMessageInfo()"
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
    </div>
</template>

<script>
'kiwi public';

import { urlRegex } from '@/helpers/TextFormatting';
import { ircToHtml } from '@/helpers/IrcToHtml';
import { messageHostName, shouldShowHostName } from '@/helpers/MessageAuthor';
import { shouldDisplayAvatar } from '@/helpers/MessageAvatar';
import { isConsecutiveMessage } from '@/libs/bufferTools';
import * as Misc from '@/helpers/Misc';
import MessageInfo from './MessageInfo';
import AwayStatusIndicator from './AwayStatusIndicator';
import UserAvatar from './UserAvatar';
import MediaViewer from './MediaViewer';
import MessageReactions from './MessageReactions';
import MessageActions from './MessageActions';

const methods = {
    props: {},
    showRealName() {
        let props = this.props;

        // Showing realname is not enabled
        if (!props.showRealNames) {
            return false;
        }

        // Server does not support extended-join so realname would be inconsistent
        if (!props.hasExtendedJoin) {
            return false;
        }

        // We dont have a user or users realname
        if (!props.message.user || !props.message.user.realname) {
            return false;
        }

        // No point showing the realname if it's the same as the nick
        if (props.message.user.nick.toLowerCase() === props.message.user.realname.toLowerCase()) {
            return false;
        }

        // If the realname contains a URL it's most likely a clients website
        if (urlRegex.test(props.message.user.realname)) {
            return false;
        }

        return true;
    },
    realnameHtml() {
        let props = this.props;
        return ircToHtml(props.message.user && props.message.user.realname);
    },
    showHostName() {
        let props = this.props;
        return shouldShowHostName(props.message, props.ml.buffer, {
            showRealNames: props.showRealNames,
            showHostNames: props.showHostNames,
        });
    },
    hostName() {
        let props = this.props;
        return messageHostName(props.message);
    },
    onRealnameClick(event) {
        let props = this.props;
        let target = event.target;

        // Let links inside the formatted realname keep their own click action.
        if (target && typeof target.closest === 'function' && target.closest('a')) {
            return;
        }

        props.ml.openUserBox(props.message.nick);
    },
    getNetwork() {
        let props = this.props;
        return props.network || props.ml.buffer.getNetwork();
    },
    isRepeat() {
        let props = this.props;

        if (typeof props.repeat === 'boolean') {
            return props.repeat;
        }

        return isConsecutiveMessage(
            props.ml.filteredMessages[props.idx - 1],
            props.message
        );
    },
    shouldShowReplyPreview() {
        let props = this.props;

        if (typeof props.showReplyPreview === 'boolean') {
            return props.showReplyPreview;
        }

        return props.ml.shouldShowReplyPreview(props.message, props.idx);
    },
    isHoveringOverMessage(message) {
        let props = this.props;
        return props.ml.isHoveringOverMessage(message);
    },
    isMessage(message) {
        let types = ['privmsg', 'action', 'notice', 'message'];
        return types.indexOf(message.type) > -1;
    },
    displayAvatar(message) {
        let props = this.props;
        return shouldDisplayAvatar(message, props.ml.buffer, {
            showWithoutUser: props.showWithoutUser,
            repeat: this.isRepeat(),
        });
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
    scrollToReply(replyId) {
        let props = this.props;
        props.ml.maybeScrollToId(replyId);
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
                UserAvatar,
                MessageInfo,
                AwayStatusIndicator,
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
        showWithoutUser: Boolean,
        showRealNames: Boolean,
        showHostNames: Boolean,
        network: Object,
        hasExtendedJoin: Boolean,
        repeat: {
            type: Boolean,
            default: null,
        },
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

.kiwi-messagelist-message--cyberdeck {
    --kiwi-cyberdeck-gutter: 64px;
    --kiwi-cyberdeck-avatar-size: 40px;
    --kiwi-cyberdeck-gap: 0;
    --kiwi-cyberdeck-line: var(--brand-midtone, rgb(128 128 128 / 35%));
    --kiwi-cyberdeck-rail: var(--brand-midtone, rgb(128 128 128 / 35%));
    --kiwi-cyberdeck-accent: var(--brand-primary, currentColor);
    --kiwi-cyberdeck-panel: transparent;
    --kiwi-cyberdeck-time: var(--brand-default-fg, inherit);
    --kiwi-cyberdeck-radius: 2px;

    display: grid;
    grid-template-columns: var(--kiwi-cyberdeck-gutter) minmax(0, 1fr);
    column-gap: var(--kiwi-cyberdeck-gap);
    border-left: 3px solid transparent;
    padding: 1px 10px 1px 0;
    line-height: 1.45;
    transition: border-color 0.2s, background-color 0.2s;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--wide-timestamp {
    --kiwi-cyberdeck-gutter: 80px;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--authorfirst {
    padding-top: 9px;
    padding-bottom: 4px;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--authorrepeat {
    border-top: none;
    padding-top: 1px;
    padding-bottom: 1px;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--authorrepeat .kiwi-messagelist-cyberdeck-header {
    display: none;
}

.kiwi-messagelist-cyberdeck-gutter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding-top: 2px;
    user-select: none;
}

.kiwi-messagelist-cyberdeck-gutter::before {
    content: '';
    position: absolute;
}

.kiwi-messagelist-cyberdeck-time {
    position: relative;
    z-index: 1;
    color: var(--kiwi-cyberdeck-time);
    font-family: var(--kiwi-font-mono, monospace);
    font-size: 0.68em;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
    line-height: 1.2;
    opacity: 0.68;
    padding: 0 2px;
    white-space: nowrap;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--authorrepeat .kiwi-messagelist-cyberdeck-time {
    opacity: 0.56;
}

.kiwi-messagelist-cyberdeck-avatar {
    position: relative;
    z-index: 1;
    width: var(--kiwi-cyberdeck-avatar-size);
    height: var(--kiwi-cyberdeck-avatar-size);
    border: 1px solid var(--kiwi-cyberdeck-line);
    border-radius: var(--kiwi-cyberdeck-radius);
    background: var(--kiwi-cyberdeck-panel);
    box-sizing: border-box;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 18%);
}

.kiwi-messagelist-cyberdeck-avatar .kiwi-avatar {
    display: block;
    width: 100%;
    height: 100%;
    cursor: pointer;
}

.kiwi-messagelist-cyberdeck-marker {
    position: relative;
    z-index: 1;
    width: 6px;
    height: 6px;
    margin-top: 3px;
    border: 1px solid var(--kiwi-cyberdeck-line);
    border-radius: 1px;
    background: var(--kiwi-cyberdeck-accent);
    opacity: 0.55;
}

.kiwi-messagelist-cyberdeck-content {
    position: relative;
    min-width: 0;
    padding: 2px 0 8px 2px;
    box-sizing: border-box;
    transition: padding-right 0.2s ease;
}

.kiwi-messagelist-cyberdeck-header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    min-height: 1.35em;
    margin-bottom: 2px;
}

.kiwi-messagelist-cyberdeck-header > div {
    display: inline-block;
    margin: 0;
    padding: 0;
}

.kiwi-messagelist-cyberdeck-header .kiwi-messagelist-nick {
    padding: 0;
    margin: 0;
    overflow: visible;
    text-align: left;
    letter-spacing: 0.02em;
    word-break: normal;
}

.kiwi-messagelist-cyberdeck-header .kiwi-messagelist-realname {
    max-width: 100%;
    overflow: hidden;
    cursor: pointer;
    font-size: 0.85em;
    opacity: 0.62;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.kiwi-messagelist-message--cyberdeck .kiwi-messagelist-body {
    display: block;
    margin: 0;
    padding: 5px 9px 6px;
    border-left: 2px solid var(--kiwi-cyberdeck-rail);
    background: var(--kiwi-cyberdeck-panel);
    line-height: 1.45;
    white-space: pre-wrap;
    word-wrap: break-word;
}

.kiwi-messagelist-message--cyberdeck .kiwi-messagelist-body a {
    word-break: break-word;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--emoji-only .kiwi-messagelist-body {
    padding-left: 0;
    border-left: 0;
    background: transparent;
    font-size: 2.6em;
    line-height: 1.25;
}

.kiwi-messagelist-message--cyberdeck .kiwi-messagelist-embed {
    margin: 4px 0 0 10px;
}

.kiwi-messagelist-message--cyberdeck .kiwi-messagelist-reply-preview {
    display: block;
    width: 100%;
    margin: 0 0 4px;
    padding-left: 8px;
    border-left: 2px solid var(--kiwi-cyberdeck-line);
    cursor: pointer;
    font-size: 0.82em;
    opacity: 0.68;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.kiwi-messagelist-message--cyberdeck .kiwi-messagelist-reply-preview:hover {
    opacity: 1;
}

.kiwi-messagelist-message--cyberdeck .kiwi-messagelist-reply-preview .bx-reply {
    margin-right: 5px;
}

.kiwi-messagelist-message--cyberdeck .kiwi-messagelist-reply-preview-nick {
    margin-right: 5px;
    font-weight: bold;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--own {
    border-left-color: var(--kiwi-cyberdeck-accent);
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--own .kiwi-messagelist-cyberdeck-content {
    border-left-color: var(--kiwi-cyberdeck-accent);
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--own .kiwi-messagelist-body {
    border-left-color: var(--kiwi-cyberdeck-accent);
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--highlight {
    border-left-color: var(--kiwi-cyberdeck-accent);
    background: rgb(127 127 127 / 8%);
}

.kiwi-messagelist-message--cyberdeck:hover {
    z-index: 100;
}

.kiwi-messagelist-message--cyberdeck:hover .kiwi-messagelist-cyberdeck-content {
    padding-right: 42px;
}

.kiwi-messagelist-message--cyberdeck .kiwi-messagelist-actions {
    position: absolute;
    top: 1px;
    right: 6px;
    z-index: 100;
    display: none;
}

.kiwi-messagelist-message--cyberdeck:hover .kiwi-messagelist-actions {
    display: block;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--authorrepeat .kiwi-messagelist-actions {
    top: 1px;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-traffic,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-mode,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-system,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-error {
    display: block;
    margin: 0;
    padding: 5px 10px 5px 0;
    text-align: left;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-traffic .kiwi-messagelist-cyberdeck-gutter,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-mode .kiwi-messagelist-cyberdeck-gutter,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-system .kiwi-messagelist-cyberdeck-gutter,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-error .kiwi-messagelist-cyberdeck-gutter {
    display: none;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-traffic .kiwi-messagelist-cyberdeck-content,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-mode .kiwi-messagelist-cyberdeck-content,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-system .kiwi-messagelist-cyberdeck-content,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-error .kiwi-messagelist-cyberdeck-content {
    padding-left: 10px;
    border-left: 0;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-traffic .kiwi-messagelist-body,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-mode .kiwi-messagelist-body,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-system .kiwi-messagelist-body,
.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-error .kiwi-messagelist-body {
    padding: 0 4px;
    border-left: 0;
    background: transparent;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-topic {
    display: block;
    width: auto;
    margin: 14px 12px;
    padding: 7px 12px;
    border: 1px solid var(--kiwi-cyberdeck-line);
    border-left: 3px solid var(--kiwi-cyberdeck-accent);
    border-radius: 0;
    background: var(--kiwi-cyberdeck-panel);
    box-sizing: border-box;
    text-align: left;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-topic .kiwi-messagelist-cyberdeck-gutter {
    display: none;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-topic .kiwi-messagelist-cyberdeck-content {
    padding: 0;
    border-left: 0;
}

.kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-topic .kiwi-messagelist-body {
    padding: 0;
    border-left: 0;
    background: transparent;
}

@media screen and (max-width: 769px) {
    .kiwi-messagelist-message--cyberdeck {
        --kiwi-cyberdeck-gutter: 50px;
        --kiwi-cyberdeck-avatar-size: 32px;
        --kiwi-cyberdeck-gap: 0;

        padding-right: 6px;
    }

    .kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message--wide-timestamp {
        --kiwi-cyberdeck-gutter: 66px;
    }

    .kiwi-messagelist-cyberdeck-time {
        font-size: 0.6em;
    }

    .kiwi-messagelist-cyberdeck-content {
        padding-left: 7px;
    }

    .kiwi-messagelist-message--cyberdeck:hover .kiwi-messagelist-cyberdeck-content {
        padding-right: 38px;
    }

    .kiwi-messagelist-message--cyberdeck.kiwi-messagelist-message-topic {
        margin: 12px 8px;
    }
}

</style>
