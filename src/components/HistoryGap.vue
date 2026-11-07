<template>
    <div class="kiwi-messagelist-historygap">
        <div class="kiwi-messagelist-historygap-title">
            {{ $t('history_gap_title') }}
        </div>
        <div class="kiwi-messagelist-historygap-description">
            {{ $t('history_gap_description', {
                older: formatTime(gap.from),
                newer: formatTime(gap.to),
            }) }}
        </div>
        <div class="kiwi-messagelist-historygap-actions">
            <button
                type="button"
                class="u-button"
                :disabled="!canLoad || loading || gap.exhaustedOlder"
                @click="load('older')"
            >
                {{ gap.exhaustedOlder ?
                    $t('history_gap_exhausted') :
                    $t('history_gap_load_older') }}
            </button>
            <button
                type="button"
                class="u-button"
                :disabled="!canLoad || loading || gap.exhaustedNewer"
                @click="load('newer')"
            >
                {{ gap.exhaustedNewer ?
                    $t('history_gap_exhausted') :
                    $t('history_gap_load_newer') }}
            </button>
        </div>
        <div v-if="showLocal" class="kiwi-messagelist-historygap-local">
            <button
                type="button"
                class="u-button"
                :disabled="loading"
                @click="$emit('load-local', gap)"
            >
                {{ $t('history_gap_load_local') }}
            </button>
        </div>
        <div v-if="loading" class="kiwi-messagelist-historygap-loading">
            {{ $t('history_gap_loading') }}
        </div>
    </div>
</template>

<script>
'kiwi public';

export default {
    props: {
        buffer: {
            type: Object,
            required: true,
        },
        gap: {
            type: Object,
            required: true,
        },
        localAvailable: {
            type: Boolean,
            default: false,
        },
    },
    computed: {
        network() {
            return this.buffer.getNetwork();
        },
        canLoad() {
            return !!(
                this.network &&
                this.network.state === 'connected' &&
                this.network.ircClient &&
                this.network.ircClient.chathistory &&
                this.network.ircClient.chathistory.isSupported()
            );
        },
        loading() {
            return !!(this.buffer.flags && this.buffer.flags.is_requesting_chathistory);
        },
        showLocal() {
            return !!(
                this.localAvailable &&
                (!this.canLoad || this.gap.exhaustedOlder || this.gap.exhaustedNewer)
            );
        },
    },
    methods: {
        formatTime(time) {
            return new Date(time).toLocaleString();
        },
        load(direction) {
            if (!this.canLoad || this.loading) {
                return;
            }
            this.$emit('load', { gap: this.gap, direction });
        },
    },
};
</script>

<style>
.kiwi-messagelist-historygap {
    margin: 0.8em 1em;
    padding: 0.7em 1em;
    border: 1px dashed rgb(127 127 127 / 45%);
    border-radius: 4px;
    color: inherit;
    background: rgb(127 127 127 / 5%);
    text-align: center;
}

.kiwi-messagelist-historygap-title {
    font-weight: 600;
}

.kiwi-messagelist-historygap-description {
    margin-top: 0.2em;
    opacity: 0.75;
    font-size: 0.9em;
}

.kiwi-messagelist-historygap-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5em;
    margin-top: 0.6em;
}

.kiwi-messagelist-historygap-local {
    margin-top: 0.5em;
}

.kiwi-messagelist-historygap-loading {
    margin-top: 0.5em;
    opacity: 0.75;
    font-size: 0.9em;
}
</style>
