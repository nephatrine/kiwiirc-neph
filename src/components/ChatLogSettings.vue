<template>
    <div v-if="isDesktop" class="kiwi-appsettings-block kiwi-appsettings-chatlogs">
        <h3>{{ $t('chatlogs_settings') }}</h3>
        <div class="kiwi-appsettings-section">
            <div class="kiwi-chatlogs-description">
                {{ $t('chatlogs_description') }}
            </div>
            <div class="kiwi-chatlogs-note">
                {{ $t('chatlogs_redaction_note') }}
            </div>
            <label class="kiwi-chatlogs-retention">
                <span>{{ $t('chatlogs_retention') }}</span>
                <select v-model.number="retentionDays" class="u-input" @change="applyRetention">
                    <option :value="1">{{ $t('chatlogs_retention_1') }}</option>
                    <option :value="7">{{ $t('chatlogs_retention_7') }}</option>
                    <option :value="30">{{ $t('chatlogs_retention_30') }}</option>
                    <option :value="90">{{ $t('chatlogs_retention_90') }}</option>
                    <option :value="0">{{ $t('chatlogs_retention_forever') }}</option>
                </select>
            </label>
            <div class="kiwi-chatlogs-stats">
                {{ $t('chatlogs_stats', { count: stats.count, size: formattedSize }) }}
            </div>
            <div class="kiwi-chatlogs-actions">
                <button type="button" class="u-button u-button-primary" @click="openSearch">
                    {{ $t('chatlogs_search_button') }}
                </button>
                <button type="button" class="u-button u-button-warning" @click="clearLogs">
                    {{ $t('chatlogs_clear') }}
                </button>
            </div>
            <div v-if="status" class="kiwi-chatlogs-status">
                {{ status }}
            </div>
        </div>
    </div>
</template>

<script>
'kiwi public';

import desktop from '@/libs/desktop';
import * as ChatLogs from '@/libs/desktop/ChatLogs';

export default {
    data() {
        return {
            retentionDays: 7,
            stats: {
                count: 0,
                size: 0,
            },
            status: '',
        };
    },
    computed: {
        isDesktop() {
            return desktop.isDesktop() && ChatLogs.isAvailable();
        },
        formattedSize() {
            const bytes = Number(this.stats.size) || 0;
            if (bytes >= 1024 * 1024) {
                return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
            }
            if (bytes >= 1024) {
                return `${(bytes / 1024).toFixed(1)} KB`;
            }
            return `${bytes} B`;
        },
    },
    created() {
        if (!this.isDesktop) {
            return;
        }
        const configured = Number(this.$state.setting('chatLogRetentionDays'));
        this.retentionDays = Number.isFinite(configured) ? configured : 7;
        this.loadStats();
    },
    methods: {
        async loadStats() {
            try {
                this.stats = await ChatLogs.stats();
            } catch (err) {
                this.stats = { count: 0, size: 0 };
            }
        },
        async applyRetention() {
            this.$state.setting('chatLogRetentionDays', this.retentionDays);
            try {
                await ChatLogs.prune(this.retentionDays);
                await this.loadStats();
            } catch (err) {
                this.status = this.$t('chatlogs_retention_failed', {
                    reason: err.message || String(err),
                });
            }
        },
        openSearch() {
            this.$state.$emit('chatlogs.open', { source: 'local' });
        },
        async clearLogs() {
            if (!window.confirm(this.$t('chatlogs_clear_confirm'))) {
                return;
            }
            try {
                await ChatLogs.clear();
                await this.loadStats();
                this.status = this.$t('chatlogs_cleared');
            } catch (err) {
                this.status = this.$t('chatlogs_clear_failed', {
                    reason: err.message || String(err),
                });
            }
        },
    },
};
</script>

<style>
.kiwi-chatlogs-description {
    margin-bottom: 0.8em;
}

.kiwi-chatlogs-note {
    margin-bottom: 0.8em;
    opacity: 0.8;
    font-size: 0.9em;
}

.kiwi-chatlogs-retention {
    display: flex;
    align-items: center;
    gap: 0.6em;
    margin-bottom: 0.6em;
}

.kiwi-chatlogs-stats {
    margin-bottom: 0.8em;
    opacity: 0.8;
    font-size: 0.9em;
}

.kiwi-chatlogs-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
}

.kiwi-chatlogs-status {
    margin-top: 0.6em;
    font-size: 0.9em;
}
</style>
