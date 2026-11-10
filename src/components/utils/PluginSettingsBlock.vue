<template>
    <div class="kiwi-appsettings-block kiwi-appsettings-plugin-block">
        <h3 v-if="title">{{ title }}</h3>
        <component
            :is="block.component"
            v-bind="componentProps"
            :plugin-props="pluginProps"
        />
    </div>
</template>

<script>
'kiwi public';

export default {
    props: {
        block: {
            type: Object,
            required: true,
        },
        network: {
            type: Object,
            default: null,
        },
    },
    computed: {
        title() {
            return typeof this.block.title === 'function' ?
                this.block.title() :
                '';
        },
        componentProps() {
            if (!this.network) {
                return this.block.props;
            }

            return {
                ...this.block.props,
                network: this.network,
            };
        },
        pluginProps() {
            return this.network ? { network: this.network } : {};
        },
    },
};
</script>
