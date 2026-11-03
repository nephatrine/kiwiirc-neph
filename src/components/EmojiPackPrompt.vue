<template>
    <div v-if="prompt" class="kiwi-emojipackprompt-wrapper">
        <div class="kiwi-emojipackprompt">
            <div class="kiwi-emojipackprompt-header">
                <h3>{{ $t('emoji_pack_prompt_title') }}</h3>
            </div>
            <div class="kiwi-emojipackprompt-body">
                <p>{{ $t('emoji_pack_prompt_body', { channel: prompt.channelName }) }}</p>
                <p class="kiwi-emojipackprompt-reference">
                    {{ $t('emoji_pack_prompt_reference', { emoji: referencedEmoji }) }}
                </p>
                <p class="kiwi-emojipackprompt-hint">
                    {{ $t('emoji_pack_prompt_hint') }}
                </p>
            </div>
            <div class="kiwi-emojipackprompt-footer">
                <button
                    type="button"
                    class="u-button u-button-secondary"
                    @click="answer(false)"
                >{{ $t('emoji_pack_prompt_never') }}</button>
                <button
                    type="button"
                    class="u-button u-button-primary"
                    @click="answer(true)"
                >{{ $t('emoji_pack_prompt_load') }}</button>
            </div>
        </div>
    </div>
</template>

<script>
'kiwi public';

import { answerEmojiPackPrompt, emojiPackState } from '@/libs/EmojiPackStore';

export default {
    computed: {
        prompt() {
            return emojiPackState.prompt;
        },
        referencedEmoji() {
            if (!this.prompt) {
                return '';
            }
            return ':' + this.prompt.shortcode + '/' + this.prompt.packId + ':';
        },
    },
    methods: {
        answer(load) {
            answerEmojiPackPrompt(load);
        },
    },
};
</script>

<style lang="less">
.kiwi-emojipackprompt-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.kiwi-emojipackprompt {
    width: 430px;
    max-width: 90%;
    background: var(--brand-default-bg, #fff);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.kiwi-emojipackprompt-header {
    padding: 15px 20px;
    background: var(--brand-primary, #4285f4);
    color: var(--brand-default-bg, #fff);

    h3 {
        margin: 0;
        font-size: 1.1em;
    }
}

.kiwi-emojipackprompt-body {
    padding: 20px;

    p {
        margin: 0 0 12px 0;
    }
}

.kiwi-emojipackprompt-reference {
    font-family: var(--kiwi-font-mono);
    font-weight: 600;
}

.kiwi-emojipackprompt-body .kiwi-emojipackprompt-hint {
    margin-bottom: 0;
    opacity: 0.7;
    font-size: 0.9em;
}

.kiwi-emojipackprompt-footer {
    padding: 15px 20px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid var(--brand-midtone, #eee);

    .u-button {
        padding: 8px 16px;
    }
}
</style>
