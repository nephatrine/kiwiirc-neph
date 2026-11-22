'kiwi public';

/**
 * Adapter for plugin owned secret blobs.
 *
 * Plugins get a single opaque string per scope. Desktop builds store the blob
 * in the profile directory encrypted with the operating system key store; web
 * builds fall back to localStorage, which is not protected by the OS.
 *
 * Secret values must never be written to the config, the exported profile, or
 * the console.
 */
import * as DesktopPluginSecrets from './desktop/PluginSecrets';
import * as LocalStorage from './storage/Local';

const KEY_PREFIX = 'kiwi-plugin-secret:';

function localGet(scope) {
    return LocalStorage.get(KEY_PREFIX + scope);
}

function localSet(scope, value) {
    if (value === null) {
        return LocalStorage.remove(KEY_PREFIX + scope);
    }
    return LocalStorage.set(KEY_PREFIX + scope, value);
}

export function createPluginSecretStore() {
    const desktop = DesktopPluginSecrets.isAvailable();

    return {
        isSecure() {
            return desktop;
        },
        get(scope) {
            return desktop ?
                DesktopPluginSecrets.get(scope) :
                localGet(scope);
        },
        set(scope, value) {
            return desktop ?
                DesktopPluginSecrets.set(scope, value) :
                localSet(scope, value);
        },
        delete(scope) {
            return desktop ?
                DesktopPluginSecrets.set(scope, null) :
                localSet(scope, null);
        },
    };
}
