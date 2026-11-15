<template>
    <div class="kiwi-appsettings-block kiwi-messaging-permissions">
        <h3>{{ $t('settings_messaging_permissions') }}</h3>
        <div class="kiwi-appsettings-section">
            <label class="kiwi-appsettings-messagelistDisplay">
                <span>{{ $t('settings_block_private') }}</span>
                <select v-model="blockDirectMessages">
                    <option value="default">
                        {{ $t('settings_block_private_default') }}
                    </option>
                    <option value="block">
                        {{ $t('settings_block_private_block') }}
                    </option>
                    <option value="allow">
                        {{ $t('settings_block_private_allow') }}
                    </option>
                    <option value="friends">
                        {{ $t('settings_block_private_friends') }}
                    </option>
                </select>
            </label>

            <div class="kiwi-messaging-permissions-ignored">
                <h4>{{ $t('settings_ignored_accounts') }}</h4>
                <p class="kiwi-appsettings-hint">
                    {{ $t('settings_ignored_accounts_hint') }}
                </p>
                <div class="kiwi-messaging-permissions-add">
                    <input
                        v-model.trim="ignoredNick"
                        :list="suggestionListId"
                        :placeholder="$t('settings_ignored_accounts_placeholder')"
                        autocomplete="off"
                        class="u-input"
                        type="text"
                        @keydown.enter.prevent="addIgnored"
                    >
                    <datalist :id="suggestionListId">
                        <option
                            v-for="suggestion in suggestions"
                            :key="suggestion.key"
                            :value="suggestion.nick"
                            :label="suggestion.label"
                        />
                    </datalist>
                    <button
                        type="button"
                        class="u-button u-button-primary"
                        :disabled="!canAdd"
                        @click="addIgnored"
                    >
                        {{ $t('settings_ignored_accounts_add') }}
                    </button>
                </div>
                <p v-if="error" class="kiwi-messaging-permissions-error">
                    {{ error }}
                </p>
                <p v-if="isSojuMetadataBacked" class="kiwi-appsettings-hint">
                    {{ $t('settings_ignored_accounts_soju_hint') }}
                </p>
                <ul v-if="ignoredEntries.length" class="kiwi-messaging-permissions-list">
                    <li
                        v-for="entry in ignoredEntries"
                        :key="entryKey(entry)"
                        class="kiwi-messaging-permissions-entry"
                    >
                        <span class="kiwi-messaging-permissions-entry-name">
                            {{ entryLabel(entry) }}
                        </span>
                        <button
                            type="button"
                            class="u-button u-button-warning kiwi-messaging-permissions-remove"
                            :aria-label="$t('settings_ignored_accounts_remove')"
                            @click="removeIgnored(entry)"
                        >
                            <i class="bx bx-x" aria-hidden="true" />
                        </button>
                    </li>
                </ul>
                <p v-else class="kiwi-appsettings-hint">
                    {{ $t('settings_ignored_accounts_empty') }}
                </p>
            </div>
        </div>
    </div>
</template>

<script>
'kiwi public';

export default {
    props: {
        network: {
            type: Object,
            required: true,
        },
    },
    data() {
        return {
            ignoredNick: '',
            error: '',
        };
    },
    computed: {
        blockDirectMessages: {
            get() {
                return this.network.setting('blockDirectMessages') || 'default';
            },
            set(value) {
                this.network.setting('blockDirectMessages', value);
            },
        },
        isSojuMetadataBacked() {
            return this.network.isSojuMetadataBacked();
        },
        ignoredEntries() {
            return this.network.ignoredEntries();
        },
        suggestions() {
            return Object.values(this.network.users)
                .filter((user) => user && user.nick)
                .filter((user) => !this.network.caseCompare(user.nick, this.network.nick))
                .filter((user) => !this.ignoredEntries.some((entry) => (
                    this.network.identityMatches(entry, user)
                )))
                .map((user) => ({
                    key: this.network.caseUpper(user.nick),
                    nick: user.nick,
                    label: user.account ? `(${user.account})` : '',
                }))
                .sort((left, right) => left.nick.localeCompare(right.nick));
        },
        suggestionListId() {
            return `kiwi-ignored-accounts-${this.network.id}`;
        },
        canAdd() {
            if (!this.ignoredNick) {
                return false;
            }
            if (!this.isSojuMetadataBacked) {
                return true;
            }
            return !!this.network.userByName(this.ignoredNick);
        },
    },
    watch: {
        network() {
            this.ignoredNick = '';
            this.error = '';
        },
    },
    methods: {
        addIgnored() {
            const result = this.network.addIgnoredNick(this.ignoredNick);
            if (!result.ok) {
                this.error = this.errorFor(result.reason);
                return;
            }
            this.ignoredNick = '';
            this.error = '';
        },
        removeIgnored(entry) {
            const result = this.network.removeIgnoredEntry(entry);
            if (!result.ok) {
                this.error = this.errorFor(result.reason);
                return;
            }
            this.error = '';
        },
        errorFor(reason) {
            if (reason === 'self') {
                return this.$t('settings_ignored_accounts_self');
            }
            if (reason === 'duplicate') {
                return this.$t('settings_ignored_accounts_duplicate');
            }
            if (reason === 'not-connected') {
                return this.$t('settings_ignored_accounts_not_connected');
            }
            return '';
        },
        entryKey(entry) {
            const nick = this.network.caseUpper(entry.nick);
            const account = this.network.caseUpper(entry.account);
            return `${nick}:${account}`;
        },
        entryLabel(entry) {
            if (entry.account && !this.network.caseCompare(entry.account, entry.nick)) {
                return `${entry.nick} (${entry.account})`;
            }
            return entry.nick;
        },
    },
};
</script>

<style>
.kiwi-messaging-permissions-ignored {
    margin-top: 1em;
}

.kiwi-messaging-permissions-add {
    display: flex;
    gap: 0.5em;
    margin-bottom: 10px;
}

.kiwi-messaging-permissions-add .u-input {
    flex: 1 1 auto;
    min-width: 0;
}

.kiwi-messaging-permissions-list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.kiwi-messaging-permissions-entry {
    align-items: center;
    display: flex;
    gap: 1em;
    justify-content: space-between;
    padding: 4px 0;
}

.kiwi-messaging-permissions-entry-name {
    overflow-wrap: anywhere;
}

.kiwi-messaging-permissions-remove {
    flex: 0 0 auto;
}

.kiwi-messaging-permissions-error {
    color: #d9534f;
    font-size: 0.9em;
    margin: 0 0 10px 2px;
}
</style>
