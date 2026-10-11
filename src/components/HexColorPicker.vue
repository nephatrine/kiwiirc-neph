<template>
    <div v-if="visible" class="kiwi-hexcolorpicker-wrapper" @click.self="close">
        <div class="kiwi-hexcolorpicker kiwi-theme-bg">
            <div class="kiwi-hexcolorpicker-header">
                <h3>{{ $t('color_picker_hex') }}</h3>
                <i class="fa fa-times" aria-hidden="true" @click="close" />
            </div>
            <div class="kiwi-hexcolorpicker-body">
                <div class="u-form">
                    <div class="kiwi-hexcolorpicker-section">
                        <label class="kiwi-hexcolorpicker-label">
                            <span>{{ $t('foreground') }}</span>
                            <div class="kiwi-hexcolorpicker-row">
                                <div class="kiwi-hexcolorpicker-input-wrap">
                                    <input
                                        v-model="fg"
                                        type="color"
                                        title="Pick Color"
                                    >
                                    <div class="kiwi-hexcolorpicker-swatch" :style="{ backgroundColor: fg }" />
                                </div>
                                <input
                                    v-model="fg"
                                    type="text"
                                    class="u-input"
                                    placeholder="#000000"
                                >
                            </div>
                        </label>
                    </div>

                    <div class="kiwi-hexcolorpicker-section" :class="{ 'kiwi-hexcolorpicker-section--disabled': !useBg }">
                        <label class="kiwi-hexcolorpicker-label">
                            <div class="kiwi-hexcolorpicker-label-row">
                                <span>{{ $t('background') }}</span>
                                <label class="u-checkbox-wrapper">
                                    <input v-model="useBg" type="checkbox">
                                    <span>{{ $t('use_background') }}</span>
                                </label>
                            </div>
                            <div class="kiwi-hexcolorpicker-row">
                                <div class="kiwi-hexcolorpicker-input-wrap">
                                    <input
                                        v-model="bg"
                                        :disabled="!useBg"
                                        type="color"
                                        title="Pick Color"
                                    >
                                    <div class="kiwi-hexcolorpicker-swatch" :style="{ backgroundColor: useBg ? bg : 'transparent' }" />
                                </div>
                                <input
                                    v-model="bg"
                                    :disabled="!useBg"
                                    type="text"
                                    class="u-input"
                                    placeholder="#ffffff"
                                >
                            </div>
                        </label>
                    </div>
                </div>

                <div class="kiwi-hexcolorpicker-preview-container">
                    <div class="kiwi-hexcolorpicker-preview-label">Preview</div>
                    <div
                        class="kiwi-hexcolorpicker-preview"
                        :class="{ 'kiwi-hexcolorpicker-preview--checkerboard': !useBg }"
                        :style="previewStyle"
                    >
                        The quick brown fox jumps over the lazy dog
                    </div>
                </div>
            </div>
            <div class="kiwi-hexcolorpicker-footer">
                <button type="button" class="u-button u-button-secondary" @click="close">{{ $t('cancel') }}</button>
                <button type="button" class="u-button u-button-primary" @click="submit">{{ $t('ok') }}</button>
            </div>
        </div>
    </div>
</template>

<script>
'kiwi public';

export default {
    computed: {
        visible() {
            return this.$state.ui.hex_color_picker.visible;
        },
        ircinput() {
            return this.$state.ui.hex_color_picker.ircinput;
        },
        fg: {
            get() {
                return this.$state.ui.hex_color_picker.fg;
            },
            set(val) {
                this.$state.ui.hex_color_picker.fg = val;
            },
        },
        bg: {
            get() {
                return this.$state.ui.hex_color_picker.bg;
            },
            set(val) {
                this.$state.ui.hex_color_picker.bg = val;
            },
        },
        useBg: {
            get() {
                return this.$state.ui.hex_color_picker.use_bg;
            },
            set(val) {
                this.$state.ui.hex_color_picker.use_bg = val;
            },
        },
        previewStyle() {
            return {
                color: this.fg,
                backgroundColor: this.useBg ? this.bg : 'transparent',
            };
        },
    },
    created() {
        this.listen(this.$state, 'hexcolorpicker.show', (opts) => {
            this.$state.ui.hex_color_picker.ircinput = opts.ircinput || null;
            this.$state.ui.hex_color_picker.visible = true;
        });

        this.listen(this.$state, 'document.keydown', (event) => {
            if (this.visible && event.key === 'Escape') {
                this.close();
            }
        });
    },
    methods: {
        close() {
            this.$state.ui.hex_color_picker.visible = false;
            this.$state.ui.hex_color_picker.ircinput = null;
        },
        submit() {
            if (this.ircinput) {
                this.ircinput.setHexColor(this.fg, this.useBg ? this.bg : null);
            }
            this.close();
        },
    },
};
</script>

<style lang="less">
.kiwi-hexcolorpicker-wrapper {
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

.kiwi-hexcolorpicker {
    width: 400px;
    max-width: 95%;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--comp-border, #444);
}

.kiwi-hexcolorpicker-header {
    padding: 16px 24px;
    background: var(--brand-primary, #4285f4);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
        margin: 0;
        font-size: 1.2em;
        font-weight: 700;
        letter-spacing: 0.5px;
    }

    i {
        cursor: pointer;
        font-size: 1.4em;
        opacity: 0.8;
        transition: opacity 0.2s;

        &:hover {
            opacity: 1;
        }
    }
}

.kiwi-hexcolorpicker-body {
    padding: 24px;
}

.kiwi-hexcolorpicker-section {
    margin-bottom: 24px;
    transition: opacity 0.3s;

    &--disabled {
        opacity: 0.6;
    }
}

.kiwi-hexcolorpicker-label {
    display: flex;
    flex-direction: column;
    gap: 8px;

    span {
        font-weight: 700;
        font-size: 0.9em;
        text-transform: uppercase;
        letter-spacing: 1px;
        opacity: 0.8;
    }
}

.kiwi-hexcolorpicker-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .u-checkbox-wrapper {
        padding-left: 24px;
        font-size: 0.85em;
        font-weight: 600;
    }
}

.kiwi-hexcolorpicker-row {
    display: flex;
    gap: 12px;
    align-items: center;

    .u-input {
        flex: 1;
        height: 44px;
        font-family: var(--kiwi-font-mono);
        font-size: 1.1em;
        text-align: center;
        border-radius: 6px;
    }
}

.kiwi-hexcolorpicker-input-wrap {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--brand-input-border, #555);

    input[type='color'] {
        position: absolute;
        top: -10px;
        left: -10px;
        width: 100px;
        height: 100px;
        cursor: pointer;
        opacity: 0;

        &:disabled {
            cursor: default;
        }
    }
}

.kiwi-hexcolorpicker-swatch {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.kiwi-hexcolorpicker-preview-container {
    margin-top: 8px;
}

.kiwi-hexcolorpicker-preview-label {
    font-size: 0.8em;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 8px;
    opacity: 0.5;
}

.kiwi-hexcolorpicker-preview {
    padding: 20px;
    text-align: center;
    font-size: 1.1em;
    font-weight: 600;
    border: 2px solid var(--brand-input-border, #444);
    border-radius: 8px;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
}

.kiwi-hexcolorpicker-preview--checkerboard {
    background-size: 20px 20px;
    background-position: 0 0, 10px 10px;
    background-image:
        linear-gradient(45deg, rgba(0, 0, 0, 0.05) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.05) 75%, rgba(0, 0, 0, 0.05)),
        linear-gradient(45deg, rgba(0, 0, 0, 0.05) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.05) 75%, rgba(0, 0, 0, 0.05));
}

.kiwi-hexcolorpicker-footer {
    padding: 16px 24px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    background: rgba(0, 0, 0, 0.1);
    border-top: 1px solid var(--comp-border, #444);

    .u-button {
        padding: 10px 20px;
        min-width: 80px;
    }
}
</style>
