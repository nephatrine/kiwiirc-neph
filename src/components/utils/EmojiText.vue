<template>
    <span v-html="html" />
</template>

<script>
'kiwi public';

import Vue from 'vue';
import { wrapEmojiText } from '@/libs/EmojiProvider';

export default Vue.component('emoji-text', {
    name: 'EmojiText',
    props: {
        text: {
            type: String,
            default: '',
        },
    },
    computed: {
        html() {
            return wrapEmojiText(this.text);
        },
    },
});
</script>
