<template>
    <div v-if="hasReactions && !message.is_redacted" class="kiwi-messagereactions">
        <div
            v-for="(reaction, emoji) in message.reactions"
            :key="emoji"
            :class="{
                'kiwi-messagereactions-reaction--reacted': reaction.reacted,
                'kiwi-messagereactions-reaction--pending': isPending(reaction),
            }"
            :title="reaction.users.join(', ')"
            class="kiwi-messagereactions-reaction"
            @click.stop="onReactionClick(emoji)"
        >
            <span v-if="getEmojiUrl(emoji)" :style="{ 'background-image': `url(${getEmojiUrl(emoji)})` }" class="kiwi-messagereactions-emoji-img" />
            <span v-else class="kiwi-messagereactions-emoji-text">{{ emoji }}</span>
            <span class="kiwi-messagereactions-count">{{ reaction.count }}</span>
        </div>
    </div>
</template>

<script>
'kiwi public';

import _ from 'lodash';
import { curatedEmojis } from '@/helpers/Emoji';

export default {
    props: ['buffer', 'message'],
    computed: {
        hasReactions() {
            return Object.keys(this.message.reactions).length > 0;
        },
        emojiLocation() {
            return this.$state.setting('emojiLocation');
        },
        emojiMap() {
            // Map emoji characters to their image filenames
            const emojis = this.$state.setting('emojis');
            const map = {};
            _.each(emojis, (filename, ascii) => {
                if (!filename) return;
                map[ascii] = filename;
            });
            // Ensure curated emojis are in the map
            curatedEmojis.forEach((e) => {
                map[e.char] = e.code;
            });
            return map;
        },
    },
    methods: {
        isPending(reaction) {
            const network = this.buffer.getNetwork();
            const ourNick = network ? network.nick : '';
            return reaction.pending_nicks && reaction.pending_nicks.indexOf(ourNick) !== -1;
        },
        getEmojiUrl(emoji) {
            // 1. Try direct map (ascii or unicode if in config)
            let filename = this.emojiMap[emoji];

            // 2. If not found, it might be a unicode emoji that matches one of our filenames
            if (!filename) {
                // This is a fallback and might not work for all emojis without a better map
                // but for curated list it should be fine if we add them to config or handle here.
            }

            return filename ? `${this.emojiLocation}${filename}` : null;
        },
        onReactionClick(emoji) {
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
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    margin-right: 4px;
}

.kiwi-messagereactions-emoji-text {
    margin-right: 4px;
}

.kiwi-messagereactions-count {
    font-weight: bold;
    opacity: 0.8;
}

/* Theme overrides could go here or in themes */
</style>
