<template>
    <div class="kiwi-bridge-card">
        <div class="kiwi-bridge-card-content">
            <div v-if="card.author" class="kiwi-bridge-card-author">
                <i class="bx bx-user" aria-hidden="true" />
                <emoji-text :text="card.author" />
            </div>
            <div v-if="card.title" class="kiwi-bridge-card-title">
                <emoji-text :text="card.title" />
            </div>
            <div v-if="bodyHtml" class="kiwi-bridge-card-body" v-html="bodyHtml" />
            <div v-if="card.fields.length" class="kiwi-bridge-card-fields">
                <div
                    v-for="(field, index) in card.fields"
                    :key="`field-${index}`"
                    class="kiwi-bridge-card-field"
                >
                    <span class="kiwi-bridge-card-field-key">
                        <emoji-text :text="field.key" />
                    </span>
                    <span class="kiwi-bridge-card-field-value">
                        <emoji-text :text="field.value" />
                    </span>
                </div>
            </div>
            <div v-if="thumbnails.length" class="kiwi-bridge-card-thumbnails">
                <img
                    v-for="(thumbnail, index) in thumbnails"
                    :key="`thumbnail-${index}`"
                    :src="thumbnail"
                    class="kiwi-bridge-card-thumbnail-image"
                    alt=""
                    loading="lazy"
                    @click.stop="openThumbnail(thumbnail)"
                >
            </div>
            <div v-if="card.footer" class="kiwi-bridge-card-footer">
                <emoji-text :text="card.footer" />
            </div>
        </div>
    </div>
</template>

<script>
'kiwi public';

export default {
    name: 'BridgeCard',
    props: {
        card: {
            type: Object,
            required: true,
        },
        buffer: {
            type: Object,
            required: true,
        },
        message: {
            type: Object,
            required: true,
        },
        idx: {
            type: Number,
            default: 0,
        },
        ml: {
            type: Object,
            required: true,
        },
    },
    computed: {
        thumbnails() {
            return this.card.thumbnails || [];
        },
        bodyHtml() {
            return this.message.message ? this.ml.formatMessage(this.message) : '';
        },
    },
    methods: {
        openThumbnail(url) {
            this.$state.ui.lightbox_url = url;
        },
    },
};
</script>

<style>
.kiwi-bridge-card {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-left: 3px solid rgb(127 127 127 / 0.45);
    border-radius: 4px;
    background: rgb(127 127 127 / 0.06);
    overflow-wrap: anywhere;
    max-width: 33em;
}

.kiwi-bridge-card.kiwi-messagelist-body {
    padding: 10px 12px;
    margin-top: 4px;
}

.kiwi-bridge-card--single-thumbnail {
    flex-direction: row;
    align-items: flex-start;
}

.kiwi-bridge-card-content {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.kiwi-bridge-card-author {
    display: flex;
    align-items: center;
    gap: 5px;
    color: inherit;
    font-size: 0.85em;
    opacity: 0.8;
}

.kiwi-bridge-card-author .bx {
    font-size: 1em;
}

.kiwi-bridge-card-title {
    font-size: 1.08em;
    font-weight: 600;
    line-height: 1.3;
}

.kiwi-bridge-card-body {
    line-height: 1.4;
    white-space: pre-wrap;
}

.kiwi-bridge-card-fields {
    display: grid;
    grid-template-columns: minmax(80px, max-content) minmax(0, 1fr);
    gap: 4px 12px;
}

.kiwi-bridge-card-field {
    display: contents;
}

.kiwi-bridge-card-field-key {
    color: inherit;
    font-weight: 600;
    opacity: 0.85;
}

.kiwi-bridge-card-field-value {
    min-width: 0;
    overflow-wrap: anywhere;
}

.kiwi-bridge-card-thumbnails {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.kiwi-bridge-card-thumbnail-image {
    display: block;
    flex: 0 0 auto;
    width: auto;
    max-width: 100%;
    height: 128px;
    border-radius: 3px;
    object-fit: contain;
    cursor: pointer;
}

.kiwi-bridge-card-footer {
    color: inherit;
    font-size: 0.8em;
    opacity: 0.7;
}
</style>
