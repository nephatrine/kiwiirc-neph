<template>
    <component
        :is="rowComponent"
        :message="message"
        :idx="idx"
        :ml="ml"
        :show-without-user="showWithoutUser"
        :show-real-names="showRealNames"
        :show-host-names="showHostNames"
        :network="network"
        :has-extended-join="hasExtendedJoin"
    />
</template>

<script>
'kiwi public';

export default {
    props: {
        rowComponent: Object,
        message: Object,
        idx: Number,
        ml: Object,
        showWithoutUser: Boolean,
        showRealNames: Boolean,
        showHostNames: Boolean,
        network: Object,
        hasExtendedJoin: Boolean,
    },
};
</script>
