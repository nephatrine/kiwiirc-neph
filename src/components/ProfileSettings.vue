<template>
    <div class="kiwi-appsettings-block kiwi-profile-settings">
        <h3>{{ $t('profile_transfer') }}</h3>
        <div class="kiwi-appsettings-section">
            <div class="kiwi-profile-description">
                {{ $t('profile_transfer_description') }}
            </div>
            <label class="u-checkbox-wrapper">
                <span>{{ $t('profile_include_passwords') }}</span>
                <input v-model="includePasswords" type="checkbox">
            </label>
            <div v-if="includePasswords" class="kiwi-profile-warning">
                {{ $t('profile_include_passwords_warning') }}
            </div>
            <div
                v-if="statusMessage"
                class="kiwi-profile-status"
                :class="'kiwi-profile-status--' + statusType"
            >
                {{ statusMessage }}
            </div>
            <div class="kiwi-profile-actions">
                <button
                    type="button"
                    class="u-button u-button-primary kiwi-profile-export"
                    :disabled="busy"
                    @click="exportProfile"
                >
                    {{ $t('profile_export') }}
                </button>
                <button
                    v-if="isPersonalMode"
                    type="button"
                    class="u-button kiwi-profile-import"
                    :disabled="busy"
                    @click="chooseImport"
                >
                    {{ $t('profile_import') }}
                </button>
                <button
                    v-if="isDesktop"
                    type="button"
                    class="u-button"
                    :disabled="busy"
                    @click="openProfileFolder"
                >
                    {{ $t('profile_open_folder') }}
                </button>
            </div>
            <input
                v-if="isPersonalMode && !isDesktop"
                ref="fileInput"
                class="kiwi-profile-file-input"
                type="file"
                accept="application/json,.json"
                @change="onFileSelected"
            >
        </div>
    </div>
</template>

<script>
'kiwi public';

import desktop from '@/libs/desktop';
import * as MetadataCache from '@/libs/MetadataCache';
import {
    MAX_PROFILE_BYTES,
    applyProfileBundle,
    buildProfileBundle,
    collectProfileSecrets,
    downloadProfileBundle,
    parseProfileBundleText,
    profileBundleFilename
} from '@/libs/ProfileTransfer';

export default {
    data() {
        return {
            includePasswords: false,
            busy: false,
            statusMessage: '',
            statusType: 'success',
        };
    },
    computed: {
        isDesktop() {
            return desktop.isDesktop() && desktop.profile.isAvailable();
        },
        isPersonalMode() {
            return this.$state.getSetting('settings.startupScreen') === 'personal';
        },
    },
    methods: {
        setStatus(key, params, type = 'success') {
            this.statusMessage = this.$t(key, params || {});
            this.statusType = type;
        },
        clearStatus() {
            this.statusMessage = '';
        },
        async flushState() {
            if (this.$state.persistence) {
                const result = await this.$state.persistence.saveStateNow();
                if (result && result.stateSaved === false) {
                    throw new Error('state could not be saved');
                }
            }
            await MetadataCache.flush();
        },
        async exportProfile() {
            if (this.busy) {
                return;
            }
            this.clearStatus();
            if (this.includePasswords &&
                !window.confirm(this.$t('profile_include_passwords_confirm'))
            ) {
                return;
            }

            this.busy = true;
            try {
                await this.flushState();

                let secrets = {};
                if (this.includePasswords) {
                    secrets = collectProfileSecrets(this.$state);
                }

                const bundle = buildProfileBundle(this.$state, {
                    includePasswords: this.includePasswords,
                    secrets,
                    source: this.isDesktop ? 'desktop' : 'web',
                });

                if (this.isDesktop) {
                    const result = await desktop.profile.exportBundle(
                        bundle,
                        profileBundleFilename()
                    );
                    if (result && result.saved) {
                        this.setStatus('profile_export_success');
                    }
                } else {
                    downloadProfileBundle(bundle);
                    this.setStatus('profile_export_success');
                }
            } catch (err) {
                this.setStatus(
                    'profile_export_failed',
                    { reason: err.message || String(err) },
                    'error'
                );
            } finally {
                this.busy = false;
            }
        },
        chooseImport() {
            if (this.busy) {
                return;
            }
            if (!this.isPersonalMode) {
                this.setStatus('profile_import_personal_only', {}, 'error');
                return;
            }
            this.clearStatus();
            if (this.isDesktop) {
                desktop.profile.importBundle().then((result) => {
                    if (!result || result.canceled) {
                        return null;
                    }
                    return this.importProfileText(result.text);
                }).catch((err) => {
                    this.setStatus(
                        'profile_import_failed',
                        { reason: err.message || String(err) },
                        'error'
                    );
                });
                return;
            }

            this.$refs.fileInput.click();
        },
        async onFileSelected(event) {
            if (!this.isPersonalMode) {
                this.setStatus('profile_import_personal_only', {}, 'error');
                return;
            }
            const input = event.target;
            const file = input.files && input.files[0];
            input.value = '';
            if (!file) {
                return;
            }
            if (file.size > MAX_PROFILE_BYTES) {
                this.setStatus('profile_import_too_large', {}, 'error');
                return;
            }

            try {
                await this.importProfileText(await file.text());
            } catch (err) {
                this.setStatus(
                    'profile_import_failed',
                    { reason: err.message || String(err) },
                    'error'
                );
            }
        },
        async importProfileText(text) {
            if (!this.isPersonalMode) {
                this.setStatus('profile_import_personal_only', {}, 'error');
                return;
            }
            const bundle = parseProfileBundleText(text);
            const hasSecrets = !!bundle.secrets &&
                Object.keys(bundle.secrets).length > 0;
            const confirmKey = hasSecrets ?
                'profile_import_passwords_confirm' :
                'profile_import_confirm';
            if (!window.confirm(this.$t(confirmKey))) {
                return;
            }

            this.busy = true;
            try {
                if (!this.$state.persistence) {
                    throw new Error('state persistence is unavailable');
                }
                if (this.isDesktop) {
                    await desktop.profile.backup();
                }

                applyProfileBundle(this.$state, bundle);
                if (hasSecrets) {
                    this.$state.persistence.includePasswords = true;
                    this.$state.user_settings.remember_password = true;
                }

                await MetadataCache.clear();
                const result = await this.$state.persistence.saveStateNow();
                if (hasSecrets && result && result.secretsSaved === false) {
                    throw new Error(this.$t('profile_password_save_failed'));
                }

                this.setStatus('profile_import_success');
                window.onbeforeunload = null;
                window.location.reload();
            } catch (err) {
                this.setStatus(
                    'profile_import_failed',
                    { reason: err.message || String(err) },
                    'error'
                );
            } finally {
                this.busy = false;
            }
        },
        async openProfileFolder() {
            try {
                await desktop.profile.openFolder();
            } catch (err) {
                this.setStatus(
                    'profile_open_folder_failed',
                    { reason: err.message || String(err) },
                    'error'
                );
            }
        },
    },
};
</script>

<style>
.kiwi-profile-description {
    margin-bottom: 0.8em;
}

.kiwi-profile-warning {
    margin: 0.6em 0;
    padding: 0.6em 0.8em;
    border: 1px solid rgb(180 120 0 / 30%);
    background: rgb(180 120 0 / 10%);
    font-size: 0.9em;
    border-radius: 4px;
}

.kiwi-profile-status {
    margin: 0.6em 0;
    font-size: 0.9em;
}

.kiwi-profile-status--error {
    color: #c0392b;
}

.kiwi-profile-status--success {
    color: #1e8449;
}

.kiwi-profile-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
    margin-top: 0.8em;
}

.kiwi-profile-file-input {
    display: none;
}
</style>
