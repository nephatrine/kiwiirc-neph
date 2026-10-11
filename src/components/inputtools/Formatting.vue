<template>
    <div class="kiwi-inputtools-formatting">
        <div class="kiwi-inputtools-formatting-palette" @mousedown.prevent @click.prevent>
            <div
                :title="$t('bold')"
                class="kiwi-inputtools-formatting-item"
                @click="onBoldClick"
            ><i class="fa fa-bold" aria-hidden="true" /></div>
            <div
                :title="$t('italic')"
                class="kiwi-inputtools-formatting-item"
                @click="onItalicClick"
            ><i class="fa fa-italic" aria-hidden="true" /></div>
            <div
                :title="$t('underline')"
                class="kiwi-inputtools-formatting-item"
                @click="onUnderlineClick"
            ><i class="fa fa-underline" aria-hidden="true" /></div>
            <div
                :title="$t('strikethrough')"
                class="kiwi-inputtools-formatting-item"
                @click="onStrikethroughClick"
            ><i class="fa fa-strikethrough" aria-hidden="true" /></div>
            <div
                :title="$t('monospace')"
                class="kiwi-inputtools-formatting-item"
                @click="onMonospaceClick"
            ><i class="fa fa-code" aria-hidden="true" /></div>
            <div
                :title="$t('spoiler')"
                class="kiwi-inputtools-formatting-item"
                @click="onSpoilerClick"
            ><i class="fa fa-eye-slash" aria-hidden="true" /></div>
            <div
                :title="$t('fancy')"
                class="kiwi-inputtools-formatting-item"
                @click="onFancyClick"
            ><i class="fa fa-magic" aria-hidden="true" /></div>
            <div
                :title="$t('clear_formatting')"
                class="kiwi-inputtools-formatting-item kiwi-inputtools-formatting-reset"
                @click="onResetClick"
            ><i class="fa fa-eraser" aria-hidden="true" /></div>
        </div>
    </div>
</template>

<script>
'kiwi public';

export default {
    props: ['ircinput'],
    data: function data() {
        return {
        };
    },

    methods: {
        onBoldClick: function onBoldClick() {
            this.ircinput.toggleBold();
        },
        onItalicClick: function onItalicClick() {
            this.ircinput.toggleItalic();
        },
        onUnderlineClick: function onUnderlineClick() {
            this.ircinput.toggleUnderline();
        },
        onStrikethroughClick: function onStrikethroughClick() {
            this.ircinput.toggleStrikethrough();
        },
        onMonospaceClick: function onMonospaceClick() {
            this.ircinput.toggleMonospace();
        },
        onSpoilerClick: function onSpoilerClick() {
            this.ircinput.toggleSpoiler();
        },
        onFancyClick: function onFancyClick() {
            this.ircinput.toggleFancy();
        },
        onResetClick: function onResetClick() {
            this.ircinput.resetStyles();
        },
    },
};
</script>

<style lang="less">

.kiwi-inputtools-formatting {
    bottom: 0;
    right: 0;
    overflow: hidden;
    position: absolute;
    height: 30px;
    width: 250px;
}

.kiwi-inputtools-formatting-item {
    display: block;
    float: left;
    height: 30px;
    width: 30px;
    cursor: pointer;
    box-sizing: border-box;
    border: 1px solid gray;
    margin: 0;
    font-size: 16px;
    line-height: 30px;
    text-align: center;
    background: #000;
    color: #cacaca;
    user-select: none;

    &:hover {
        background-color: #333;
    }
}

.kiwi-inputtools-formatting-reset {
    font-size: 20px;
    background: #000;
    color: #cacaca;
    margin-left: 10px;
    border-left: 1px solid gray;

    &:hover {
        background-color: #333;
    }
}

</style>
