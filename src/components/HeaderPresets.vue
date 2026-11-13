<template>
    <div
        v-if="!isNarrow && !isDesktopApp && presets.length"
        ref="root"
        class="kiwi-header-option kiwi-header-option-presets"
        @click.stop
    >
        <a
            ref="button"
            :aria-expanded="open ? 'true' : 'false'"
            :title="$t('presets')"
            aria-haspopup="true"
            @click.stop="toggle"
        >
            <i class="bx bx-palette" aria-hidden="true" />
        </a>
        <div
            v-if="open"
            :style="menuStyle"
            class="kiwi-header-presets-menu"
            role="menu"
        >
            <div class="kiwi-header-presets-title">{{ $t('presets') }}</div>
            <button
                v-for="preset in presets"
                :key="preset.id"
                :class="{ 'kiwi-header-presets-item--active': activePresetId === preset.id }"
                class="kiwi-header-presets-item"
                role="menuitem"
                type="button"
                @click.stop="applyPreset(preset)"
            >
                <span class="kiwi-header-presets-item-main">
                    <span class="kiwi-header-presets-item-name">{{ preset.label }}</span>
                    <span class="kiwi-header-presets-item-meta">
                        {{ preset.theme }} · {{ preset.layoutLabel }}<span
                            v-if="preset.useMonospace"
                        > · {{ $t('presets_monospace') }}</span>
                    </span>
                </span>
                <i
                    v-if="activePresetId === preset.id"
                    class="bx bx-check kiwi-header-presets-check"
                    aria-hidden="true"
                />
            </button>
        </div>
    </div>
</template>

<script>
'kiwi public';

import ThemeManager from '@/libs/ThemeManager';
import {
    LAYOUT_PRESETS,
    applyLayoutPreset,
    isLayoutPresetActive
} from '@/helpers/LayoutPresets';

export default {
    data() {
        return {
            open: false,
            menuStyle: {},
        };
    },
    computed: {
        isNarrow() {
            return !!this.$state.ui.is_narrow;
        },
        isDesktopApp() {
            return typeof window !== 'undefined' && !!window.kiwiDesktop;
        },
        presets() {
            const themeManager = ThemeManager.instance();
            return LAYOUT_PRESETS.filter((preset) => themeManager.findTheme(preset.theme));
        },
        activePresetId() {
            const themeManager = ThemeManager.instance();
            const active = LAYOUT_PRESETS.find((preset) => (
                this.presets.indexOf(preset) !== -1 &&
                isLayoutPresetActive(this.$state, themeManager, preset)
            ));
            return active ? active.id : '';
        },
    },
    watch: {
        isNarrow() {
            this.close();
        },
    },
    mounted() {
        document.addEventListener('click', this.onDocumentClick);
        document.addEventListener('keydown', this.onKeydown);
        window.addEventListener('resize', this.close);
        window.addEventListener('scroll', this.close, true);
    },
    beforeDestroy() {
        document.removeEventListener('click', this.onDocumentClick);
        document.removeEventListener('keydown', this.onKeydown);
        window.removeEventListener('resize', this.close);
        window.removeEventListener('scroll', this.close, true);
    },
    methods: {
        toggle() {
            if (this.open) {
                this.close();
                return;
            }

            const button = this.$refs.button;
            if (!button || typeof button.getBoundingClientRect !== 'function') {
                return;
            }

            const rect = button.getBoundingClientRect();
            this.menuStyle = {
                top: `${Math.round(rect.bottom)}px`,
                right: `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`,
            };
            this.open = true;
        },
        close() {
            this.open = false;
        },
        applyPreset(preset) {
            applyLayoutPreset(this.$state, ThemeManager.instance(), preset);
            this.close();
        },
        onDocumentClick(event) {
            if (!this.open || !this.$el.contains(event.target)) {
                if (this.open) {
                    this.close();
                }
            }
        },
        onKeydown(event) {
            if (this.open && event.key === 'Escape') {
                this.close();
            }
        },
    },
};
</script>

<style lang="less" scoped>
.kiwi-header-option-presets {
    position: relative;
}

.kiwi-header-presets-menu {
    position: fixed;
    z-index: 10000;
    width: 18rem;
    max-width: calc(100vw - 1rem);
    padding: 0.35rem;
    border: 1px solid var(--brand-midtone, rgb(128 128 128 / 35%));
    border-radius: 4px;
    background: var(--brand-default-bg, #222);
    color: var(--brand-default-fg, #eee);
    box-shadow: 0 0.6rem 1.8rem rgb(0 0 0 / 35%);
    box-sizing: border-box;
}

.kiwi-header-presets-title {
    padding: 0.35rem 0.55rem 0.45rem;
    font-size: 0.72em;
    font-weight: 700;
    letter-spacing: 0.08em;
    opacity: 0.65;
    text-transform: uppercase;
}

.kiwi-header-presets-item {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    text-align: left;
}

.kiwi-header-presets-item:hover,
.kiwi-header-presets-item--active {
    background: var(--brand-midtone, rgb(128 128 128 / 20%));
}

.kiwi-header-presets-item-main {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 0.15rem;
}

.kiwi-header-presets-item-name {
    font-weight: 700;
}

.kiwi-header-presets-item-meta {
    overflow: hidden;
    font-size: 0.78em;
    opacity: 0.68;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.kiwi-header-presets-check {
    flex-shrink: 0;
    font-size: 1.1em;
    color: var(--brand-primary);
}
</style>
