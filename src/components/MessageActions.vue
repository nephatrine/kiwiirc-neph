<template>
    <div :class="[`kiwi-messageactions--${layout}`]" class="kiwi-messageactions" @click.stop>
        <div :title="$t('message_actions_title')" class="kiwi-messageactions-badge">
            <i class="fa fa-ellipsis-h" aria-hidden="true" />
        </div>
        <div class="kiwi-messageactions-dropdown">
            <div
                v-for="emoji in quickEmojis"
                :key="emoji.shortcode"
                :class="{ 'kiwi-messageactions-emoji--reacted': hasReacted(emoji.char) }"
                :title="emoji.shortcode"
                class="kiwi-messageactions-item kiwi-messageactions-emoji"
                @click="onReact(emoji.char)"
            >
                {{ emoji.char }}
            </div>
            <div :title="$t('emoji_picker')" class="kiwi-messageactions-item" @click="showPicker">
                <i class="fa fa-plus" aria-hidden="true" />
            </div>
            <div class="kiwi-messageactions-divider" />
            <div :title="$t('reply')" class="kiwi-messageactions-item" @click="onReply">
                <i class="fa fa-reply" aria-hidden="true" />
            </div>
            <div v-if="canRedact" :title="$t('redact')" class="kiwi-messageactions-item" @click="onRedact">
                <i class="fa fa-eraser" aria-hidden="true" />
            </div>
        </div>
    </div>
</template>

<script>
'kiwi public';

import { quickEmojis } from '@/helpers/Emoji';

export default {
    props: {
        buffer: Object,
        message: Object,
        layout: {
            type: String,
            default: 'modern',
        },
    },
    data() {
        return {
            quickEmojis,
        };
    },
    computed: {
        canRedact() {
            if (!this.buffer.getNetwork().hasCap('draft/message-redaction') || !this.message.irc_id) {
                return false;
            }
            if (this.message.is_redacted) {
                return false;
            }

            let ourNick = this.buffer.getNetwork().nick;
            let isOurMessage = this.message.nick.toLowerCase() === ourNick.toLowerCase();
            let areWeAnOp = this.buffer.isUserAnOp(ourNick);

            return isOurMessage || areWeAnOp;
        },
    },
    methods: {
        hasReacted(emojiChar) {
            return this.message.reactions[emojiChar] && this.message.reactions[emojiChar].reacted;
        },
        onReact(emojiChar) {
            this.buffer.react(this.message, emojiChar);
        },
        showPicker() {
            this.$state.$emit('emojipicker.show', {
                type: 'reaction',
                buffer: this.buffer,
                message: this.message,
            });
        },
        onReply() {
            this.buffer.replying_to = this.message;
            this.$state.$emit('input.reply', this.message.nick);
        },
        onRedact() {
            this.$state.ui.redaction_prompt.message = this.message;
            this.$state.ui.redaction_prompt.buffer = this.buffer;
            this.$state.ui.redaction_prompt.visible = true;
        },
    },
};
</script>

<style lang="less">
.kiwi-messageactions {
    position: relative;
    display: inline-block;
    z-index: 100;
}

.kiwi-messageactions-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--brand-midtone, #eee);
    border: 1px solid var(--brand-darktone, rgba(0, 0, 0, 0.1));
    border-radius: 4px;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
}

.kiwi-messageactions-badge:hover {
    opacity: 1;
}

.kiwi-messageactions-dropdown {
    display: none;
    position: absolute;
    top: 0;
    right: 28px;
    background: var(--brand-midtone, #eee);
    border: 1px solid var(--brand-darktone, rgba(0, 0, 0, 0.1));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 2px;
    z-index: 1000;
    flex-direction: row;
    align-items: center;
}

/* Hover bridge to keep the dropdown open */
.kiwi-messageactions-dropdown::before {
    content: "";
    position: absolute;
    top: 0;
    right: -10px;
    bottom: 0;
    width: 10px;
    z-index: -1;
}

.kiwi-messageactions:hover .kiwi-messageactions-dropdown {
    display: flex;
}

.kiwi-messageactions-divider {
    width: 1px;
    height: 18px;
    background: rgba(0, 0, 0, 0.1);
    margin: 0 4px;
}

.kiwi-messageactions-item {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 3px;
    position: relative;
    box-sizing: border-box;
    transition: none !important;
    animation: none !important;
    transform: none !important;
    color: var(--brand-default-fg, #000);

    &:hover {
        background-color: rgba(128, 128, 128, 0.2);
    }

    i {
        font-size: 14px;
        opacity: 0.8;
    }
}

.kiwi-messageactions-emoji {
    background-size: 18px;
    background-repeat: no-repeat;
    background-position: center;
}

.kiwi-messageactions-emoji--reacted {
    background-color: rgba(66, 133, 244, 0.2) !important;
    border: 1px solid rgba(66, 133, 244, 0.4);
}

/* Compact layout specific styling */
.kiwi-messageactions--compact,
.kiwi-messageactions--inline {
    .kiwi-messageactions-badge,
    .kiwi-messageactions-dropdown,
    .kiwi-messageactions-item {
        border-radius: 0;
    }

    .kiwi-messageactions-badge {
        background: transparent;
        border: none;
        box-shadow: none;
        opacity: 0.5;

        &:hover {
            background: var(--brand-midtone, #eee);
            border: 1px solid var(--brand-darktone, rgba(0, 0, 0, 0.1));
            opacity: 1;
        }
    }

    .kiwi-messageactions-dropdown {
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
        padding: 0;
    }

    .kiwi-messageactions-item {
        width: 26px;
        height: 26px;
    }
}

/* Hard reset for any global emoji styles */
.kiwi-messageactions-emoji::before,
.kiwi-messageactions-emoji::after {
    display: none !important;
}
</style>
