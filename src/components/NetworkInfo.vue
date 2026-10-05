<template>
    <div class="kiwi-network-info">
        <div class="kiwi-network-info-section">
            <h3>{{ $t('info_server') }}</h3>
            <div class="kiwi-network-info-item">
                <span class="kiwi-network-info-label">{{ $t('info_ircd') }}:</span>
                <span class="kiwi-network-info-value">{{ network.ircd || 'Unknown' }}</span>
            </div>
        </div>

        <div v-if="network.enabled_caps.length > 0" class="kiwi-network-info-section">
            <h3>{{ $t('info_caps') }}</h3>
            <div class="kiwi-network-info-caps">
                <span
                    v-for="cap in sortedCaps"
                    :key="cap"
                    class="kiwi-network-info-cap"
                >
                    {{ cap }}
                </span>
            </div>
        </div>

        <div class="kiwi-network-info-section">
            <h3>{{ $t('info_isupport') }}</h3>
            <div class="kiwi-network-info-isupport">
                <div
                    v-for="(value, key) in sortedIsupport"
                    :key="key"
                    class="kiwi-network-info-isupport-item"
                >
                    <span class="kiwi-network-info-isupport-key">{{ key }}</span>
                    <span class="kiwi-network-info-isupport-value">{{ value === true ? '' : value }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
'kiwi public';

export default {
    props: ['network'],
    computed: {
        sortedCaps() {
            return [...this.network.enabled_caps].sort();
        },
        sortedIsupport() {
            const sorted = {};
            Object.keys(this.network.isupport)
                .sort()
                .forEach((key) => {
                    sorted[key] = this.network.isupport[key];
                });
            return sorted;
        },
    },
};
</script>

<style lang="less">
.kiwi-network-info {
    padding: 20px;
    box-sizing: border-box;
    overflow-y: auto;
    height: 100%;
    text-align: left;
}

.kiwi-network-info-section {
    margin-bottom: 30px;
}

.kiwi-network-info-section h3 {
    margin: 0 0 15px 0;
    padding-bottom: 5px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    font-size: 1.2em;
}

.kiwi-network-info-item {
    margin-bottom: 10px;
}

.kiwi-network-info-label {
    font-weight: bold;
    margin-right: 10px;
}

.kiwi-network-info-caps {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.kiwi-network-info-cap {
    padding: 4px 10px;
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
}

.kiwi-network-info-isupport {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 10px;
}

.kiwi-network-info-isupport-item {
    display: flex;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.02);
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
}

.kiwi-network-info-isupport-key {
    font-weight: bold;
    margin-right: 10px;
    color: var(--brand-primary);
}

.kiwi-network-info-isupport-value {
    word-break: break-all;
    opacity: 0.8;
}

@media screen and (max-width: 769px) {
    .kiwi-network-info-isupport {
        grid-template-columns: 1fr;
    }
}
</style>
