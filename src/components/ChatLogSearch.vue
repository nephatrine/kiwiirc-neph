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
                    <select
                        v-if="availableSources.length > 1"
                        v-model="source"
                        class="u-input"
                        @change="onSourceChange"
                    >
                        <option v-if="localAvailable" :value="sourceLocal">
                            {{ $t('chatlogs_source_local') }}
                        </option>
                        <option v-if="serverAvailable" :value="sourceServer">
                            {{ $t('chatlogs_source_server') }}
                        </option>
                    </select>
                    <span v-else class="kiwi-logsearch-source">{{ sourceLabel }}</span>
                    <select v-model.number="networkId" class="u-input" @change="onNetworkChange">
                        <option v-if="source === sourceLocal" :value="0">
                            {{ $t('chatlogs_all_networks') }}
                        </option>
                        <option
                            v-for="network in selectableNetworks"
                            :key="network.id"
                            :value="network.id"
                        >
                            {{ network.name || network.connection.server }}
                        </option>
                    </select>
                    <template v-if="source === sourceServer">
                        <input
                            v-model.trim="bufferName"
                            class="u-input"
                            list="kiwi-search-targets"
                            :placeholder="$t('chatlogs_server_target')"
                            type="text"
                        >
                        <datalist id="kiwi-search-targets">
                            <option
                                v-for="target in serverTargets"
                                :key="target.id"
                                :value="target.name"
                            />
                        </datalist>
                    </template>
                    <span v-else-if="bufferName" class="kiwi-logsearch-buffer">
                        <span>{{ bufferName }}</span>
                        <button
                            type="button"
                            :title="$t('close')"
                            @click="clearBufferFilter"
                        >
                            <i class="bx bx-x" aria-hidden="true" />
                        </button>
                    </span>
                    <button
                        type="submit"
                        class="u-button u-button-primary"
                        :disabled="loading || !!searchPrompt"
                    >
                        {{ $t('chatlogs_search_action') }}
                    </button>
                </form>

                <div v-if="sourceHint" class="kiwi-logsearch-hint">
                    {{ sourceHint }}
                </div>
                <div
                    v-if="source === sourceServer"
                    class="kiwi-logsearch-hint"
                >
                    {{ $t('chatlogs_server_target_hint') }}
                </div>

                <div v-if="error" class="kiwi-logsearch-error">
                    {{ error }}
                </div>

                <div v-if="loading" class="kiwi-logsearch-status">
                    <i class="bx bx-loader-alt bx-spin" aria-hidden="true" />
                    {{ $t('chatlogs_searching') }}
                </div>
                <div v-else-if="searchPrompt" class="kiwi-logsearch-status">
                    {{ searchPrompt }}
                </div>
                <div v-else-if="results.length" class="kiwi-logsearch-results">
                    <button
                        v-for="result in results"
                        :key="result.id"
                        type="button"
                        class="kiwi-logsearch-result"
                        :class="{
                            'kiwi-logsearch-result-redacted': result.is_redacted,
                            'kiwi-logsearch-result--unloaded': isServerResultUnloaded(result),
                            'kiwi-logsearch-result--loading': isResultLoading(result),
                        }"
                        :title="isServerResultUnloaded(result) ?
                            $t('chatlogs_result_load_hint') : ''"
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
                        <span
                            v-if="isResultLoading(result)"
                            class="kiwi-logsearch-result-status"
                        >
                            {{ $t('chatlogs_loading_context') }}
                        </span>
                        <span
                            v-else-if="isServerResultUnloaded(result)"
                            class="kiwi-logsearch-result-status"
                        >
                            {{ $t('chatlogs_result_not_loaded') }}
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
import * as MessageSearch from '@/libs/MessageSearch';

const PAGE_SIZE = 50;

export default {
    data() {
        return {
            visible: false,
            query: '',
            source: MessageSearch.SOURCE_LOCAL,
            networkId: 0,
            bufferName: '',
            results: [],
            loadedResultIds: {},
            loadingResultIds: {},
            loading: false,
            hasMore: false,
            offset: 0,
            serverBefore: 0,
            lastSource: '',
            searchGeneration: 0,
            error: '',
            removeOpenListener: null,
        };
    },
    computed: {
        networks() {
            return this.$state.networks;
        },
        sourceLocal() {
            return MessageSearch.SOURCE_LOCAL;
        },
        sourceServer() {
            return MessageSearch.SOURCE_SERVER;
        },
        localAvailable() {
            return ChatLogs.isAvailable();
        },
        serverNetworks() {
            return MessageSearch.serverSearchNetworks(this.$state);
        },
        serverAvailable() {
            return this.serverNetworks.length > 0;
        },
        availableSources() {
            const sources = [];
            if (this.localAvailable) {
                sources.push(MessageSearch.SOURCE_LOCAL);
            }
            if (this.serverAvailable) {
                sources.push(MessageSearch.SOURCE_SERVER);
            }
            return sources;
        },
        selectableNetworks() {
            return this.source === MessageSearch.SOURCE_SERVER ?
                this.serverNetworks :
                this.networks;
        },
        serverTargets() {
            const network = this.$state.getNetwork(this.networkId);
            if (!network) {
                return [];
            }
            return (network.buffers || []).filter((buffer) => (
                (buffer.isChannel() || buffer.isQuery()) && !buffer.isSpecial()
            ));
        },
        sourceLabel() {
            return this.source === MessageSearch.SOURCE_SERVER ?
                this.$t('chatlogs_source_server') :
                this.$t('chatlogs_source_local');
        },
        sourceHint() {
            if (this.source === MessageSearch.SOURCE_SERVER) {
                return this.$t('chatlogs_source_server_hint');
            }
            if (this.localAvailable) {
                return this.$t('chatlogs_source_local_hint');
            }
            return '';
        },
        searchPrompt() {
            if (this.source !== MessageSearch.SOURCE_SERVER) {
                return '';
            }
            if (!this.networkId) {
                return this.$t('chatlogs_server_network_required');
            }
            if (!this.bufferName.trim()) {
                return this.$t('chatlogs_server_target_required');
            }
            if (!this.query.trim()) {
                return this.$t('chatlogs_server_query_prompt');
            }
            return '';
        },
    },
    created() {
        this.listen(this.$state, 'chatlogs.open', (options) => this.open(options));
        this.removeOpenListener = ChatLogs.onOpenSearch(() => this.open());
    },
    beforeDestroy() {
        if (typeof this.removeOpenListener === 'function') {
            this.removeOpenListener();
        }
    },
    methods: {
        defaultServerTarget() {
            const getActiveBuffer = this.$state && this.$state.getActiveBuffer;
            const buffer = typeof getActiveBuffer === 'function' ?
                getActiveBuffer.call(this.$state) :
                null;
            if (!buffer) {
                return '';
            }
            if (buffer.networkid !== this.networkId) {
                return '';
            }
            if (!buffer.isChannel() && !buffer.isQuery()) {
                return '';
            }
            return buffer.name || '';
        },
        open(options = {}) {
            this.visible = true;
            this.error = '';

            const available = this.availableSources;
            let source = options.source;
            if (!available.includes(source)) {
                source = MessageSearch.defaultSource(this.$state);
            }
            if (!available.includes(source) && available.length > 0) {
                source = available[0];
            }
            this.source = source || MessageSearch.SOURCE_LOCAL;

            const requestedNetwork = Number(options.networkId) || 0;
            const activeNetwork = this.$state.getActiveNetwork();
            if (
                this.source === MessageSearch.SOURCE_SERVER &&
                !this.serverNetworks.some((network) => network.id === requestedNetwork)
            ) {
                if (activeNetwork &&
                    this.serverNetworks.some((network) => network.id === activeNetwork.id)
                ) {
                    this.networkId = activeNetwork.id;
                } else {
                    this.networkId = this.serverNetworks[0] ?
                        this.serverNetworks[0].id :
                        0;
                }
            } else {
                this.networkId = requestedNetwork;
            }

            this.bufferName = typeof options.bufferName === 'string' ?
                options.bufferName :
                '';
            if (
                this.source === MessageSearch.SOURCE_SERVER &&
                !this.bufferName
            ) {
                this.bufferName = this.defaultServerTarget();
            }
            this.resetSearch();
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
        resetSearch() {
            this.results = [];
            this.loadedResultIds = {};
            this.loadingResultIds = {};
            this.hasMore = false;
            this.offset = 0;
            this.serverBefore = 0;
            this.lastSource = '';
        },
        clearBufferFilter() {
            this.bufferName = '';
            this.search(true);
        },
        onSourceChange() {
            if (
                this.source === MessageSearch.SOURCE_SERVER &&
                !this.serverNetworks.some((network) => network.id === this.networkId)
            ) {
                const activeNetwork = this.$state.getActiveNetwork();
                if (activeNetwork &&
                    this.serverNetworks.some((network) => network.id === activeNetwork.id)
                ) {
                    this.networkId = activeNetwork.id;
                } else {
                    this.networkId = this.serverNetworks[0] ?
                        this.serverNetworks[0].id :
                        0;
                }
            }
            if (this.source === MessageSearch.SOURCE_SERVER && !this.bufferName) {
                this.bufferName = this.defaultServerTarget();
            }
            this.search(true);
        },
        onNetworkChange() {
            this.bufferName = '';
            if (this.source === MessageSearch.SOURCE_SERVER) {
                this.bufferName = this.defaultServerTarget();
            }
            this.search(true);
        },
        formatTime(time) {
            return new Date(time).toLocaleString();
        },
        resultKey(result) {
            if (result.source === MessageSearch.SOURCE_SERVER) {
                return result.irc_id ?
                    `server:${result.network_id}:${result.irc_id}` :
                    `server:${result.network_id}:${result.buffer_name}:${result.server_time}:` +
                        `${result.nick}:${result.message}`;
            }
            return `local:${result.id}`;
        },
        isServerResultUnloaded(result) {
            return !!(result &&
                result.source === MessageSearch.SOURCE_SERVER &&
                !this.loadedResultIds[result.id]);
        },
        isResultLoading(result) {
            return !!(result && this.loadingResultIds[result.id]);
        },
        syncLoadedResults() {
            this.results.forEach((result) => {
                if (result.source !== MessageSearch.SOURCE_SERVER ||
                    this.loadedResultIds[result.id]
                ) {
                    return;
                }
                const buffer = this.$state.getBufferByName(
                    result.network_id,
                    result.buffer_name
                );
                if (buffer && buffer.findLogResultMessage(result)) {
                    this.$set(this.loadedResultIds, result.id, true);
                }
            });
        },
        loadResultContext(result) {
            if (!result || this.loadingResultIds[result.id]) {
                return;
            }

            this.$set(this.loadingResultIds, result.id, true);
            this.error = '';

            MessageSearch.loadServerResult(this.$state, result).then((loaded) => {
                this.$set(this.loadingResultIds, result.id, false);
                if (!loaded) {
                    this.error = this.$t('chatlogs_jump_failed');
                    return;
                }
                this.$set(this.loadedResultIds, result.id, true);
                this.syncLoadedResults();
            }).catch(() => {
                this.$set(this.loadingResultIds, result.id, false);
                this.error = this.$t('chatlogs_jump_failed');
            });
        },
        async search(reset) {
            if (this.loading && !reset) {
                return;
            }

            if (reset) {
                // Invalidate any in-flight search so its result cannot
                // overwrite a newer source, network, or query.
                this.searchGeneration += 1;
                this.loading = false;
                this.resetSearch();
            }

            if (this.source === MessageSearch.SOURCE_SERVER) {
                if (this.searchPrompt) {
                    return;
                }
                if (!MessageSearch.serverSearchAvailable(
                    this.$state.getNetwork(this.networkId)
                )) {
                    this.error = this.$t('chatlogs_server_unavailable');
                    return;
                }
            } else if (!this.localAvailable) {
                this.error = this.$t('chatlogs_local_unavailable');
                return;
            }

            this.loading = true;
            this.error = '';
            const generation = ++this.searchGeneration;
            try {
                let result;
                if (this.source === MessageSearch.SOURCE_SERVER) {
                    result = await MessageSearch.searchServer({
                        state: this.$state,
                        networkId: this.networkId,
                        bufferName: this.bufferName,
                        query: this.query,
                        limit: PAGE_SIZE,
                        before: this.serverBefore || 0,
                    });
                } else {
                    result = await MessageSearch.searchLocal({
                        query: this.query,
                        networkId: this.networkId,
                        bufferName: this.bufferName,
                        limit: PAGE_SIZE,
                        offset: this.offset,
                    });
                }

                if (generation !== this.searchGeneration) {
                    return;
                }

                const rows = result.rows || [];
                if (this.source === MessageSearch.SOURCE_SERVER) {
                    const existing = new Set(this.results.map((item) => (
                        this.resultKey(item)
                    )));
                    const newRows = rows.filter((item) => (
                        !existing.has(this.resultKey(item))
                    ));
                    this.results = reset ? rows : this.results.concat(newRows);
                    this.hasMore = !!result.hasMore && rows.length > 0;
                    if (!reset && newRows.length === 0) {
                        this.hasMore = false;
                    }
                    if (rows.length) {
                        const oldest = rows[rows.length - 1];
                        this.serverBefore = oldest.server_time || 0;
                    }
                } else {
                    this.results = reset ? rows : this.results.concat(rows);
                    this.offset += rows.length;
                    this.hasMore = !!result.hasMore;
                }
                this.lastSource = this.source;
                this.syncLoadedResults();
            } catch (err) {
                if (generation !== this.searchGeneration) {
                    return;
                }
                const key = this.source === MessageSearch.SOURCE_SERVER ?
                    'chatlogs_server_search_failed' :
                    'chatlogs_search_failed';
                this.error = this.$t(key, {
                    reason: err.message || String(err),
                });
            } finally {
                if (generation === this.searchGeneration) {
                    this.loading = false;
                }
            }
        },
        openResult(result) {
            if (this.isServerResultUnloaded(result)) {
                this.loadResultContext(result);
                return;
            }

            MessageSearch.openResult(this.$state, result).then((opened) => {
                if (!opened) {
                    this.$state.$emit(
                        'notification.show',
                        this.$t('chatlogs_jump_failed'),
                        { force: true }
                    );
                    return;
                }
                this.close();
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
    flex-wrap: wrap;
    gap: 0.5em;
    align-items: center;
    margin-top: 0.8em;
}

.kiwi-logsearch-buffer {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.35em 0.5em;
    border: 1px solid rgb(127 127 127 / 35%);
    border-radius: 4px;
    white-space: nowrap;
}

.kiwi-logsearch-buffer button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    color: inherit;
    background: transparent;
    cursor: pointer;
}

.kiwi-logsearch-form input {
    flex: 1;
}

.kiwi-logsearch-source {
    padding: 0 0.5em;
    opacity: 0.8;
    white-space: nowrap;
}

.kiwi-logsearch-hint {
    margin-top: 0.6em;
    opacity: 0.75;
    font-size: 0.9em;
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

.kiwi-logsearch-result--unloaded {
    opacity: 0.65;
}

.kiwi-logsearch-result--loading {
    cursor: wait;
}

.kiwi-logsearch-result-status {
    display: block;
    margin-top: 0.2em;
    font-size: 0.8em;
    font-weight: 600;
    opacity: 0.8;
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
