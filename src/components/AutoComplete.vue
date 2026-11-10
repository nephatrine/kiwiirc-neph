<template>
    <div class="kiwi-autocomplete kiwi-theme-bg">
        <div
            v-for="item in filteredAndLimitedItems"
            :key="item.key || item.type + (item.filterText || item.text)"
            :class="[
                'kiwi-autocomplete-item',
                `kiwi-autocomplete-type--${item.type ? item.type : 'default'}`,
                { 'kiwi-autocomplete-item--selected': item.idx === selected_idx },
                item.badge ? `kiwi-autocomplete-item--badge-${item.badge.toLowerCase()}` : '',
            ]"
            @mousedown.prevent
            @click="handleClick(item)"
        >
            <span
                v-if="item.type === 'emoji'"
                class="kiwi-autocomplete-item-value kiwi-autocomplete-item-value--emoji"
            >
                <span class="kiwi-autocomplete-emoji-name">
                    <emoji-text :text="item.name || item.text" />
                </span>
                <span class="kiwi-autocomplete-emoji-symbol">
                    <img
                        v-if="item.url"
                        :src="item.url"
                        :alt="item.alt || item.name"
                        class="kiwi-autocomplete-emoji-image"
                    >
                    <template v-else>{{ item.char }}</template>
                </span>
                <span
                    class="kiwi-autocomplete-emoji-source"
                    :title="emojiSourceTitle(item)"
                >{{ emojiSource(item) }}</span>
            </span>
            <span v-else class="kiwi-autocomplete-item-value"><emoji-text :text="item.text" /><span
                v-if="item.type === 'user' && item.displayName"
                class="kiwi-autocomplete-user-displayname"
            ><emoji-text :text="item.displayName" /></span><span
                v-if="item.badge"
                :class="['kiwi-autocomplete-badge', `kiwi-autocomplete-badge--${item.badge.toLowerCase()}`]"
            >{{ item.badge }}</span></span>
            <span
                v-if="item.type === 'command'"
                class="u-link kiwi-autocomplete-item-details"
            ><emoji-text :text="item.description" /></span>
            <span
                v-if="item.type === 'command' && item.help"
                class="kiwi-autocomplete-item-help"
            ><emoji-text :text="item.help" /></span>
            <span
                v-if="item.type === 'user'"
                class="u-link kiwi-autocomplete-item-details"
                @click.stop="openQuery(item.text)"
            >{{ $t('send_message') }}</span>
            <span
                v-else-if="item.type === 'channel'"
                class="kiwi-autocomplete-item-details"
            ><i class="bx bx-user" aria-hidden="true" />{{ item.count }}</span>
        </div>
    </div>
</template>

<script>
'kiwi public';

import * as Misc from '@/helpers/Misc';

export default {
    props: ['filter', 'buffer', 'items', 'itemsPerPage'],
    data() {
        return {
            // items: [
            //     { text: 'anick1', type: 'user' },
            //     { text: 'anick2', type: 'user' },
            //     { text: 'bnick3', type: 'user' },
            //     { text: 'cnick4' },
            //     { text: 'dnick5' },
            // ],
            selected_idx: 0,
        };
    },
    computed: {
        itemLimits() {
            const itemLimit = parseInt(this.itemsPerPage, 10) || 7;
            const halfLimit = (itemLimit - 1) / 2;
            return {
                all: itemLimit,
                backward: Math.floor(halfLimit) || 1,
                forward: Math.ceil(halfLimit) || 1,
            };
        },
        filteredItems() {
            const filterVal = (this.filter || '').toLowerCase();

            return this.items.filter((item) => {
                let s = false;
                const filterText = item.filterText || item.text;
                if (filterText.toLowerCase().indexOf(filterVal) === 0) {
                    s = true;
                }

                (item.alias || []).forEach((alias) => {
                    if (alias.toLowerCase().indexOf(filterVal) === 0) {
                        s = true;
                    }
                });

                return s;
            }).sort(Misc.strCompare);
        },
        filteredAndLimitedItems() {
            return this.filteredItems.filter((item, itemIdx, items) => {
                let numItems = items.length - 1;
                let idxFrom = this.selected_idx - this.itemLimits.backward;
                let idxTo = this.selected_idx + this.itemLimits.forward;
                let isInRange = false;

                // Adjust the number of items before and after the selected item
                // when we reach either end of the list.
                // If we don't do this then this:
                // * Item 1
                // * item 2
                // * Item 3
                // * Item 4
                // * Item 5 < selected
                // Can turn into this:
                // * Item 4
                // * Item 5 < selected
                if (idxFrom < 0) {
                    idxTo += -idxFrom;
                    idxFrom = 0;
                } else if (idxTo > numItems) {
                    idxFrom -= (idxTo - numItems);
                    idxTo = numItems;
                }

                if (itemIdx >= idxFrom && itemIdx <= idxTo) {
                    isInRange = true;
                }

                // Keep track of the pre-limited index for item selection
                item.idx = itemIdx;

                return isInRange;
            });
        },
        selectedItem() {
            let item = this.filteredItems[this.selected_idx];
            return item || null;
        },
    },
    watch: {
        selected_idx() {
            // nextTick() as the DOM hasn't updated yet
            this.$nextTick(() => {
                let el = this.$el.querySelector('.kiwi-autocomplete-item--selected');
                if (!el) {
                    return;
                }

                this.$el.scrollTop = el.offsetTop - (el.getBoundingClientRect().height * 2);
            });

            this.tempCurrentItem();
        },
        filter() {
            const numItems = this.filteredAndLimitedItems.length - 1;
            if (this.selected_idx > numItems) {
                this.selected_idx = (numItems < 0) ? 0 : numItems;
            }
        },
    },
    mounted() {
        this.tempCurrentItem();
    },
    methods: {
        resetSelection() {
            this.selected_idx = 0;
        },
        emojiSource(item) {
            if (item.packName) {
                return item.packName;
            }
            if (item.packId) {
                return item.packId;
            }
            return this.$t('emoji_source_' + item.sourceType);
        },
        emojiSourceTitle(item) {
            return [item.packId, item.channelName].filter(Boolean).join(' · ');
        },
        itemValue(item) {
            return item.insertText || item.value || item.text;
        },
        handleOnKeyDown(event) {
            let handled = false;
            const isShiftTab = event.key === 'Tab' && event.shiftKey;
            const isPlainEnter = event.key === 'Enter' &&
                !event.shiftKey &&
                !event.altKey;
            const wordBreakKeyCodes = [' ', ';', ',', '.'];

            if (isPlainEnter || (event.key === 'Tab' && !isShiftTab)) {
                // Enter and Tab accept the highlighted suggestion. Modified
                // Enter is left to ControlInput so it can insert a newline.
                if (!this.selectedItem) {
                    this.cancel();
                    if (event.key === 'Tab') {
                        event.preventDefault();
                        handled = true;
                    }
                } else {
                    this.selectCurrentItem();
                    event.preventDefault();
                    handled = true;
                }
            } else if (wordBreakKeyCodes.indexOf(event.key) > -1) {
                // Word breaks should be typed normally, never accept a suggestion.
                this.cancel();
            } else if (event.key === 'ArrowUp' || isShiftTab) {
                // Up or tab + shift
                if (this.selected_idx > 0) {
                    this.selected_idx--;
                } else {
                    // Wrap around to the end
                    this.selected_idx = this.filteredItems.length - 1;
                }

                event.preventDefault();
                handled = true;
            } else if (event.key === 'ArrowDown' && !event.altKey) {
                // Down
                if (this.selected_idx < this.filteredItems.length - 1) {
                    this.selected_idx++;
                } else {
                    // Wrap around to the start
                    this.selected_idx = 0;
                }

                event.preventDefault();
                handled = true;
            } else if (event.key === 'Shift') {
                // shift
                handled = true;
            } else if (event.key === 'PageUp' || event.key === 'PageDown') {
                // pageUp || pageDown
                const maxIdx = this.filteredItems.length - 1;
                const limits = this.itemLimits;
                let jump = limits.all;

                // current position is within the first or last 3
                // correctly jump the right amount
                if (this.selected_idx <= limits.backward) {
                    jump = (limits.all + limits.backward) - this.selected_idx;
                } else if (this.selected_idx >= maxIdx - limits.forward) {
                    // the center point maybe offset if an even number of items is shown
                    jump = (limits.all + limits.forward) - (maxIdx - this.selected_idx);
                }

                // backwards or forward
                if (event.key === 'PageUp') {
                    this.selected_idx -= jump;
                } else {
                    this.selected_idx += jump;
                }

                // ensure we are not out of bounds
                if (this.selected_idx > maxIdx) {
                    this.selected_idx = maxIdx;
                } else if (this.selected_idx < 0) {
                    this.selected_idx = 0;
                }

                handled = true;
            }

            return handled;
        },
        handleClick(item) {
            this.selected_idx = item.idx;
            this.selectCurrentItem();
            this.$emit('click', this.itemValue(item), item);
        },
        openQuery(nick) {
            let buffer = this.$state.addBuffer(this.buffer.networkid, nick);
            this.$state.setActiveBuffer(buffer.networkid, buffer.name);
            this.cancel();
        },
        tempCurrentItem() {
            let item = this.selectedItem;
            if (!item) {
                return;
            }
            this.$emit('temp', this.itemValue(item), item);
        },
        selectCurrentItem() {
            let item = this.selectedItem;
            let value = '';

            if (item) {
                value = this.itemValue(item);
            }

            this.$emit('selected', value, item);
        },
        cancel() {
            this.$emit('cancel');
        },
    },
};
</script>

<style lang="less">
.kiwi-autocomplete {
    box-sizing: border-box;
    overflow-y: auto;
    position: absolute;
    bottom: 100%;
    right: 0;
    left: 0;
    z-index: 1;
}

.kiwi-autocomplete-item {
    padding: 5px 2em;
    cursor: pointer;
}

.kiwi-autocomplete-item-value {
    font-weight: 700;
}

.kiwi-autocomplete-user-displayname {
    display: inline-block;
    max-width: 18em;
    margin-left: 8px;
    overflow: hidden;
    font-weight: 400;
    opacity: 0.7;
    text-overflow: ellipsis;
    vertical-align: bottom;
    white-space: nowrap;
}

.kiwi-autocomplete-item-value--emoji {
    display: grid;
    grid-template-columns: minmax(7em, 1fr) 1.5em minmax(7em, 1fr);
    align-items: center;
    column-gap: 8px;
    font-weight: 400;
}

.kiwi-autocomplete-emoji-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 700;
}

.kiwi-autocomplete-emoji-symbol {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5em;
    height: 1.5em;
    font-size: 1.1em;
}

.kiwi-autocomplete-emoji-image {
    width: 1.25em;
    height: 1.25em;
    object-fit: contain;
}

.kiwi-autocomplete-emoji-source {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.7;
}

.kiwi-autocomplete-type--command {
    .kiwi-autocomplete-item-details {
        margin-left: 8px;
    }
}

.kiwi-autocomplete-item-help {
    display: block;
    font-size: 0.85em;
    line-height: 1.3;
    margin-top: 2px;
    opacity: 0.8;
}

.kiwi-autocomplete-badge {
    display: inline-block;
    font-size: 0.7em;
    font-weight: 700;
    margin-left: 8px;
    padding: 1px 6px;
    border: 1px solid;
    border-radius: 10px;
    vertical-align: middle;
}

.kiwi-autocomplete-badge--server {
    color: var(--brand-warning, #ff9800);
    border-color: var(--brand-warning, #ff9800);
}

.kiwi-autocomplete-badge--chat {
    color: var(--brand-notice, #2196f3);
    border-color: var(--brand-notice, #2196f3);
}

.kiwi-autocomplete-item--badge-server {
    box-shadow: inset 3px 0 0 var(--brand-warning, #ff9800);
}

.kiwi-autocomplete-item--badge-chat {
    box-shadow: inset 3px 0 0 var(--brand-notice, #2196f3);
}

.kiwi-autocomplete-type--user {
    .kiwi-autocomplete-item-details {
        float: right;
        font-size: 0.9em;
    }
}

.kiwi-autocomplete-type--channel {
    .kiwi-autocomplete-item-details {
        float: right;
        font-size: 0.9em;
        width: 3em;
    }

    .bx-user {
        margin-right: 4px;
    }
}

@supports (grid-template-rows: subgrid) {
    .kiwi-autocomplete {
        display: grid;
        column-gap: 8px;
        grid-template-columns: minmax(7em, max-content) auto max-content;
    }

    .kiwi-autocomplete-item {
        display: grid;
        grid-column: span 3;
        grid-template-columns: subgrid;
    }

    .kiwi-autocomplete-type--command {
        .kiwi-autocomplete-item-details {
            margin-left: unset;
            grid-column: span 2;
        }

        .kiwi-autocomplete-item-help {
            grid-column: span 3;
        }
    }

    .kiwi-autocomplete-type--user,
    .kiwi-autocomplete-type--channel {
        .kiwi-autocomplete-item-value {
            grid-column: span 2;
        }

        .kiwi-autocomplete-item-details {
            float: unset;
        }
    }

    .kiwi-autocomplete-type--emoji {
        .kiwi-autocomplete-item-value {
            grid-column: span 3;
        }
    }

    .kiwi-autocomplete-type--default {
        .kiwi-autocomplete-item-value {
            grid-column: span 3;
        }
    }
}
</style>
