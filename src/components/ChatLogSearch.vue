<template>
    <transition name="kiwi-logsearch-fade">
        <div
            v-if="visible"
            class="kiwi-logsearch"
            @click.self="close"
            @keydown.esc="close"
        >
            <div class="kiwi-logsearch-panel">
                <div class="kiwi-logsearch-header">
                    <h3>{{ $t('chatlogs_search_title') }}</h3>
                    <button type="button" class="kiwi-logsearch-close" @click="close">
                        <i class="bx bx-x" aria-hidden="true" />
                    </button>
                </div>

                <form class="kiwi-logsearch-form" @submit.prevent="search(true)">
                    <input
                        ref="queryInput"
                        v-model="query"
                        class="u-input"
                        :placeholder="$t('chatlogs_search_placeholder')"
                        type="search"
                    >
                    <select v-model.number="networkId" class="u-input" @change="search(true)">
                        <option :value="0">{{ $t('chatlogs_all_networks') }}</option>
                        <option
                            v-for="network in networks"
                            :key="network.id"
                            :value="network.id"
                        >
                            {{ network.name || network.connection.server }}
                        </option>
                    </select>
                    <button type="submit" class="u-button u-button-primary" :disabled="loading">
                        {{ $t('chatlogs_search_action') }}
                    </button>
                </form>

                <div v-if="error" class="kiwi-logsearch-error">
                    {{ error }}
                </div>

                <div v-if="loading" class="kiwi-logsearch-status">
                    <i class="bx bx-loader-alt bx-spin" aria-hidden="true" />
                    {{ $t('chatlogs_searching') }}
                </div>
                <div v-else-if="results.length" class="kiwi-logsearch-results">
                    <button
                        v-for="result in results"
                        :key="result.id"
                        type="button"
                        class="kiwi-logsearch-result"
                        :class="{ 'kiwi-logsearch-result-redacted': result.is_redacted }"
                        @click="openResult(result)"
                    >
                        <span class="kiwi-logsearch-meta">
                            {{ formatTime(result.time) }}
                            · {{ result.network_name || result.buffer_name }}
                            · {{ result.buffer_name }}
                            <template v-if="result.nick">
                                · {{ result.nick }}
                            </template>
                        </span>
                        <span v-if="result.is_redacted" class="kiwi-logsearch-redacted">
                            {{ result.redacted_by ?
                                $t('chatlogs_redacted_by', { nick: result.redacted_by }) :
                                $t('chatlogs_redacted') }}
                            <template v-if="result.redaction_reason">
                                · {{ result.redaction_reason }}
                            </template>
                        </span>
                        <span
                            v-if="result.message || result.raw_text"
                            class="kiwi-logsearch-message"
                            :class="{ 'kiwi-logsearch-message-redacted': result.is_redacted }"
                        >
                            {{ result.message || result.raw_text }}
                        </span>
                    </button>
                    <button
                        v-if="hasMore"
                        type="button"
                        class="u-button kiwi-logsearch-more"
                        :disabled="loading"
                        @click="search(false)"
                    >
                        {{ $t('chatlogs_load_more') }}
                    </button>
                </div>
                <div v-else-if="!loading" class="kiwi-logsearch-status">
                    {{ $t('chatlogs_no_results') }}
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
'kiwi public';

import * as ChatLogs from '@/libs/desktop/ChatLogs';
import * as ChatLogContext from '@/libs/ChatLogContext';

const PAGE_SIZE = 50;

export default {
    data() {
        return {
            visible: false,
            query: '',
            networkId: 0,
            results: [],
            loading: false,
            hasMore: false,
            offset: 0,
            error: '',
            removeOpenListener: null,
        };
    },
    computed: {
        networks() {
            return this.$state.networks;
        },
    },
    created() {
        this.listen(this.$state, 'chatlogs.open', () => this.open());
        this.removeOpenListener = ChatLogs.onOpenSearch(() => this.open());
    },
    beforeDestroy() {
        if (typeof this.removeOpenListener === 'function') {
            this.removeOpenListener();
        }
    },
    methods: {
        open() {
            this.visible = true;
            this.error = '';
            this.$nextTick(() => {
                if (this.$refs.queryInput) {
                    this.$refs.queryInput.focus();
                }
            });
            this.search(true);
        },
        close() {
            this.visible = false;
        },
        formatTime(time) {
            return new Date(time).toLocaleString();
        },
        async search(reset) {
            if (this.loading) {
                return;
            }

            if (reset) {
                this.offset = 0;
                this.results = [];
            }

            this.loading = true;
            this.error = '';
            try {
                const result = await ChatLogs.search({
                    query: this.query,
                    networkId: this.networkId,
                    limit: PAGE_SIZE,
                    offset: this.offset,
                });
                const rows = result.rows || [];
                this.results = reset ? rows : this.results.concat(rows);
                this.offset += rows.length;
                this.hasMore = !!result.hasMore;
            } catch (err) {
                this.error = this.$t('chatlogs_search_failed', {
                    reason: err.message || String(err),
                });
            } finally {
                this.loading = false;
            }
        },
        openResult(result) {
            const network = this.$state.getNetwork(result.network_id);
            const buffer = this.$state.getBufferByName(
                result.network_id,
                result.buffer_name
            );
            const loaded = buffer && buffer.findLogResultMessage(result);

            if (loaded) {
                this.$state.setActiveBuffer(result.network_id, result.buffer_name);
                this.$nextTick(() => {
                    buffer.scrollToMessage(loaded.id);
                });
                this.close();
                return;
            }

            const openContext = () => {
                this.close();
                ChatLogContext.openContextResult(this.$state, result).then((opened) => {
                    if (!opened) {
                        this.$state.$emit(
                            'notification.show',
                            this.$t('chatlogs_jump_failed'),
                            { force: true }
                        );
                    }
                });
            };

            const canUseServerHistory = !!(
                buffer &&
                !buffer.contextOnly &&
                network &&
                network.state === 'connected' &&
                (buffer.joined || buffer.isQuery())
            );
            if (!canUseServerHistory) {
                openContext();
                return;
            }

            this.$state.setActiveBuffer(result.network_id, buffer.name);
            this.close();
            buffer.jumpToMessage(result).then((jumped) => {
                if (!jumped) {
                    openContext();
                }
            });
        },
    },
};
</script>

<style>
.kiwi-logsearch {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 8vh 1em 1em;
    background: rgb(0 0 0 / 55%);
    box-sizing: border-box;
}

.kiwi-logsearch-panel {
    width: min(800px, 100%);
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 1em;
    border-radius: 6px;
    background: var(--kiwi-app-bg, #1e1e1e);
    color: var(--kiwi-app-fg, #eee);
    box-shadow: 0 1em 3em rgb(0 0 0 / 35%);
}

.kiwi-logsearch-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.kiwi-logsearch-header h3 {
    margin: 0;
}

.kiwi-logsearch-close {
    border: 0;
    background: none;
    color: inherit;
    cursor: pointer;
    font-size: 1.5em;
}

.kiwi-logsearch-form {
    display: flex;
    gap: 0.5em;
    margin-top: 0.8em;
}

.kiwi-logsearch-form input {
    flex: 1;
}

.kiwi-logsearch-error {
    margin-top: 0.8em;
    color: #e05a5a;
}

.kiwi-logsearch-status {
    padding: 1em 0;
    text-align: center;
}

.kiwi-logsearch-results {
    margin-top: 0.8em;
    overflow-y: auto;
}

.kiwi-logsearch-result {
    display: block;
    width: 100%;
    padding: 0.6em 0.4em;
    border: 0;
    border-bottom: 1px solid rgb(127 127 127 / 20%);
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
}

.kiwi-logsearch-result:hover {
    background: rgb(127 127 127 / 12%);
}

.kiwi-logsearch-meta {
    display: block;
    margin-bottom: 0.2em;
    opacity: 0.7;
    font-size: 0.85em;
}

.kiwi-logsearch-message {
    overflow-wrap: anywhere;
}

.kiwi-logsearch-redacted {
    display: block;
    margin-bottom: 0.2em;
    color: #e05a5a;
    font-size: 0.85em;
    font-weight: 600;
}

.kiwi-logsearch-message-redacted {
    opacity: 0.65;
    text-decoration: line-through;
}

.kiwi-logsearch-result-redacted {
    border-left: 2px solid #e05a5a;
    padding-left: 0.6em;
}

.kiwi-logsearch-more {
    margin-top: 0.8em;
}

.kiwi-logsearch-fade-enter-active,
.kiwi-logsearch-fade-leave-active {
    transition: opacity 0.15s;
}

.kiwi-logsearch-fade-enter,
.kiwi-logsearch-fade-leave-to {
    opacity: 0;
}
</style>
