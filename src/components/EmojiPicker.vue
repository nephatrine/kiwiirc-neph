<template>
    <div v-if="visible" class="kiwi-emojipicker-modal-overlay" @click.self="close">
        <div class="kiwi-emojipicker-modal">
            <div class="kiwi-emojipicker-header">
                <div class="kiwi-emojipicker-search">
                    <input
                        v-model="filter"
                        v-focus
                        :placeholder="$t('search_emojis')"
                        type="text"
                        @keydown.stop
                    >
                    <i class="fa fa-search" aria-hidden="true" />
                </div>
                <div class="kiwi-emojipicker-categories" @mousedown.prevent>
                    <div
                        v-for="cat in categories"
                        :key="cat.id"
                        :title="cat.label"
                        :class="{ 'kiwi-emojipicker-category--active': activeCategory === cat.id }"
                        class="kiwi-emojipicker-category"
                        @click="scrollToCategory(cat.id)"
                    >
                        <i :class="['fa', cat.icon]" aria-hidden="true" />
                    </div>
                </div>
                <div :title="$t('close')" class="kiwi-emojipicker-close" @click="close">
                    <i class="fa fa-times" aria-hidden="true" />
                </div>
            </div>
            <div ref="scroller" class="kiwi-emojipicker-emojis" @scroll="onScroll" @mousedown.prevent>
                <div v-if="filter" class="kiwi-emojipicker-category-section">
                    <div class="kiwi-emojipicker-category-title">{{ $t('search_results') }}</div>
                    <div class="kiwi-emojipicker-category-list">
                        <div
                            v-for="emoji in filteredEmojis"
                            :key="emoji.shortcode"
                            :title="emoji.shortcode"
                            class="kiwi-emojipicker-emoji"
                            @click="onEmojiClick(emoji.char)"
                        >
                            {{ emoji.char }}
                        </div>
                    </div>
                </div>
                <template v-else>
                    <div
                        v-for="cat in categories"
                        :key="cat.id"
                        :ref="`cat-${cat.id}`"
                        class="kiwi-emojipicker-category-section"
                    >
                        <div class="kiwi-emojipicker-category-title">{{ cat.label }}</div>
                        <div class="kiwi-emojipicker-category-list">
                            <div
                                v-for="emoji in emojiData[cat.id]"
                                :key="emoji.shortcode"
                                :title="emoji.shortcode"
                                class="kiwi-emojipicker-emoji"
                                @click="onEmojiClick(emoji.char)"
                            >
                                {{ emoji.char }}
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script>
'kiwi public';

import { categories, emojiData } from '@/res/emojis';

export default {
    data() {
        return {
            filter: '',
            categories,
            emojiData,
            activeCategory: categories[0].id,
        };
    },
    computed: {
        visible() {
            return this.$state.ui.emoji_picker.visible;
        },
        filteredEmojis() {
            const f = this.filter.toLowerCase();
            const results = [];
            Object.values(this.emojiData).forEach((list) => {
                list.forEach((emoji) => {
                    if (emoji.shortcode.includes(f) || emoji.name.includes(f)) {
                        results.push(emoji);
                    }
                });
            });
            return results.slice(0, 100);
        },
    },
    created() {
        this.listen(this.$state, 'emojipicker.show', (opts) => {
            this.$state.ui.emoji_picker.type = opts.type || 'input';
            this.$state.ui.emoji_picker.message = opts.message || null;
            this.$state.ui.emoji_picker.buffer = opts.buffer || null;
            this.$state.ui.emoji_picker.ircinput = opts.ircinput || null;
            this.$state.ui.emoji_picker.visible = true;
            this.filter = '';
        });

        this.listen(this.$state, 'document.keydown', (event) => {
            if (this.visible && event.key === 'Escape') {
                this.close();
            }
        });
    },
    methods: {
        close() {
            this.$state.ui.emoji_picker.visible = false;
        },
        onEmojiClick(emojiChar) {
            const picker = this.$state.ui.emoji_picker;
            if (picker.type === 'input' && picker.ircinput) {
                picker.ircinput.insertText(emojiChar);
            } else if (picker.type === 'reaction' && picker.buffer && picker.message) {
                picker.buffer.react(picker.message, emojiChar);
            }
            this.close();
        },
        scrollToCategory(catId) {
            const el = this.$refs[`cat-${catId}`][0];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
            }
            this.activeCategory = catId;
        },
        onScroll() {
            if (this.filter) return;

            const scroller = this.$refs.scroller;
            const scrollPos = scroller.scrollTop + (scroller.offsetHeight / 2);

            for (let i = 0; i < this.categories.length; i++) {
                const catId = this.categories[i].id;
                const el = this.$refs[`cat-${catId}`][0];
                if (
                    el &&
                    el.offsetTop <= scrollPos &&
                    (el.offsetTop + el.offsetHeight) > scrollPos
                ) {
                    this.activeCategory = catId;
                    break;
                }
            }
        },
    },
};
</script>

<style lang="less">
.kiwi-emojipicker-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.kiwi-emojipicker-modal {
    display: flex;
    flex-direction: column;
    width: 350px;
    height: 450px;
    background: var(--brand-default-bg, #fff);
    border: 1px solid var(--brand-darktone, #ccc);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    overflow: hidden;
    user-select: none;

    .kiwi-wrap--monospace & {
        font-family: var(--kiwi-font-mono);
    }
}

.kiwi-emojipicker-header {
    padding: 10px;
    border-bottom: 1px solid var(--brand-midtone, #eee);
    background: var(--brand-midtone, #f9f9f9);
    position: relative;
}

.kiwi-emojipicker-close {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s;

    &:hover {
        opacity: 1;
    }
}

.kiwi-emojipicker-search {
    position: relative;
    margin-bottom: 8px;
    margin-right: 20px;

    input {
        width: 100%;
        padding: 8px 30px 8px 12px;
        border-radius: 4px;
        border: 1px solid var(--brand-darktone, #ccc);
        background: var(--brand-default-bg, #fff);
        color: var(--brand-default-fg, #000);
        box-sizing: border-box;
        font-size: 0.9em;
        font-family: inherit;
    }

    i {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.5;
    }
}

.kiwi-emojipicker-categories {
    display: flex;
    justify-content: space-between;
}

.kiwi-emojipicker-category {
    cursor: pointer;
    padding: 6px;
    opacity: 0.6;
    transition: opacity 0.2s, transform 0.1s;

    &:hover {
        opacity: 1;
        transform: scale(1.1);
    }

    &.kiwi-emojipicker-category--active {
        opacity: 1;
        color: var(--brand-primary, #42b983);
    }
}

.kiwi-emojipicker-emojis {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
}

.kiwi-emojipicker-category-title {
    font-size: 0.85em;
    font-weight: bold;
    text-transform: uppercase;
    opacity: 0.6;
    margin: 12px 0 6px 4px;
    position: sticky;
    top: 0;
    background: var(--brand-default-bg, #fff);
    z-index: 1;
}

.kiwi-emojipicker-category-list {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
}

.kiwi-emojipicker-emoji {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 38px;
    width: 38px;
    overflow-x: hidden;
    font-size: 24px;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.1s;

    &:hover {
        background-color: rgba(128, 128, 128, 0.1);
    }
}
</style>
