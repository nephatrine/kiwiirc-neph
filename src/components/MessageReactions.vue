<template>
    <div v-if="hasReactions && !message.is_redacted" class="kiwi-messagereactions">
        <div
            v-for="item in displayReactions"
            :key="item.emoji"
            :class="{
                'kiwi-messagereactions-reaction--reacted': item.reaction.reacted,
                'kiwi-messagereactions-reaction--pending': isPending(item.reaction),
            }"
            :title="item.title"
            class="kiwi-messagereactions-reaction"
            @click.stop="onReactionClick(item.emoji)"
        >
            <img
                v-if="item.url"
                :src="item.url"
                :alt="item.alt"
                class="kiwi-messagereactions-emoji-img"
            >
            <span v-else class="kiwi-messagereactions-emoji-text">{{ item.text }}</span>
            <span class="kiwi-messagereactions-count">{{ item.reaction.count }}</span>
        </div>
    </div>
</template>

<script>
'kiwi public';

import { reactionDisplay } from '@/helpers/Emoji';

export default {
    props: ['buffer', 'message'],
    computed: {
        hasReactions() {
            return Object.keys(this.message.reactions).length > 0;
        },
        displayReactions() {
            return Object.entries(this.message.reactions).map(([emoji, reaction]) => {
                const display = reactionDisplay(emoji, this.buffer);
                const users = (reaction.users || []).join(', ');
                return {
                    emoji,
                    reaction,
                    url: display.url,
                    alt: display.alt || display.label,
                    text: display.text,
                    label: display.label,
                    title: users ? `${display.label}\n${users}` : display.label,
                };
            });
        },
        isUtf8() {
            const network = this.buffer.getNetwork();
            return !network || network.isUtf8;
        },
    },
    methods: {
        isPending(reaction) {
            const network = this.buffer.getNetwork();
            const ourNick = network ? network.nick : '';
            return reaction.pending_nicks && reaction.pending_nicks.indexOf(ourNick) !== -1;
        },
        onReactionClick(emoji) {
            // If the user has already reacted, they can always unreact (safe)
            if (this.message.reactions[emoji] && this.message.reactions[emoji].reacted) {
                this.buffer.react(this.message, emoji);
                return;
            }

            // If not UTF-8, only allow reacting if the string is ASCII
            if (!this.isUtf8) {
                const isAscii = /^[\x00-\x7F]*$/.test(emoji);
                if (!isAscii) {
                    return;
                }
            }

            this.buffer.react(this.message, emoji);
        },
    },
};
</script>

<style lang="less">
.kiwi-messagereactions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
    margin-bottom: 8px;
}

.kiwi-messagereactions-reaction {
    display: flex;
    align-items: center;
    padding: 2px 6px;
    background: rgb(0 0 0 / 5%);
    border: 1px solid transparent;
    border-radius: 12px;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s, border-color 0.2s;
    font-size: 0.9em;

    &:hover {
        background: rgb(0 0 0 / 10%);
    }
}

.kiwi-messagereactions-reaction--reacted {
    background: rgb(66 133 244 / 10%);
    border-color: rgb(66 133 244 / 40%);

    &:hover {
        background: rgb(66 133 244 / 20%);
    }
}

.kiwi-messagereactions-reaction--pending {
    opacity: 0.5;
}

.kiwi-messagereactions-emoji-img {
    width: 16px;
    height: 16px;
    object-fit: contain;
    margin-right: 4px;
}

.kiwi-messagereactions-emoji-text {
    display: inline-block;
    max-width: 12em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
    margin-right: 4px;
}

.kiwi-messagereactions-count {
    font-weight: bold;
    opacity: 0.8;
}

/* Theme overrides could go here or in themes */
</style>
