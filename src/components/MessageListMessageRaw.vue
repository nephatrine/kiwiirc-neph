<template functional>
    <div
        :class="[
            'kiwi-messagelist-message',
            'kiwi-messagelist-message--raw',
            props.ml.isTemporaryHighlighted(props.message)
                ? 'kiwi-messagelist-message--temporary-highlight'
                : '',
        ]"
        :data-message-id="props.message.id"
    >
        <span
            v-if="props.ml.bufferSetting('show_timestamps')"
            :title="props.ml.formatTimeFull(props.message.time)"
            class="kiwi-messagelist-raw-time"
        >
            {{ props.ml.formatTime(props.message.time) }}
        </span>
        <div
            class="kiwi-messagelist-body"
            v-html="props.ml.formatMessage(props.message)"
        />
    </div>
</template>

<script>
'kiwi public';

export default {
    props: {
        ml: Object,
        message: Object,
    },
};
</script>

<style lang="less" scoped>

.kiwi-messagelist-message--raw {
    display: flex;
    align-items: baseline;
    gap: 0.6em;
    margin: 0;
    padding: 0 10px;
    border-left: 0;
    font-family: var(--kiwi-font-mono);
    font-size: 80%;
    line-height: 1.5em;
    text-align: left;
}

.kiwi-messagelist-raw-time {
    flex: none;
    opacity: 0.65;
    font-variant-numeric: tabular-nums;
    user-select: text;
}

.kiwi-messagelist-message--raw .kiwi-messagelist-body {
    min-width: 0;
    min-height: 0;
    margin: 0;
    padding: 0;
    font-size: inherit;
    line-height: inherit;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    text-align: left;
}

</style>
