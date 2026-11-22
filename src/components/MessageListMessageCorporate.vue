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
            props.m().isOwnMessage(props.message)
                ? 'kiwi-messagelist-message--own'
                : '',
            props.message.bridge_card
                ? 'kiwi-messagelist-message--bridge-card'
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
            data.staticClass,
        ]"
        :data-message-id="props.message.id"
        :data-nick="(props.message.nick || '').toLowerCase()"
        class="kiwi-messagelist-message kiwi-messagelist-message--corporate"
        @click="props.ml.onMessageClick($event, props.message, true)"
        @auxclick="props.ml.onMessageAuxClick($event)"
        @dblclick="props.ml.onMessageDblClick($event, props.message)"
    >
        <div class="kiwi-messagelist-corporate-avatar">
            <component
                :is="injections.components.UserAvatar"
                v-if="props.m().displayAvatar(props.message)"
                :data-nick="props.message.nick"
                :user="props.message.user"
                :network="props.network || props.m().getNetwork()"
                :message="props.message"
                size="small"
            />
        </div>
        <div class="kiwi-messagelist-corporate-main">
            <div
                v-if="!props.m().isRepeat()"
                class="kiwi-messagelist-corporate-meta"
            >
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
                <div
                    v-if="props.m().isMessage(props.message)
                        && props.ml.bufferSetting('show_timestamps')"
                    :title="props.ml.formatTimeFull(props.message.time)"
                    class="kiwi-messagelist-time"
                >
                    {{ props.ml.formatTime(props.message.time) }}
                </div>
            </div>
            <div class="kiwi-messagelist-corporate-bubble">
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
            </div>
            <div
                v-if="props.m().hasReactions(props.message)"
                class="kiwi-messagelist-corporate-reactions"
            >
                <component
                    :is="injections.components.MessageReactions"
                    :message="props.message"
                    :buffer="props.ml.buffer"
                />
            </div>
            <div v-if="props.message.embed.payload && props.ml.shouldAutoEmbed" class="kiwi-messagelist-embed">
                <component
                    :is="injections.components.MediaViewer"
                    :url="props.message.embed.payload"
                    :show-pin="true"
                    @close="props.message.embed.payload = ''"
                    @pin="props.ml.openEmbedInPreview(props.message)"
                />
            </div>
            <component
                :is="injections.components.MessageInfo"
                v-if="props.ml.message_info_open === props.message"
                :message="props.message"
                :buffer="props.ml.buffer"
                @close="props.ml.toggleMessageInfo()"
            />
        </div>
        <component
            :is="injections.components.MessageActions"
            v-if="props.m().canReply(props.message) && props.message.irc_id && props.m().getNetwork() && props.m().getNetwork().hasCap('message-tags') && !props.message.is_redacted"
            :message="props.message"
            :buffer="props.ml.buffer"
            :class="{ 'kiwi-messageactions--corporate-own': props.m().isOwnMessage(props.message) }"
            layout="corporate"
            class="kiwi-messagelist-actions"
        />
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
    hasReactions(message) {
        return !!(
            message &&
            !message.is_redacted &&
            message.reactions &&
            Object.keys(message.reactions).length
        );
    },
    isOwnMessage(message) {
        let props = this.props;
        return this.isMessage(message) && props.ml.isSelfNick(message.nick);
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

.kiwi-messagelist-message--corporate {
    --kiwi-corporate-avatar-size: 28px;
    --kiwi-corporate-gap: 8px;
    --kiwi-corporate-bubble-bg: var(--brand-midtone, rgb(128 128 128 / 14%));
    --kiwi-corporate-bubble-fg: var(--brand-default-fg, inherit);
    --kiwi-corporate-own-bubble-bg: var(--brand-primary, #2563eb);
    --kiwi-corporate-own-bubble-fg: var(--brand-default-bg, #fff);
    --kiwi-corporate-meta: currentColor;
    --kiwi-corporate-radius: 12px;
    --kiwi-corporate-max-width: min(74%, 44rem);
    --kiwi-corporate-side-padding: 14px;
    --kiwi-corporate-action-offset: max(
        8px,
        calc(
            100% - var(--kiwi-corporate-side-padding) -
            var(--kiwi-corporate-avatar-size) - var(--kiwi-corporate-gap) -
            var(--kiwi-corporate-max-width)
        )
    );

    position: relative;
    display: flex;
    align-items: flex-start;
    gap: var(--kiwi-corporate-gap);
    border-left: 3px solid transparent;
    margin: 0;
    padding: 2px 14px;
    line-height: 1.45;
    transition: border-color 0.2s, background-color 0.2s;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--authorfirst {
    padding-top: 8px;
    padding-bottom: 2px;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--authorrepeat {
    padding-top: 1px;
    padding-bottom: 1px;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own {
    flex-direction: row-reverse;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own .kiwi-messagelist-corporate-main {
    align-items: flex-end;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own .kiwi-messagelist-corporate-meta {
    justify-content: flex-end;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own .kiwi-messagelist-corporate-meta .kiwi-messagelist-nick {
    text-align: right;
}

.kiwi-messagelist-corporate-avatar {
    flex-shrink: 0;
    width: var(--kiwi-corporate-avatar-size);
    padding-top: 1px;
}

.kiwi-messagelist-corporate-avatar .kiwi-avatar {
    display: block;
    width: 100%;
    height: auto;
    cursor: pointer;
}

.kiwi-messagelist-corporate-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    max-width: var(--kiwi-corporate-max-width);
}

.kiwi-messagelist-corporate-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 6px;
    max-width: 100%;
    margin: 0 4px 3px;
    color: var(--kiwi-corporate-meta);
    font-size: 0.74em;
    line-height: 1.2;
    opacity: 0.68;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--authorrepeat .kiwi-messagelist-corporate-meta {
    display: none;
}

.kiwi-messagelist-corporate-meta > div {
    display: inline-block;
    margin: 0;
    padding: 0;
}

.kiwi-messagelist-corporate-meta .kiwi-messagelist-nick {
    max-width: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-weight: 600;
    letter-spacing: 0.01em;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.kiwi-messagelist-corporate-meta .kiwi-messagelist-realname {
    max-width: 100%;
    overflow: hidden;
    cursor: pointer;
    font-size: 0.95em;
    opacity: 0.8;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.kiwi-messagelist-corporate-meta .kiwi-messagelist-time {
    font-size: 0.95em;
    font-weight: 400;
    opacity: 0.75;
}

.kiwi-messagelist-corporate-meta .kiwi-messagelist-nick-bot,
.kiwi-messagelist-corporate-meta .kiwi-messagelist-nick-oper,
.kiwi-messagelist-corporate-meta .kiwi-messagelist-nick-rerouted {
    font-size: 1em;
}

.kiwi-messagelist-corporate-bubble {
    width: fit-content;
    max-width: 100%;
    padding: 6px 10px 7px;
    border: 1px solid rgb(127 127 127 / 16%);
    border-radius: var(--kiwi-corporate-radius);
    background: var(--kiwi-corporate-bubble-bg);
    color: var(--kiwi-corporate-bubble-fg);
    box-shadow: 0 1px 1px rgb(0 0 0 / 6%);
    box-sizing: border-box;
}

.kiwi-messagelist-message--corporate .kiwi-messagelist-corporate-bubble {
    border-bottom-left-radius: 3px;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own:not(.kiwi-messagelist-message--bridge-card) .kiwi-messagelist-corporate-bubble {
    --brand-link-normal: var(--kiwi-corporate-own-bubble-fg);
    --brand-link--hover: var(--kiwi-corporate-own-bubble-fg);

    border-color: transparent;
    border-bottom-right-radius: 3px;
    border-bottom-left-radius: var(--kiwi-corporate-radius);
    background: var(--kiwi-corporate-own-bubble-bg);
    color: var(--kiwi-corporate-own-bubble-fg);
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--bridge-card .kiwi-messagelist-corporate-bubble {
    width: auto;
    max-width: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own.kiwi-messagelist-message--bridge-card .kiwi-messagelist-corporate-bubble {
    --kiwi-bridge-card-bg: var(--kiwi-corporate-own-bubble-bg);
    --brand-link-normal: var(--kiwi-corporate-own-bubble-fg);
    --brand-link--hover: var(--kiwi-corporate-own-bubble-fg);

    color: var(--kiwi-corporate-own-bubble-fg);
}

.kiwi-messagelist-corporate-bubble .kiwi-messagelist-body {
    display: block;
    margin: 0;
    padding: 0;
    background: transparent;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: normal;
}

.kiwi-messagelist-corporate-bubble .kiwi-messagelist-body a {
    overflow-wrap: anywhere;
    word-break: normal;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own .kiwi-messagelist-corporate-bubble .kiwi-messagereactions-reaction {
    border-color: rgb(255 255 255 / 22%);
    background: rgb(0 0 0 / 12%);
    color: inherit;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--emoji-only .kiwi-messagelist-corporate-bubble {
    padding: 4px 8px;
    font-size: 2.2em;
    line-height: 1.2;
}

.kiwi-messagelist-corporate-bubble .kiwi-messagelist-reply-preview {
    display: block;
    width: 100%;
    margin: 0 0 5px;
    padding-left: 7px;
    border-left: 2px solid currentColor;
    cursor: pointer;
    font-size: 0.84em;
    opacity: 0.72;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.kiwi-messagelist-corporate-bubble .kiwi-messagelist-reply-preview:hover {
    opacity: 1;
}

.kiwi-messagelist-corporate-bubble .kiwi-messagelist-reply-preview .bx-reply {
    margin-right: 5px;
}

.kiwi-messagelist-corporate-bubble .kiwi-messagelist-reply-preview-nick {
    margin-right: 5px;
    font-weight: bold;
}

.kiwi-messagelist-corporate-reactions {
    position: relative;
    z-index: 1;
    max-width: 100%;
    margin: -6px 4px 2px;
}

.kiwi-messagelist-message--corporate .kiwi-messagelist-embed {
    width: var(--kiwi-corporate-max-width);
    max-width: 100%;
    min-width: 0;
    margin-top: 6px;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--highlight {
    background: transparent;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--highlight .kiwi-messagelist-corporate-bubble {
    border-color: var(--brand-primary);
    box-shadow:
        0 0 0 1px var(--brand-primary),
        0 0 12px rgb(127 127 127 / 18%);
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own.kiwi-messagelist-message--highlight .kiwi-messagelist-corporate-bubble {
    outline: 2px solid var(--brand-default-bg);
    outline-offset: 2px;
}

.kiwi-messagelist-message--corporate:hover {
    z-index: 100;
}

.kiwi-messagelist-message--corporate .kiwi-messagelist-actions {
    position: absolute;
    top: 2px;
    right: var(--kiwi-corporate-action-offset);
    z-index: 100;
    display: none;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own .kiwi-messagelist-actions {
    right: auto;
    left: var(--kiwi-corporate-action-offset);
}

.kiwi-messagelist-message--corporate:hover .kiwi-messagelist-actions {
    display: block;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message-traffic,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-mode,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-system,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-error {
    display: block;
    margin: 0;
    padding: 4px 14px;
    text-align: left;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message-traffic .kiwi-messagelist-corporate-avatar,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-traffic .kiwi-messagelist-corporate-meta,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-mode .kiwi-messagelist-corporate-avatar,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-mode .kiwi-messagelist-corporate-meta,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-system .kiwi-messagelist-corporate-avatar,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-system .kiwi-messagelist-corporate-meta,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-error .kiwi-messagelist-corporate-avatar,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-error .kiwi-messagelist-corporate-meta {
    display: none;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message-traffic .kiwi-messagelist-corporate-main,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-mode .kiwi-messagelist-corporate-main,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-system .kiwi-messagelist-corporate-main,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-error .kiwi-messagelist-corporate-main {
    width: 100%;
    max-width: 100%;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message-traffic .kiwi-messagelist-corporate-bubble,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-mode .kiwi-messagelist-corporate-bubble,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-system .kiwi-messagelist-corporate-bubble,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-error .kiwi-messagelist-corporate-bubble {
    max-width: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message-topic {
    display: block;
    width: auto;
    margin: 14px 12px;
    padding: 8px 14px;
    border: 1px solid rgb(127 127 127 / 22%);
    border-left: 3px solid var(--brand-primary);
    border-radius: 0;
    background: var(--kiwi-corporate-bubble-bg);
    box-sizing: border-box;
    text-align: left;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message-topic .kiwi-messagelist-corporate-avatar,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-topic .kiwi-messagelist-corporate-meta {
    display: none;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message-topic .kiwi-messagelist-corporate-main,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message-topic .kiwi-messagelist-corporate-bubble {
    width: 100%;
    max-width: 100%;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message-topic .kiwi-messagelist-corporate-bubble {
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
}

@media screen and (max-width: 769px) {
    .kiwi-messagelist-message--corporate {
        --kiwi-corporate-avatar-size: 24px;
        --kiwi-corporate-gap: 6px;
        --kiwi-corporate-max-width: min(82%, 26rem);
        --kiwi-corporate-side-padding: 8px;

        padding-right: 8px;
        padding-left: 8px;
    }

    .kiwi-messagelist-corporate-bubble {
        padding: 5px 8px 6px;
    }

    .kiwi-messagelist-message--corporate.kiwi-messagelist-message-topic {
        margin: 12px 8px;
    }
}

</style>
<style lang="less">
.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own:not(.kiwi-messagelist-message--bridge-card) .kiwi-messagelist-corporate-bubble .kiwi-messagelist-body a,
.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own:not(.kiwi-messagelist-message--bridge-card) .kiwi-messagelist-corporate-bubble .kiwi-messagelist-body a:hover {
    color: var(--kiwi-corporate-own-bubble-fg, #fff);
    text-decoration: underline;
}

.kiwi-messagelist-message--corporate.kiwi-messagelist-message--own:not(.kiwi-messagelist-message--bridge-card) .kiwi-messagelist-corporate-bubble .kiwi-messagelist-body .kiwi-nick {
    padding: 0 2px;
    border-radius: 3px;
    background: rgb(127 127 127 / 18%);
    color: var(--kiwi-corporate-own-bubble-fg, #fff) !important;
    text-decoration: underline;
}
</style>
