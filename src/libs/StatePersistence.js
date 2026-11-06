'kiwi public';

import * as MetadataCache from '@/libs/MetadataCache';
import * as WebpushUtils from '@/libs/WebpushUtils';
import { debounce } from '@/helpers/Async';

export default class StatePersistence {
    constructor(storageKey, state, storage, logger, secretStore = null) {
        this.storageKey = storageKey;
        this.state = state;
        this.storage = storage;
        this.logger = logger;
        this.secretStore = secretStore;
        this.secretLoadFailed = false;
        this.isPersisting = false;
        this.includeBuffers = true;
        // Set by the startup screen from the Remember Password checkbox.
        // Other startups leave the default, preserving past behaviour.
        this.includePasswords = true;
        this.watcher = null;

        this.state.persistence = this;
    }

    async loadStateIfExists() {
        if (!this.storageKey) {
            return;
        }

        // If we have networks from a previous state, launch directly into it
        let storedState = await this.storage.get(this.storageKey);
        if (storedState) {
            if (this.logger) {
                this.logger('Importing stored state');
            }

            this.state.importState(storedState);
        }

        await this.loadSecrets();
    }

    networkAllowsPassword(network) {
        return !network ||
            typeof network.setting !== 'function' ||
            network.setting('rememberPassword') !== false;
    }

    async loadSecrets() {
        if (!this.secretStore || !this.storageKey) {
            return;
        }

        try {
            const secrets = await this.secretStore.load(this.storageKey);
            if (secrets) {
                Object.keys(secrets).forEach((networkId) => {
                    const network = this.state.getNetwork(Number(networkId));
                    if (!network || !this.networkAllowsPassword(network)) {
                        return;
                    }

                    const entry = secrets[networkId] || {};
                    if (typeof entry.connection === 'string') {
                        network.connection.password = entry.connection;
                    }
                    if (typeof entry.sasl === 'string') {
                        network.password = entry.sasl;
                    }
                });
            }
            this.secretLoadFailed = false;
        } catch (err) {
            this.secretLoadFailed = true;
            this.reportSecretError('Failed to load saved passwords', err);
        }
    }

    collectSecrets() {
        const secrets = {};

        if (!this.includePasswords) {
            return secrets;
        }

        this.state.networks.forEach((network) => {
            if (!this.networkAllowsPassword(network)) {
                return;
            }

            const entry = {};
            if (network.connection.password) {
                entry.connection = network.connection.password;
            }
            if (network.password) {
                entry.sasl = network.password;
            }

            if (Object.keys(entry).length) {
                secrets[String(network.id)] = entry;
            }
        });

        return secrets;
    }

    async saveSecrets() {
        if (!this.secretStore || !this.storageKey) {
            return false;
        }

        const secrets = this.collectSecrets();
        if (Object.keys(secrets).length) {
            await this.secretStore.save(this.storageKey, secrets);
        } else {
            await this.secretStore.clear(this.storageKey);
        }

        return true;
    }

    reportSecretError(message, err) {
        if (!this.logger) {
            return;
        }

        if (typeof this.logger.error === 'function') {
            this.logger.error(message, err);
        } else {
            this.logger(message, err);
        }
    }

    stopWatchingState() {
        if (this.watcher) {
            this.watcher();
            this.watcher = null;
        }
    }

    watchStateForChanges() {
        if (!this.storageKey) {
            return;
        }

        // Throttle saving the state into storage so we don't thrash the disk
        let debouncedSaveState = debounce(() => this.saveStateNow(), 1000);

        this.state.$watch('networks', debouncedSaveState, { deep: true });
        this.state.$watch('user_settings', debouncedSaveState, { deep: true });

        // We need to touch each property of each buffer for that we want to save our state on.
        // If any of the properties change then the $watch()er will call debouncedSaveState()
        this.watcher = this.state.$watch(() => {
            let watchVals = [];

            this.state.networks.forEach((network) => {
                let buffersVals = [];
                buffersVals.push(network.buffers.map((b) => b.name).join(','));

                network.buffers.forEach((buffer) => {
                    buffersVals.push([
                        buffer.name,
                        buffer.settings,
                        buffer.joined,
                        buffer.enabled,
                        buffer.last_read,
                    ]);
                });

                watchVals.push(buffersVals);
            });

            return JSON.stringify(watchVals);
        }, debouncedSaveState);

        this.isPersisting = true;
    }

    async saveStateNow() {
        if (!this.storageKey) {
            return { secretsSaved: false, stateSaved: false };
        }

        if (this.logger) {
            this.logger('State updated, writing to storage');
        }

        let secretsSaved = true;
        let stateJson;

        if (this.secretStore) {
            if (this.secretLoadFailed) {
                secretsSaved = false;
            } else {
                try {
                    await this.saveSecrets();
                } catch (err) {
                    secretsSaved = false;
                    this.reportSecretError('Failed to save passwords', err);
                }
            }

            stateJson = this.state.exportState(this.includeBuffers, false);
        } else {
            stateJson = this.state.exportState(
                this.includeBuffers,
                this.includePasswords,
                (network) => this.networkAllowsPassword(network)
            );
        }

        await this.storage.set(this.storageKey, stateJson);
        return { secretsSaved, stateSaved: true };
    }

    async clearStoredState() {
        this.stopWatchingState();
        await WebpushUtils.unsubscribeStateBrowserSubscriptions(this.state.stateKey());
        if (this.storageKey) {
            if (this.secretStore) {
                try {
                    await this.secretStore.clear(this.storageKey);
                } catch (err) {
                    this.reportSecretError('Failed to clear saved passwords', err);
                }
            }
            await this.storage.set(this.storageKey, null);
        }
        await MetadataCache.clear();
    }

    async forgetState() {
        await this.clearStoredState();
        this.state.resetState();
    }
}
