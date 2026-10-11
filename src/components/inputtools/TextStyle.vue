<template>
    <div class="kiwi-inputtools-colours" @mousedown.prevent>
        <template v-if="!isMobile">
            <!-- Desktop: 16 swatches + 10px + HEX + Reset -->
            <div
                v-for="(name, idx) in palette"
                :key="idx"
                :class="`irc-bg-colour-${name}`"
                :data-code="`${idx < 10 ? '0' : ''}${idx}`"
                class="kiwi-inputtools-colours-colour"
                @click="onColourClick"
            />
            <div
                :title="$t('color_picker_hex')"
                class="kiwi-inputtools-colours-colour kiwi-inputtools-colours-hex"
                @click="onHexClick"
            ><i class="fa fa-paint-brush" aria-hidden="true" /></div>
            <div
                :title="$t('clear_styles')"
                class="kiwi-inputtools-colours-colour kiwi-inputtools-colours-reset"
                @click="onResetClick"
            ><i class="fa fa-eraser" aria-hidden="true" /></div>
        </template>
        <template v-else>
            <!-- Mobile: Two rows of (8 swatches + 10px + Utility) -->
            <div class="kiwi-inputtools-colours-row">
                <div
                    v-for="(name, idx) in palette.slice(0, 8)"
                    :key="idx"
                    :class="`irc-bg-colour-${name}`"
                    :data-code="`${idx < 10 ? '0' : ''}${idx}`"
                    class="kiwi-inputtools-colours-colour"
                    @click="onColourClick"
                />
                <div
                    :title="$t('color_picker_hex')"
                    class="kiwi-inputtools-colours-colour kiwi-inputtools-colours-hex"
                    @click="onHexClick"
                ><i class="fa fa-paint-brush" aria-hidden="true" /></div>
            </div>
            <div class="kiwi-inputtools-colours-row">
                <div
                    v-for="(name, idx) in palette.slice(8, 16)"
                    :key="idx + 8"
                    :class="`irc-bg-colour-${name}`"
                    :data-code="`${idx + 8 < 10 ? '0' : ''}${idx + 8}`"
                    class="kiwi-inputtools-colours-colour"
                    @click="onColourClick"
                />
                <div
                    :title="$t('clear_styles')"
                    class="kiwi-inputtools-colours-colour kiwi-inputtools-colours-reset"
                    style="margin-left: 10px;"
                    @click="onResetClick"
                ><i class="fa fa-eraser" aria-hidden="true" /></div>
            </div>
        </template>
    </div>
</template>

<script>
'kiwi public';

import * as Colours from '@/helpers/Colours';

export default {
    props: ['ircinput'],
    data: function data() {
        return {
            palette: [
                'white', 'black', 'blue', 'green',
                'light-red', 'brown', 'purple', 'orange',
                'yellow', 'light-green', 'cyan', 'light-cyan',
                'light-blue', 'pink', 'grey', 'light-grey',
            ],
        };
    },
    computed: {
        isMobile() {
            return this.$state.ui.app_width <= 550;
        },
    },
    methods: {
        onColourClick: function onColourClick(event) {
            let colour = window.getComputedStyle(event.target, null)
                .getPropertyValue('background-color');
            // Convert rgb(x,x,x) to its hex form
            let m = colour.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (m) {
                let rgbObj = {
                    r: parseInt(m[1], 10),
                    g: parseInt(m[2], 10),
                    b: parseInt(m[3], 10),
                };
                colour = Colours.rgb2hex(rgbObj);
            }

            let code = event.target.dataset.code;
            if (event.shiftKey) {
                this.ircinput.setBackgroundColour(code, colour);
            } else {
                this.ircinput.setColour(code, colour);
            }
        },
        onHexClick() {
            this.$state.$emit('hexcolorpicker.show', { ircinput: this.ircinput });
        },
        onResetClick: function onResetClick() {
            this.ircinput.resetStyles();
        },
    },
};
</script>

<style lang="less">

.kiwi-inputtools-colours {
    bottom: 0;
    left: 0;
    overflow: hidden;
    position: absolute;
    height: 30px;
    width: 550px;
    display: flex;
    flex-wrap: wrap;
}

.kiwi-inputtools-colours-row {
    display: flex;
    width: 100%;
    height: 30px;
}

.kiwi-inputtools-colours-colour {
    display: block;
    height: 30px;
    width: 30px;
    cursor: pointer;
    box-sizing: border-box;
    border: 1px solid rgba(255, 255, 255, 0.2);
    margin: 0;
    user-select: none;
}

.kiwi-inputtools-colours-hex {
    font-size: 18px;
    line-height: 30px;
    text-align: center;
    background: #000;
    color: #cacaca;
    width: 30px;
    height: 30px;
    margin-left: 10px;
    border-left: 1px solid gray;

    &:hover {
        background-color: #333;
    }
}

.kiwi-inputtools-colours-reset {
    font-size: 20px;
    line-height: 30px;
    text-align: center;
    background: #000;
    color: #cacaca;
    width: 30px;
    height: 30px;
    margin-left: 0;
    border-left: 1px solid gray;

    &:hover {
        background-color: #333;
    }
}

@media screen and (max-width: 550px) {
    .kiwi-inputtools-colours {
        width: 280px;
        height: 60px;
    }
}
</style>
