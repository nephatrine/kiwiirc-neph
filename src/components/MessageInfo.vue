<template>
    <div class="kiwi-messageinfo" @click.stop>
        <div v-if="message.mentioned_urls.length > 0" class="kiwi-messageinfo-urls">
            <div v-for="url in message.mentioned_urls" :key="url" class="kiwi-messageinfo-url">
                <a
                    v-if="showLinkPreviews"
                    class="u-button u-button-secondary"
                    @click="urlPreview(url)"
                >{{ $t('preview') }}</a>
                <a
                    :href="url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="u-link"
                >{{ url }}</a>
            </div>
        </div>
        <div v-if="supportsReactions" class="kiwi-messageinfo-reactions">
            <div
                v-for="emoji in curatedEmojis"
                :key="emoji.code"
                :style="{ 'background-image': `url(${emojiUrl(emoji.code)})` }"
                :class="{ 'kiwi-messageinfo-reaction--reacted': hasReacted(emoji.char) }"
                class="kiwi-messageinfo-reaction"
                @click="onReact(emoji.char)"
            />
        </div>
        <div
            :class="{ 'kiwi-messageinfo-actions--open': requestingInput }"
            class="kiwi-messageinfo-actions"
        >
            <a
                v-if="!requestingInput && message.nick
                    && buffer.name !== message.nick && message.irc_id"
                class="u-link kiwi-messageinfo-button kiwi-messageinfo-reply"
                @click="onReply"
            >{{ $t('reply') }}</a>

            <a
                v-if="!requestingInput && message.nick && buffer.name !== message.nick && !isSelf()"
                class="u-link kiwi-messageinfo-button kiwi-messageinfo-reply-private"
                @click="openQuery"
            >{{ $t('reply_in_private') }}</a>

            <a
                v-if="!requestingInput && canRedact"
                class="u-link kiwi-messageinfo-button kiwi-messageinfo-redact"
                @click="onRedact"
            >{{ $t('redact') }}</a>

            <template v-if="!requestingInput">
                <component
                    :is="plugin.component"
                    v-for="plugin in pluginUiSections"
                    :key="plugin.id"
                    :plugin-props="{
                        buffer,
                        message,
                    }"
                    v-bind="plugin.props"
                    :buffer="buffer"
                    :message="message"
                    class="u-link kiwi-messageinfo-button kiwi-messageinfo-plugin"
                />
            </template>

            <template v-if="message.user && areWeAnOp() && !isSelf()">
                <a
                    v-if="!requestingInput"
                    class="u-link kiwi-messageinfo-button kiwi-messageinfo-ban-user" @click="onBan"
                >{{ $t('ban') }}</a>
                <input-prompt
                    :label="`${$t('kick_reason')}:`" @submit="onKick"
                    @cancel="requestingInput = false"
                >
                    <a
                        v-if="!requestingInput"
                        class="u-link kiwi-messageinfo-kick-user" @click="requestingInput = true"
                    >{{ $t('kick') }}</a>
                </input-prompt>
            </template>
        </div>
    </div>
</template>

<script>
'kiwi public';

import GlobalApi from '@/libs/GlobalApi';
import { curatedEmojis } from '@/helpers/Emoji';

export default {
    props: ['buffer', 'message'],
    data() {
        return {
            requestingInput: false,
            pluginUiSections: GlobalApi.singleton().messageInfoPlugins,
            curatedEmojis,
        };
    },
    computed: {
        showLinkPreviews() {
            return this.$state.setting('buffers.show_link_previews');
        },
        supportsReactions() {
            return this.buffer.getNetwork().supportsTag('+draft/react') && this.message.irc_id;
        },
        canRedact() {
            if (!this.buffer.getNetwork().hasCap('draft/message-redaction') || !this.message.irc_id) {
                return false;
            }
            if (this.message.is_redacted || this.message.type === 'tagmsg') {
                return false;
            }
            return this.isSelf() || this.areWeAnOp();
        },
    },
    methods: {
        emojiUrl(code) {
            return this.$state.setting('emojiLocation') + code;
        },
        hasReacted(emojiChar) {
            return this.message.reactions[emojiChar] && this.message.reactions[emojiChar].reacted;
        },
        onReact(emojiChar) {
            this.buffer.react(this.message, emojiChar);
            this.$emit('close');
        },
        urlPreview(url) {
            this.$state.$emit('mediaviewer.show', url);
        },
        areWeAnOp() {
            let ourNick = this.buffer.getNetwork().nick;
            return this.buffer.isUserAnOp(ourNick);
        },
        isSelf() {
            let user = this.$state.getUser(this.buffer.getNetwork().id, this.message.nick);
            return user && this.buffer.getNetwork().ircClient.user.nick === user.nick;
        },
        onBan() {
            this.buffer.banUser(this.message.user);
        },
        onKick(reason) {
            this.buffer.kickUser(this.message.user, reason);
        },
        onReply() {
            this.buffer.replying_to = this.message;
            this.$state.$emit('input.reply', this.message.nick);
            this.$emit('close');
        },
        openQuery() {
            let network = this.buffer.getNetwork();
            let buffer = this.$state.addBuffer(network.id, this.message.nick);
            this.$state.setActiveBuffer(network.id, buffer.name);
        },
        onRedact() {
            this.$state.ui.redaction_prompt.message = this.message;
            this.$state.ui.redaction_prompt.buffer = this.buffer;
            this.$state.ui.redaction_prompt.visible = true;
            this.$emit('close');
        },
    },
};
</script>

<style>
.kiwi-messageinfo {
    display: block;
    position: relative;
    padding: 0;
    margin-bottom: 10px;
}

.kiwi-messageinfo-urls {
    margin-top: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
    border-top: 1px solid;
    border-bottom: 1px solid;
    overflow: hidden;
    width: 100%;
}

.kiwi-messageinfo-url {
    margin-bottom: 5px;
    display: flex;
}

.kiwi-messageinfo-urls .kiwi-messageinfo-url:last-of-type {
    margin-bottom: 0;
}

.kiwi-messageinfo-url .u-link {
    white-space: nowrap;
    text-overflow: ellipsis;
    display: inline-block;
    overflow: hidden;
    flex: 1;
    margin-left: 10px;
    padding: 5px 10px;
    text-align: center;
    border: 1px solid;
    border-radius: 3px;
}

.kiwi-messageinfo-reactions {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    border-bottom: 1px solid;
    flex-wrap: wrap;
}

.kiwi-messageinfo-reaction {
    width: 24px;
    height: 24px;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    border: 1px solid transparent;
    transition: background 0.2s;
}

.kiwi-messageinfo-reaction:hover {
    background: rgb(0 0 0 / 5%);
}

.kiwi-messageinfo-reaction--reacted {
    background: rgb(66 133 244 / 10%);
    border-color: rgb(66 133 244 / 40%);
}

.kiwi-messageinfo-actions {
    margin-top: 10px;
    overflow: hidden;
    width: 100%;
    text-align: center;
}

.kiwi-messageinfo-actions .u-link {
    display: inline-block;
    border-radius: 4px;
    margin: 0 4px 4px 0;
    padding: 5px 10px;
}
</style>
