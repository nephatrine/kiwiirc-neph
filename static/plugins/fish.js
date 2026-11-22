kiwi.plugin('fish', (kiwi, log) => {
    'use strict';

    /* FiSH encryption for private messages, channels, topics and notices.
     *
     * Wire format:
     *   ECB  +OK <fish-base64>
     *   CBC  +OK * <base64>
     *   DH   NOTICE <nick> :DH1080_INIT|DH1080_FINISH <base64> [CBC]
     *
     * FiSH is a weak, unauthenticated cipher. Blowfish ECB leaks structure in
     * the plaintext and neither mode detects tampering. Do not rely on it for
     * anything that actually needs to stay secret.
     */

    const Fish = window.KiwiFishCrypto;
    if (!Fish) {
        log.error('FiSH crypto helpers did not load');
        return;
    }

    const TextFormatting = kiwi.require('helpers/TextFormatting');
    const Misc = kiwi.require('helpers/Misc');
    const Utils = kiwi.require('helpers/Utils');
    const PasswordStrength = kiwi.require('helpers/PasswordStrength');

    const SECRET_SCOPE = 'fish';
    const BLOB_VERSION = 1;
    const PBKDF2_ITERATIONS = 210000;
    const EXCHANGE_TIMEOUT = 30000;
    const GCM_IV_BYTES = 12;
    const SALT_BYTES = 16;

    const MODE_ECB = 'ecb';
    const MODE_CBC = 'cbc';

    let state = null;

    /* ------------------------------------------------------------------ *
     * Plugin state
     * ------------------------------------------------------------------ */

    // Bumped whenever keys change so the settings UI recomputes.
    const view = kiwi.Vue.observable({
        loaded: false,
        version: 0,
        hasPassphrase: false,
        unlocked: true,
        secureStore: false,
    });

    const store = {
        keys: Object.create(null),
        // Target names and modes are kept outside the encrypted blob so a
        // locked profile still knows which conversations are encrypted.
        index: Object.create(null),
        protected: null,
        cryptoKey: null,
        salt: null,
        loading: null,
        loaded: false,
        dirty: false,
    };

    // Pending DH1080 exchanges, keyed by "<networkId>|<nick>".
    const exchanges = Object.create(null);

    // Buffer lookup for messages, so a placeholder can find its network.
    const messageBuffers = new WeakMap();

    /* ------------------------------------------------------------------ *
     * Config
     * ------------------------------------------------------------------ */

    kiwi.setConfigDefaults('fish', {
        automaticKeyExchange: false,
        marker: '⚷',
        markerPosition: 'suffix',
    });

    // Bundled plugins own their namespace and never add keys to the core
    // po files (see PLUGINS.md).
    kiwi.addTranslations('fish', {
        'en-us': {
            automatic_exchange: 'Automatic Key Exchange',
            automatic_exchange_hint: 'Start a DH1080 exchange when a private message has no key yet. Messages are held and cannot be sent as plaintext.',
            command_action_plus: 'Send Encrypted Action',
            command_fish: 'Manage FiSH Keys',
            command_key: 'Set, View, or Delete Key',
            command_keyx: 'Exchange Key with Nick',
            command_notice_plus: 'Send Encrypted Notice',
            command_topic_plus: 'Set Encrypted Topic',
            decrypt_all: 'Decrypt Encrypted Messages',
            decrypted_count: 'Decrypted {{total}} message(s).',
            decrypted_none: 'No encrypted messages could be decrypted with the current keys.',
            encrypted_marker: 'Encrypted with FiSH',
            encrypted_marker_mode: 'Encrypted with FiSH ({{mode}})',
            encryption: 'Encryption',
            encryption_cbc: 'Blowfish CBC',
            encryption_ecb: 'Blowfish ECB',
            encryption_key: 'Encryption Key',
            encryption_none: 'None',
            encryption_type: 'Encryption Type',
            error_delete_has_key: "Delete takes no key: use '/key <target> del:'.",
            error_key_empty: 'Enter a key first.',
            error_key_required: 'A target and a key are required.',
            error_unknown_mode: "Unknown key mode '{{mode}}'. Use ecb:, cbc:, or del:.",
            error_unknown_fish_option: "Unknown /fish option '{{option}}'. Use -set or -del.",
            error_unknown_keyx_option: "Unknown /keyx option '{{option}}'. Use -ecb or -cbc.",
            exchange: 'Key Exchange',
            exchange_done: 'Key exchange complete ({{mode}}).',
            exchange_failed: 'Key exchange failed: {{error}}',
            exchange_pending: 'Waiting for Key Exchange...',
            key_add: 'Add Key',
            key_delete: 'Delete',
            key_mode: 'Mode',
            key_removed: 'Encryption disabled for this conversation.',
            key_save: 'Save Key',
            key_saved: 'Key saved.',
            key_target: 'Target',
            key_target_hint: 'Nick or #channel',
            key_too_long: 'FiSH: that key is {{bytes}} bytes, but Blowfish should not use more than 56. The first {{max}} bytes are used, so peers that follow the spec will not match it.',
            key_value: 'Key',
            key_value_hint: 'Key or passphrase',
            keys_empty: 'No FiSH keys are set for this network.',
            locked_hint: 'Your FiSH keys are locked. Unlock them to encrypt and decrypt messages.',
            marker_none: 'None',
            marker_position: 'Encrypted Marker Position',
            marker_prefix: 'Prefix',
            marker_suffix: 'Suffix',
            passphrase: 'Key Passphrase',
            passphrase_change: 'Change Passphrase',
            passphrase_hint: 'Optional passphrase',
            passphrase_remove: 'Remove Passphrase',
            passphrase_set: 'Set Passphrase',
            settings: 'FiSH',
            status_loading: 'Loading FiSH keys...',
            status_locked: 'Keys are locked. Unlock them in General settings or with /fish <passphrase>.',
            status_no_passphrase: 'Keys are stored without a passphrase.',
            status_unlocked: 'Keys are unlocked for this session.',
            store_local: 'Keys are stored in this browser and are not protected by the operating system. Set a passphrase to encrypt them.',
            unlock: 'Unlock',
            warning: 'FiSH is an unauthenticated cipher that is susceptible to tampering and replay attacks.',
            warning_cbc: 'FiSH CBC is susceptible to tampering and replay attacks.',
            warning_ecb: 'FiSH ECB can leak patterns from the encrypted ciphertext and is susceptible to tampering and replay attacks.',
        },
    });

    /**
     * Strip a leading plaintext escape (`+p `) from an outgoing message.
     * @param {String} text Message text
     * @returns {String} Remaining text, or an empty string when not escaped
     */
    function plaintextEscape(text) {
        const value = String(text || '');
        if (value.indexOf(Fish.PLAINTEXT_ESCAPE) !== 0) {
            return '';
        }
        if (value.length <= Fish.PLAINTEXT_ESCAPE.length) {
            return '';
        }
        return value.slice(Fish.PLAINTEXT_ESCAPE.length);
    }

    function config(name, fallback) {
        const value = kiwi.state.setting('fish.' + name);
        return typeof value === 'undefined' || value === null ? fallback : value;
    }

    function setConfig(name, value) {
        kiwi.state.setting('fish.' + name, value);
    }

    function markerText() {
        return String(config('marker', '') || '');
    }

    function markerPosition() {
        const position = String(config('markerPosition', 'suffix')).toLowerCase();
        return ['prefix', 'suffix', 'none'].indexOf(position) === -1 ? 'suffix' : position;
    }

    function autoExchangeEnabled() {
        return !!config('automaticKeyExchange', false);
    }

    /* ------------------------------------------------------------------ *
     * Text helpers
     * ------------------------------------------------------------------ */

    /**
     * Render the encrypted-message marker.
     *
     * The marker is a plugin block, not text: incoming bodies can only produce
     * the block types the parser emits, so a plaintext message cannot imitate
     * this element no matter what characters it contains.
     * @param {Object} block Marker block
     * @returns {String} Inner HTML
     */
    function renderMarkerBlock(block) {
        const meta = block.meta || {};
        const label = Utils.escapeHtml(String(meta.label || ''));
        const mode = String(meta.mode || '').toUpperCase();
        const title = Utils.escapeHtml(
            mode ?
                kiwi.i18n.t('fish:encrypted_marker_mode', { mode: mode }) :
                kiwi.i18n.t('fish:encrypted_marker')
        );

        return '<span class="kiwi-fish-marker" role="img" aria-label="' + title +
            '" title="' + title + '">' + label + '</span>';
    }

    function markerBlock(message) {
        const label = markerText();
        if (!label || markerPosition() === 'none') {
            return null;
        }

        const payload = Fish.parsePayload(message.raw_text || '');
        return {
            type: 'fish-marker',
            content: '',
            styles: {},
            meta: {
                label: label,
                mode: payload && payload.mode ? payload.mode : '',
            },
        };
    }

    function onMessageBlocks(event) {
        const message = event && event.message;
        const blocks = event && event.blocks;
        if (!message || !blocks || !blocks.length) {
            return;
        }
        if (!message.is_encrypted || message.bodyTemplate) {
            return;
        }
        // Blocks are rebuilt from the body on every parse; never stack markers.
        if (blocks.some((block) => block.type === 'fish-marker')) {
            return;
        }

        const block = markerBlock(message);
        if (!block) {
            return;
        }

        if (markerPosition() === 'prefix') {
            blocks.unshift(block);
        } else {
            blocks.push(block);
        }
    }

    function placeholderFor(mode) {
        const label = mode === MODE_CBC ? 'CBC' : 'ECB';
        return '[ENCRYPTED with FiSH ' + label + ']';
    }

    /**
     * Warn when a key exceeds Blowfish's 448-bit definition.
     *
     * Peers built on OpenSSL accept up to 72 bytes and ignore the rest, so the
     * key still works there; anything past 72 is dropped by both ends.
     * @param {String} key Key text
     * @returns {String} Warning text, or an empty string
     */
    function keyLengthWarning(key) {
        const bytes = Fish.utf8Encode(String(key || '')).length;
        if (bytes <= Fish.SPEC_MAX_KEY_BYTES) {
            return '';
        }

        return kiwi.i18n.t('fish:key_too_long', {
            bytes: bytes,
            max: Fish.MAX_KEY_BYTES,
        });
    }

    function formatTypeFor(type) {
        if (type === 'action') {
            return 'action';
        }
        if (type === 'notice') {
            return 'notice';
        }
        return 'privmsg';
    }

    function formatBody(type, nick, text) {
        return TextFormatting.formatText(formatTypeFor(type), {
            nick: nick || '',
            text: text,
        });
    }

    /**
     * Add a local system message to a buffer.
     *
     * `addSystemMessage` supplies the empty nick, the `system` type and the
     * standard `ⓘ` text format, so every layout renders the line like a core
     * system notice and the mode-change visibility setting cannot hide it.
     * `type_extra: 'fish'` gives the plugin its own row class.
     * @param {Object} buffer Buffer to append to
     * @param {String} text Message text
     */
    function addLocalMessage(buffer, text) {
        if (!buffer) {
            return;
        }
        state.addSystemMessage(buffer, text, {
            type_extra: 'fish',
        });
    }

    function activeBuffer() {
        return state && state.getActiveBuffer ? state.getActiveBuffer() : null;
    }

    function commandBuffer(context) {
        return (context && context.buffer) || activeBuffer();
    }

    /* ------------------------------------------------------------------ *
     * Key storage
     * ------------------------------------------------------------------ */

    function stateKey() {
        return state && typeof state.stateKey === 'function' ?
            state.stateKey() :
            'kiwi-state';
    }

    function mapKey(network, target) {
        if (!network || !target) {
            return '';
        }
        return stateKey() + '|' + network.id + '|' + String(target).toLowerCase();
    }

    function parseKeyEntry(entry) {
        const value = String(entry || '');
        if (value.indexOf(MODE_CBC + ':') === 0) {
            return { mode: MODE_CBC, key: value.slice(4) };
        }
        if (value.indexOf(MODE_ECB + ':') === 0) {
            return { mode: MODE_ECB, key: value.slice(4) };
        }
        if (!value) {
            return null;
        }
        return { mode: MODE_ECB, key: value };
    }

    function keyFor(network, target) {
        const key = mapKey(network, target);
        if (!key) {
            return null;
        }

        const entry = parseKeyEntry(store.keys[key]);
        if (entry) {
            return {
                mode: entry.mode,
                key: entry.key,
                locked: !view.unlocked,
            };
        }

        // While locked the key material is unavailable but the index still
        // says this conversation is encrypted.
        const mode = store.index[key];
        if (mode) {
            return {
                mode: mode === MODE_CBC ? MODE_CBC : MODE_ECB,
                key: '',
                locked: true,
            };
        }

        return null;
    }

    function keysForNetwork(network) {
        const prefix = stateKey() + '|' + network.id + '|';
        const result = [];

        Object.keys(store.index).forEach((indexKey) => {
            if (indexKey.indexOf(prefix) !== 0) {
                return;
            }
            const target = indexKey.slice(prefix.length);
            result.push({
                target: target,
                mode: store.index[indexKey],
                key: '',
            });
        });

        Object.keys(store.keys).forEach((mapKeyValue) => {
            if (mapKeyValue.indexOf(prefix) !== 0) {
                return;
            }
            const target = mapKeyValue.slice(prefix.length);
            const entry = parseKeyEntry(store.keys[mapKeyValue]);
            const existing = result.find((item) => item.target === target);
            const row = {
                target: target,
                mode: entry ? entry.mode : MODE_ECB,
                key: entry ? entry.key : '',
            };
            if (existing) {
                Object.assign(existing, row);
            } else {
                result.push(row);
            }
        });

        result.sort((a, b) => a.target.localeCompare(b.target));
        return result;
    }

    function touch() {
        view.version += 1;
    }

    function bytesToBase64(bytes) {
        return Fish.stdBase64Encode(bytes);
    }

    function base64ToBytes(text) {
        return Fish.stdBase64Decode(text);
    }

    function encodeKeyEntry(mode, key) {
        return (mode === MODE_CBC ? MODE_CBC : MODE_ECB) + ':' + key;
    }

    function secretCrypto() {
        if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
            return null;
        }
        return window.crypto.subtle;
    }

    function textEncoder() {
        return new TextEncoder();
    }

    function textDecoder() {
        return new TextDecoder();
    }

    async function deriveKey(passphrase, salt, iterations) {
        const subtle = secretCrypto();
        if (!subtle) {
            throw new Error('Web Crypto is unavailable');
        }

        const material = await subtle.importKey(
            'raw',
            textEncoder().encode(String(passphrase)),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: iterations || PBKDF2_ITERATIONS,
                hash: 'SHA-256',
            },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    function sanitizeKeys(keys) {
        const result = Object.create(null);
        if (!keys || typeof keys !== 'object') {
            return result;
        }
        Object.keys(keys).forEach((key) => {
            const entry = parseKeyEntry(keys[key]);
            if (entry && entry.key) {
                result[key] = encodeKeyEntry(entry.mode, entry.key);
            }
        });
        return result;
    }

    function sanitizeIndex(index) {
        const result = Object.create(null);
        if (!index || typeof index !== 'object') {
            return result;
        }
        Object.keys(index).forEach((key) => {
            result[key] = index[key] === MODE_CBC ? MODE_CBC : MODE_ECB;
        });
        return result;
    }

    function indexFromKeys(keys) {
        const index = Object.create(null);
        Object.keys(keys).forEach((key) => {
            const entry = parseKeyEntry(keys[key]);
            if (entry && entry.key) {
                index[key] = entry.mode;
            }
        });
        return index;
    }

    function applyBlob(raw) {
        if (!raw) {
            // A key may already have been set while the load was in flight;
            // never discard in-memory keys for an absent blob.
            if (!store.dirty) {
                store.keys = Object.create(null);
                store.index = Object.create(null);
            }
            view.hasPassphrase = false;
            view.unlocked = true;
            view.loaded = true;
            return;
        }

        let doc = null;
        try {
            doc = JSON.parse(raw);
        } catch (err) {
            log.error('FiSH key blob is not valid JSON');
        }

        if (!doc || doc.version !== BLOB_VERSION) {
            if (!store.dirty) {
                store.keys = Object.create(null);
                store.index = Object.create(null);
            }
            view.hasPassphrase = false;
            view.unlocked = true;
            view.loaded = true;
            return;
        }

        store.index = sanitizeIndex(doc.index);

        if (doc.protected && doc.protected.data) {
            store.keys = Object.create(null);
            store.protected = {
                salt: doc.protected.salt || '',
                iv: doc.protected.iv || '',
                data: doc.protected.data,
                iterations: Number(doc.protected.iterations) || PBKDF2_ITERATIONS,
            };
            store.cryptoKey = null;
            store.salt = base64ToBytes(store.protected.salt);
            view.hasPassphrase = true;
            view.unlocked = false;
            view.loaded = true;
            return;
        }

        store.keys = sanitizeKeys(doc.keys);
        store.index = indexFromKeys(store.keys);
        store.protected = null;
        store.cryptoKey = null;
        store.salt = null;
        view.hasPassphrase = false;
        view.unlocked = true;
        view.loaded = true;
    }

    function loadSecrets() {
        if (store.loading) {
            return store.loading;
        }

        if (!kiwi.hasSecretStore || !kiwi.hasSecretStore()) {
            view.loaded = true;
            view.secureStore = false;
            store.loaded = true;
            return Promise.resolve();
        }

        view.secureStore = !!kiwi.secretsAreSecure();
        store.loading = kiwi.getSecret(SECRET_SCOPE).then((raw) => {
            applyBlob(raw);
            store.loaded = true;
            touch();
        }).catch((err) => {
            log.error('Unable to load FiSH keys', err);
            view.loaded = true;
            store.loaded = true;
        }).then(() => {
            store.loading = null;
        });

        return store.loading;
    }

    async function persistSecrets() {
        store.dirty = true;

        // Never write before the first load finishes, or a slow read could be
        // overwritten with an empty key set.
        if (store.loading) {
            await store.loading;
        }

        if (!kiwi.hasSecretStore || !kiwi.hasSecretStore()) {
            return false;
        }

        if (view.hasPassphrase) {
            if (!view.unlocked || !store.cryptoKey) {
                return false;
            }

            const subtle = secretCrypto();
            const iv = Fish.randomBytes(GCM_IV_BYTES);
            const encrypted = await subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                store.cryptoKey,
                textEncoder().encode(JSON.stringify(store.keys))
            );

            return kiwi.setSecret(SECRET_SCOPE, JSON.stringify({
                version: BLOB_VERSION,
                index: store.index,
                protected: {
                    salt: bytesToBase64(store.salt),
                    iv: bytesToBase64(iv),
                    data: bytesToBase64(new Uint8Array(encrypted)),
                    iterations: PBKDF2_ITERATIONS,
                },
            }));
        }

        return kiwi.setSecret(SECRET_SCOPE, JSON.stringify({
            version: BLOB_VERSION,
            keys: store.keys,
            index: store.index,
        }));
    }

    /* ------------------------------------------------------------------ *
     * Passphrase handling
     * ------------------------------------------------------------------ */

    async function setPassphrase(passphrase) {
        if (!passphrase) {
            return { ok: false, error: 'A passphrase is required.' };
        }
        if (view.hasPassphrase && !view.unlocked) {
            return { ok: false, error: 'Unlock the current passphrase first.' };
        }
        if (!secretCrypto()) {
            return { ok: false, error: 'Web Crypto is unavailable in this browser.' };
        }

        store.salt = Fish.randomBytes(SALT_BYTES);
        store.cryptoKey = await deriveKey(passphrase, store.salt, PBKDF2_ITERATIONS);
        store.protected = null;
        view.hasPassphrase = true;
        view.unlocked = true;

        const saved = await persistSecrets();
        touch();
        return saved ?
            { ok: true } :
            { ok: false, error: 'The keys could not be saved.' };
    }

    async function removePassphrase() {
        if (!view.hasPassphrase) {
            return { ok: false, error: 'No passphrase is set.' };
        }
        if (!view.unlocked) {
            return { ok: false, error: 'Unlock the current passphrase first.' };
        }

        view.hasPassphrase = false;
        store.cryptoKey = null;
        store.protected = null;
        store.salt = null;

        const saved = await persistSecrets();
        touch();
        return saved ?
            { ok: true } :
            { ok: false, error: 'The keys could not be saved.' };
    }

    async function unlock(passphrase) {
        if (!view.hasPassphrase) {
            return { ok: false, error: 'No passphrase is set.' };
        }
        if (view.unlocked) {
            return { ok: true };
        }
        if (!store.protected) {
            return { ok: false, error: 'No protected keys are stored.' };
        }

        const subtle = secretCrypto();
        if (!subtle) {
            return { ok: false, error: 'Web Crypto is unavailable in this browser.' };
        }

        const salt = base64ToBytes(store.protected.salt);
        const cryptoKey = await deriveKey(
            passphrase,
            salt,
            store.protected.iterations
        );

        let plain = null;
        try {
            plain = await subtle.decrypt(
                { name: 'AES-GCM', iv: base64ToBytes(store.protected.iv) },
                cryptoKey,
                base64ToBytes(store.protected.data)
            );
        } catch (err) {
            return { ok: false, error: 'That passphrase did not unlock the keys.' };
        }

        store.keys = sanitizeKeys(JSON.parse(textDecoder().decode(plain)));
        store.cryptoKey = cryptoKey;
        store.salt = salt;
        view.unlocked = true;
        touch();
        return { ok: true };
    }

    function keysAvailable() {
        return view.unlocked;
    }

    /* ------------------------------------------------------------------ *
     * Message decryption
     * ------------------------------------------------------------------ */

    function decryptBody(network, target, payload) {
        // "+OK +p text" carries plaintext, not ciphertext: unwrap it and do not
        // touch the key at all, so it works with no key and while locked.
        if (payload.plaintext) {
            return { ok: true, text: payload.payload, plaintext: true };
        }

        // A recognised prefix with an impossible payload (whitespace after the
        // mode marker, truncated base64) is malformed, not decryptable.
        if (payload.invalid) {
            return { ok: false, reason: 'malformed', mode: payload.mode };
        }

        const entry = keyFor(network, target);
        if (!entry) {
            return { ok: false, reason: 'missing-key', mode: payload.mode };
        }
        if (entry.locked || !keysAvailable()) {
            return { ok: false, reason: 'locked', mode: payload.mode };
        }

        try {
            return {
                ok: true,
                // Strict: a wrong key, a mode mismatch or a crafted payload
                // yields implausible text, which becomes a placeholder instead
                // of mojibake.
                text: Fish.decrypt(
                    entry.key,
                    payload.mode,
                    payload.payload,
                    { strict: true }
                ),
            };
        } catch (err) {
            return { ok: false, reason: 'failed', mode: payload.mode };
        }
    }

    function decryptMessage(message) {
        if (!message || typeof message.raw_text !== 'string') {
            return false;
        }

        const buffer = messageBuffers.get(message);
        const network = buffer && buffer.getNetwork ? buffer.getNetwork() : null;
        const props = message.bodyTemplateProps || {};
        if (!network) {
            return false;
        }

        const target = props.isPrivate ?
            (props.nick || '') :
            (buffer.name || '');
        const result = decryptWireText(network, target, message.raw_text);
        if (!result || !result.ok) {
            return false;
        }

        message.message = formatBody(props.type || message.type, props.nick, result.text);
        message.bodyTemplate = null;
        message.bodyTemplateProps = {};
        message.invalidateRender();
        return true;
    }

    function decryptNetworkMessages(network) {
        let count = 0;
        if (!network) {
            return count;
        }

        network.buffers.forEach((buffer) => {
            const messages = typeof buffer.getMessages === 'function' ?
                buffer.getMessages() :
                [];
            messages.forEach((message) => {
                if (message.is_encrypted && message.bodyTemplate) {
                    if (decryptMessage(message)) {
                        count += 1;
                    }
                }
            });
        });

        return count;
    }

    /* ------------------------------------------------------------------ *
     * Incoming messages
     * ------------------------------------------------------------------ */

    const placeholderTemplate = document.getElementById('fish-placeholder');
    const PlaceholderComponent = kiwi.Vue.extend({
        template: placeholderTemplate ? placeholderTemplate.innerHTML : '<span></span>',
        props: [
            'message',
            'mode',
            'type',
            'nick',
            'isPrivate',
            'initialFailed',
        ],
        data() {
            return {
                failed: false,
            };
        },
        computed: {
            label() {
                return placeholderFor(this.mode);
            },
            hint() {
                if (!view.unlocked) {
                    return 'FiSH: unlock your keys with /fish <passphrase>';
                }
                return (this.failed || this.initialFailed) ?
                    'FiSH: this key did not decrypt the message' :
                    'FiSH: click to decrypt';
            },
        },
        methods: {
            decrypt() {
                if (decryptMessage(this.message)) {
                    this.failed = false;
                } else {
                    this.failed = true;
                }
            },
        },
    });

    /**
     * Decrypt every payload line in a message.
     *
     * A draft/multiline batch reaches us as one event whose lines are joined
     * with newlines. Each line may be its own +OK payload, while a legacy
     * client may instead encrypt one payload that decrypts to text containing
     * newlines. Both forms end up as newline-joined plaintext here.
     * @param {Object} network Network
     * @param {String} target Key target
     * @param {String} rawText Message text
     * @returns {Object|null} Decryption result, or null when not all lines are FiSH
     */
    function decryptWireText(network, target, rawText) {
        const lines = String(rawText || '').split(/\r\n|\n|\r/);
        const payloads = lines.map((line) => (line ? Fish.parsePayload(line) : null));

        let hasPayload = false;
        let allPayloads = true;
        lines.forEach((line, index) => {
            if (!line) {
                return;
            }
            if (payloads[index]) {
                hasPayload = true;
            } else {
                allPayloads = false;
            }
        });

        if (!hasPayload || !allPayloads) {
            return null;
        }

        let encrypted = false;
        let failure = null;
        const output = lines.map((line, index) => {
            if (!line) {
                return '';
            }

            const result = decryptBody(network, target, payloads[index]);
            if (!result.ok) {
                if (!failure) {
                    failure = result;
                }
                return '';
            }

            if (!result.plaintext) {
                encrypted = true;
            }
            return result.text;
        });

        if (failure) {
            return {
                ok: false,
                mode: failure.mode,
                reason: failure.reason,
            };
        }

        return {
            ok: true,
            text: output.join('\n'),
            isEncrypted: encrypted,
        };
    }

    function incomingFilter(context) {
        if (!context || !context.text) {
            return undefined;
        }
        if (['privmsg', 'action', 'notice'].indexOf(context.type) === -1) {
            return undefined;
        }

        let target = context.target;
        if (context.isPrivate) {
            const isSelf = context.network && context.nick &&
                context.network.caseCompare(context.nick, context.network.nick);
            if (isSelf || !context.nick) {
                target = context.buffer && context.buffer.name ?
                    context.buffer.name :
                    context.target;
            } else {
                target = context.nick;
            }
        } else if (context.buffer && context.buffer.name) {
            target = context.buffer.name;
        }

        const result = decryptWireText(context.network, target, context.text);
        if (!result) {
            return undefined;
        }

        if (result.ok) {
            return {
                text: result.text,
                // A plaintext escape is not encryption: it may be logged and
                // gets no marker.
                isEncrypted: result.isEncrypted,
            };
        }

        return {
            text: placeholderFor(result.mode),
            isEncrypted: true,
            bodyTemplate: PlaceholderComponent,
            bodyTemplateProps: {
                mode: result.mode,
                type: context.type,
                nick: context.nick || '',
                isPrivate: !!context.isPrivate,
                // The key did not produce plausible text; say so before a click.
                initialFailed: result.reason === 'failed',
            },
        };
    }

    function incomingTopicFilter(topic, buffer) {
        const payload = Fish.parsePayload(topic);
        if (!payload) {
            return undefined;
        }

        const network = buffer && buffer.getNetwork ? buffer.getNetwork() : null;
        const result = decryptBody(network, buffer ? buffer.name : '', payload);
        if (result.ok) {
            return result.text;
        }

        return placeholderFor(result.mode);
    }

    /* ------------------------------------------------------------------ *
     * Outgoing messages
     * ------------------------------------------------------------------ */

    function isServiceNick(network, nick) {
        if (!network || !nick) {
            return false;
        }
        const services = network.services || [];
        if (services.some((service) => network.caseCompare(service, nick))) {
            return true;
        }

        // Not every ircd advertises its services. A nick that ends in "Serv" is
        // almost always NickServ, ChanServ, BouncerServ and friends, and
        // holding a message to one of them would just time out.
        return /serv$/i.test(nick);
    }

    function exchangeKey(network, nick) {
        return network.id + '|' + String(nick).toLowerCase();
    }

    function sendDhNotice(network, nick, command, key, mode) {
        const suffix = mode === MODE_CBC ? ' CBC' : '';
        network.ircClient.notice(nick, command + ' ' + key + suffix);
    }

    function finishExchange(network, nick, key, mode) {
        const id = exchangeKey(network, nick);
        const exchange = exchanges[id];
        if (!exchange) {
            return false;
        }

        delete exchanges[id];
        if (exchange.timer) {
            clearTimeout(exchange.timer);
        }

        store.keys[mapKey(network, nick)] = encodeKeyEntry(mode, key);
        store.index[mapKey(network, nick)] = mode === MODE_CBC ? MODE_CBC : MODE_ECB;
        persistSecrets().catch((err) => {
            log.error('Unable to save a FiSH key', err);
        });
        touch();
        exchange.resolve({ key: key, mode: mode });

        const buffer = state.getBufferByName(network.id, nick);
        if (buffer) {
            addLocalMessage(
                buffer,
                'FiSH: key exchange with ' + nick + ' complete (' + mode.toUpperCase() + ').'
            );
        }
        return true;
    }

    function failExchange(network, nick, reason) {
        const id = exchangeKey(network, nick);
        const exchange = exchanges[id];
        if (!exchange) {
            return;
        }

        delete exchanges[id];
        if (exchange.timer) {
            clearTimeout(exchange.timer);
        }

        exchange.reject(new Error(reason));
        const buffer = state.getBufferByName(network.id, nick);
        if (buffer) {
            addLocalMessage(buffer, 'FiSH: key exchange with ' + nick + ' failed: ' + reason);
        }
    }

    function startExchange(network, nick, mode) {
        const id = exchangeKey(network, nick);
        if (exchanges[id]) {
            return exchanges[id].promise;
        }

        let resolvePromise;
        let rejectPromise;
        const promise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
        });

        const keys = Fish.dhGenerate();
        const exchange = {
            privateKey: keys.privateKey,
            mode: mode === MODE_CBC ? MODE_CBC : MODE_ECB,
            promise: promise,
            resolve: resolvePromise,
            reject: rejectPromise,
            timer: null,
        };
        exchanges[id] = exchange;

        exchange.timer = setTimeout(() => {
            failExchange(network, nick, 'no reply');
        }, EXCHANGE_TIMEOUT);

        sendDhNotice(network, nick, 'DH1080_INIT', keys.publicKey, exchange.mode);
        return promise;
    }

    /* ------------------------------------------------------------------ *
     * Outgoing chunking
     * ------------------------------------------------------------------ */

    // The core client budgets 350 bytes for message content and reserves the
    // rest of the 512-byte relayed line for the sender prefix and target.
    // BatchHandlers also splits physical batch lines at 350, so a FiSH payload
    // must never exceed it.
    const DEFAULT_WIRE_BUDGET = 350;

    // irc-framework subtracts '\x01ACTION ' and the closing '\x01' from the
    // action budget.
    const ACTION_WIRE_OVERHEAD = 9;

    const graphemeSegmenter = typeof Intl !== 'undefined' &&
        typeof Intl.Segmenter === 'function' ?
        new Intl.Segmenter(undefined, { granularity: 'grapheme' }) :
        null;

    function splitGraphemes(value) {
        const text = String(value || '');
        if (graphemeSegmenter) {
            return Array.from(
                graphemeSegmenter.segment(text),
                (entry) => entry.segment
            );
        }
        // Code points at least keep surrogate pairs together.
        return Array.from(text);
    }

    function wireBudget(network, type) {
        const configured = network && network.ircClient &&
            network.ircClient.options ?
            Number(network.ircClient.options.message_max_length) :
            0;
        // A configured budget above the batch limit would be split by
        // BatchHandlers anyway, breaking the payload.
        const lineBudget = configured > 0 ?
            Math.min(configured, DEFAULT_WIRE_BUDGET) :
            DEFAULT_WIRE_BUDGET;
        return Math.max(1, lineBudget - (type === 'action' ? ACTION_WIRE_OVERHEAD : 0));
    }

    /**
     * Largest plaintext chunk whose encrypted wire line fits the budget.
     *
     * CBC = "+OK *" + standard Base64(8-byte IV + block-padded plaintext)
     * ECB = "+OK "  + FiSH Base64(block-padded plaintext), 12 chars per block
     * @param {String} mode FiSH mode
     * @param {Number} budget Wire content budget in bytes
     * @returns {Number} Plaintext bytes per payload
     */
    function maxPlaintextBytes(mode, budget) {
        if (budget <= 0) {
            return 0;
        }

        if (mode === MODE_CBC) {
            const groups = Math.floor((budget - 5) / 4);
            const encrypted = (3 * groups) - 8; // remove the CBC IV
            return Math.max(0, Math.floor(encrypted / 8) * 8);
        }

        const blocks = Math.floor((budget - 4) / 12);
        return Math.max(0, blocks * 8);
    }

    function chunkPlaintext(text, maxBytes) {
        const chunks = [];
        if (maxBytes < 1) {
            return chunks;
        }

        // Drop empty logical lines: irc-framework's plaintext path filters
        // them too, and an empty line has no valid FiSH payload.
        String(text || '').split(/\r\n|\n|\r/).forEach((line) => {
            if (!line) {
                return;
            }

            let chunk = '';
            let chunkBytes = 0;
            splitGraphemes(line).forEach((grapheme) => {
                const bytes = Fish.utf8Encode(grapheme).length;
                if (chunkBytes > 0 && chunkBytes + bytes > maxBytes) {
                    chunks.push(chunk);
                    chunk = '';
                    chunkBytes = 0;
                }
                chunk += grapheme;
                chunkBytes += bytes;
            });

            if (chunk) {
                chunks.push(chunk);
            }
        });

        return chunks;
    }

    /**
     * Encrypt a message as one payload per IRC line.
     * @param {Object} network Network
     * @param {Object} entry Key entry with key and mode
     * @param {String} type Message type
     * @param {String} text Plaintext
     * @returns {String} Newline-joined +OK payloads
     */
    function encryptWire(network, entry, type, text) {
        const budget = wireBudget(network, type);
        const maxBytes = maxPlaintextBytes(entry.mode, budget);
        return chunkPlaintext(text, maxBytes)
            .map((chunk) => Fish.encrypt(entry.key, entry.mode, chunk))
            .join('\n');
    }

    function outgoingFilter(context) {
        const network = context.network;
        const target = context.target;
        if (!network || !target) {
            return undefined;
        }

        // Never decide "this target has no key" before the key blob has been
        // read, or a keyed conversation could go out in plaintext.
        if (!store.loaded && store.loading) {
            return store.loading.then(() => outgoingFilter(context));
        }

        // Status-prefixed targets share the key of their channel.
        const extracted = network.extractTargetGroup ?
            network.extractTargetGroup(target) :
            null;
        const keyTarget = extracted ? extracted.target : target;
        const isChannel = network.isChannelName(keyTarget);
        const entry = keyFor(network, keyTarget);

        // "+p " escapes encryption. Only where FiSH would otherwise act, so a
        // literal "+p" in a keyless channel is left alone.
        const escaped = plaintextEscape(context.text);
        const wouldEncrypt = !!entry ||
            (!isChannel &&
                autoExchangeEnabled() &&
                !isServiceNick(network, keyTarget));
        if (escaped && wouldEncrypt) {
            return {
                text: escaped,
                wireText: escaped,
                displayText: escaped,
                isEncrypted: false,
            };
        }

        if (entry) {
            if (entry.locked || !keysAvailable()) {
                return { cancel: true, error: 'FiSH: unlock your keys with /fish <passphrase> first.' };
            }

            const payload = encryptWire(network, entry, context.type, context.text);
            return {
                wireText: payload,
                displayText: context.text,
                isEncrypted: true,
            };
        }

        // Without a key channels stay plaintext; only the user's own key sets
        // encryption up, and there is nothing to exchange automatically.
        if (isChannel) {
            return undefined;
        }

        if (!autoExchangeEnabled() || isServiceNick(network, keyTarget)) {
            return undefined;
        }

        if (!keysAvailable()) {
            return { cancel: true, error: 'FiSH: unlock your keys with /fish <passphrase> first.' };
        }

        const nick = keyTarget;
        return startExchange(network, nick, MODE_CBC).then((result) => {
            const payload = encryptWire(
                network,
                { key: result.key, mode: result.mode },
                context.type,
                context.text
            );
            return {
                wireText: payload,
                displayText: context.text,
                isEncrypted: true,
            };
        }).catch(() => ({
            cancel: true,
            error: 'FiSH: key exchange with ' + nick +
                ' did not complete, so your message was not sent: ' + context.text,
        }));
    }

    /* ------------------------------------------------------------------ *
     * DH1080
     * ------------------------------------------------------------------ */

    function handleDhNotice(network, nick, text) {
        const parts = String(text).split(/\s+/).filter((part) => part);
        let command = (parts[0] || '').toUpperCase();
        // Mircryption's older spelling glues the mode onto the command.
        const cbcCommand = command === 'DH1080_INIT_CBC';
        if (cbcCommand) {
            command = 'DH1080_INIT';
        }
        const theirKey = parts[1];
        const wantsCbc = cbcCommand ||
            parts.some((part) => part.toUpperCase() === 'CBC');
        const mode = wantsCbc ? MODE_CBC : MODE_ECB;

        if (!network || !nick || !theirKey) {
            return;
        }

        if (command === 'DH1080_INIT') {
            let secret = '';
            let publicKey = '';
            try {
                const keys = Fish.dhGenerate();
                secret = Fish.dhSharedKey(keys.privateKey, theirKey);
                publicKey = keys.publicKey;
            } catch (err) {
                log.error('Invalid DH1080 key from ' + nick);
                return;
            }

            network.ircClient.notice(nick, 'DH1080_FINISH ' + publicKey + (mode === MODE_CBC ? ' CBC' : ''));
            store.keys[mapKey(network, nick)] = encodeKeyEntry(mode, secret);
            store.index[mapKey(network, nick)] = mode === MODE_CBC ? MODE_CBC : MODE_ECB;
            persistSecrets().catch((err) => {
                log.error('Unable to save a FiSH key', err);
            });
            touch();

            const buffer = state.getBufferByName(network.id, nick) ||
                state.getOrAddBufferByName(network.id, nick);
            addLocalMessage(
                buffer,
                'FiSH: received a key from ' + nick + ' (' + mode.toUpperCase() + ').'
            );
            return;
        }

        if (command === 'DH1080_FINISH') {
            const id = exchangeKey(network, nick);
            const exchange = exchanges[id];
            if (!exchange) {
                return;
            }

            let secret = '';
            try {
                secret = Fish.dhSharedKey(exchange.privateKey, theirKey);
            } catch (err) {
                failExchange(network, nick, 'invalid public key');
                return;
            }

            finishExchange(network, nick, secret, mode);
        }
    }

    function isDhNotice(text) {
        const upper = String(text || '').toUpperCase();
        return upper.indexOf('DH1080_INIT ') === 0 ||
            upper.indexOf('DH1080_INIT_CBC ') === 0 ||
            upper.indexOf('DH1080_FINISH ') === 0;
    }

    /**
     * True when the parsed event was replayed from chat history.
     *
     * The plugin sees `irc.message` before core normalises the
     * `kiwi-history-target` tag into a chathistory batch, so check the raw
     * markers as well as the batch.
     * @param {Object} event Parsed message event
     * @returns {boolean} Whether the event is historical
     */
    function isHistoryEvent(event) {
        if (!event) {
            return false;
        }
        const tags = event.tags || {};
        return !!(
            event.is_history ||
            (event.batch && event.batch.type === 'chathistory') ||
            typeof tags['kiwi-history'] !== 'undefined' ||
            typeof tags['kiwi-history-target'] !== 'undefined' ||
            typeof tags['draft/chathistory-context'] !== 'undefined'
        );
    }

    /**
     * Negotiate DH1080 and hide the notice from the message list.
     *
     * The parsed `irc.message` event is the one that adds the row, so handling
     * the protocol here keeps negotiation and suppression in a single place
     * and avoids depending on the raw event's `params` shape.
     * @param {Object} event Parsed message event
     * @param {Object} network Network
     * @param {Object} eventObj Mutable handled flag
     */
    function onParsedNotice(event, network, eventObj) {
        if (!event || event.type !== 'notice' || !isDhNotice(event.message)) {
            return;
        }

        if (isHistoryEvent(event)) {
            // A replay is a historical record, not a live exchange. Never
            // derive a key, answer, or resolve a pending exchange from it.
            eventObj.handled = true;
            return;
        }

        // Only a private notice to us is a key exchange. Anything else stays
        // visible so a channel cannot silently swallow messages.
        const isSelf = !!(network && event.nick &&
            network.caseCompare(event.nick, network.nick));
        if (!isSelf &&
            event.target &&
            network &&
            !network.caseCompare(event.target, network.nick)
        ) {
            return;
        }

        eventObj.handled = true;

        if (isSelf) {
            // Our own echoed notice.
            return;
        }

        handleDhNotice(network, event.nick, event.message);
    }

    /* ------------------------------------------------------------------ *
     * Commands
     * ------------------------------------------------------------------ */

    function resolveTarget(network, buffer, spec) {
        if (spec) {
            return spec;
        }
        return buffer ? buffer.name : '';
    }

    /**
     * Parse a `/key` spec: `[mode:]key`.
     *
     * Only `ecb:`, `cbc:` and `del:` are valid modes. Anything else that looks
     * like a mode (`word:`) is an error rather than a key, so a typo cannot
     * silently store an unusable key. A key that genuinely contains a colon
     * must state its mode: `ecb:my:key` stores `my:key`.
     * @param {String} spec Key spec
     * @returns {Object} `{ action, mode, key }`, where action is set/delete/error
     */
    function parseKeySpec(spec) {
        const value = String(spec || '');
        const colon = value.indexOf(':');
        const token = colon === -1 ? '' : value.slice(0, colon).toLowerCase();
        const rest = colon === -1 ? value : value.slice(colon + 1);

        if (token === 'del') {
            return rest ?
                { action: 'error', error: 'fish:error_delete_has_key' } :
                { action: 'delete', key: '', mode: MODE_ECB };
        }

        if (token === 'ecb' || token === 'cbc') {
            return {
                action: 'set',
                key: rest,
                mode: token === 'cbc' ? MODE_CBC : MODE_ECB,
            };
        }

        if (token && /^[a-z]+$/.test(token)) {
            return {
                action: 'error',
                error: 'fish:error_unknown_mode',
                mode: token,
            };
        }

        return { action: 'set', key: value, mode: MODE_ECB };
    }

    /**
     * Turn a parseKeySpec error into a localised message.
     * @param {Object} parsed Spec result with `action: 'error'`
     * @returns {String}
     */
    function reportKeyError(parsed) {
        if (parsed.error === 'fish:error_unknown_mode') {
            return kiwi.i18n.t(parsed.error, { mode: parsed.mode + ':' });
        }
        return kiwi.i18n.t(parsed.error);
    }

    function setKey(network, target, mode, key) {
        const mapped = mapKey(network, target);
        store.keys[mapped] = encodeKeyEntry(mode, key);
        store.index[mapped] = mode === MODE_CBC ? MODE_CBC : MODE_ECB;
        persistSecrets().catch((err) => {
            log.error('Unable to save a FiSH key', err);
        });
        touch();
    }

    function deleteKey(network, target) {
        const key = mapKey(network, target);
        if (!Object.prototype.hasOwnProperty.call(store.keys, key) &&
            !Object.prototype.hasOwnProperty.call(store.index, key)
        ) {
            return false;
        }
        delete store.keys[key];
        delete store.index[key];
        persistSecrets().catch((err) => {
            log.error('Unable to save FiSH keys', err);
        });
        touch();
        return true;
    }

    function reportKey(buffer, network, target) {
        const entry = keyFor(network, target);
        if (!entry) {
            addLocalMessage(buffer, 'FiSH: no key set for ' + target + '.');
            return;
        }

        addLocalMessage(
            buffer,
            'FiSH: key for ' + target + ' is ' + entry.mode.toUpperCase() + ':' + entry.key
        );
    }

    function commandKey(event, command, params, context) {
        event.handled = true;
        const network = context.network;
        const buffer = commandBuffer(context);
        if (!network) {
            return;
        }

        const tokens = String(params || '').trim().split(/\s+/).filter((token) => token);
        let target = '';
        let spec = '';

        if (tokens.length === 1) {
            // A lone argument is a target when it cannot be a key for the
            // current buffer, ie. a channel name or a target that already has
            // a key. Everything else sets a key on the current buffer.
            const candidate = tokens[0];
            const isChannel = network.isChannelName(candidate);
            const hasKey = !!keyFor(network, candidate);
            if (isChannel || hasKey || (buffer && network.caseCompare(candidate, buffer.name))) {
                target = candidate;
            } else {
                spec = candidate;
            }
        } else if (tokens.length >= 2) {
            target = tokens[0];
            spec = tokens[1];
        }

        target = resolveTarget(network, buffer, target);
        if (!target) {
            addLocalMessage(buffer, 'FiSH: no target to set a key for.');
            return;
        }

        if (!spec) {
            reportKey(buffer, network, target);
            return;
        }

        const parsed = parseKeySpec(spec);
        if (parsed.action === 'delete') {
            const removed = deleteKey(network, target);
            addLocalMessage(
                buffer,
                removed ?
                    'FiSH: removed the key for ' + target + '.' :
                    'FiSH: no key was set for ' + target + '.'
            );
            return;
        }

        if (parsed.action === 'error') {
            addLocalMessage(buffer, reportKeyError(parsed));
            return;
        }

        if (!parsed.key) {
            addLocalMessage(buffer, 'FiSH: a key is required.');
            return;
        }

        setKey(network, target, parsed.mode, parsed.key);
        addLocalMessage(
            buffer,
            'FiSH: ' + parsed.mode.toUpperCase() + ' key set for ' + target + '.'
        );

        const warning = keyLengthWarning(parsed.key);
        if (warning) {
            addLocalMessage(buffer, warning);
        }
    }

    function commandKeyx(event, command, params, context) {
        event.handled = true;
        const network = context.network;
        const buffer = commandBuffer(context);
        if (!network) {
            return;
        }

        let mode = MODE_CBC;
        let nick = '';
        let unknownOption = '';

        String(params || '').trim().split(/\s+/).forEach((token) => {
            if (!token) {
                return;
            }

            const lower = token.toLowerCase();
            if (lower === '-ecb') {
                mode = MODE_ECB;
            } else if (lower === '-cbc') {
                mode = MODE_CBC;
            } else if (lower.charAt(0) === '-') {
                unknownOption = token;
            } else {
                nick = token;
            }
        });

        if (unknownOption) {
            addLocalMessage(buffer, kiwi.i18n.t(
                'fish:error_unknown_keyx_option',
                { option: unknownOption }
            ));
            return;
        }

        if (!nick && buffer && buffer.isQuery && buffer.isQuery()) {
            nick = buffer.name;
        }

        if (!nick || network.isChannelName(nick)) {
            addLocalMessage(buffer, 'FiSH: /keyx needs a nick to exchange with.');
            return;
        }

        if (!keysAvailable()) {
            addLocalMessage(buffer, 'FiSH: unlock your keys with /fish <passphrase> first.');
            return;
        }

        addLocalMessage(buffer, 'FiSH: starting a key exchange with ' + nick + '...');
        startExchange(network, nick, mode).catch(() => {});
    }

    function commandFish(event, command, params, context) {
        event.handled = true;
        const buffer = commandBuffer(context);
        const tokens = String(params || '').trim().split(/\s+/);
        const first = tokens[0] || '';

        const report = (result) => {
            if (!result.ok) {
                addLocalMessage(buffer, 'FiSH: ' + result.error);
            }
        };

        // A mistyped option would otherwise be used as the passphrase and fail
        // with a misleading "that passphrase did not unlock the keys".
        if (first.charAt(0) === '-' &&
            first.toLowerCase() !== '-set' &&
            first.toLowerCase() !== '-del'
        ) {
            addLocalMessage(buffer, kiwi.i18n.t(
                'fish:error_unknown_fish_option',
                { option: first }
            ));
            return;
        }

        if (first.toLowerCase() === '-set') {
            const passphrase = tokens.slice(1).join(' ');
            setPassphrase(passphrase).then(report).catch((err) => {
                log.error('Unable to set the FiSH passphrase', err);
                addLocalMessage(buffer, 'FiSH: the passphrase could not be set.');
            });
            return;
        }

        if (first.toLowerCase() === '-del') {
            if (view.hasPassphrase && !window.confirm(
                'Remove the FiSH key passphrase? The keys will be stored unprotected.'
            )) {
                return;
            }
            removePassphrase().then(report).catch((err) => {
                log.error('Unable to remove the FiSH passphrase', err);
                addLocalMessage(buffer, 'FiSH: the passphrase could not be removed.');
            });
            return;
        }

        const passphrase = tokens.join(' ');
        if (!passphrase) {
            let status = 'no passphrase is set.';
            if (view.hasPassphrase) {
                status = view.unlocked ? 'keys are unlocked.' : 'keys are locked.';
            }
            addLocalMessage(buffer, 'FiSH: ' + status);
            return;
        }

        unlock(passphrase).then((result) => {
            if (result.ok) {
                addLocalMessage(buffer, 'FiSH: keys unlocked.');
            } else {
                report(result);
            }
        }).catch((err) => {
            log.error('Unable to unlock FiSH keys', err);
            addLocalMessage(buffer, 'FiSH: the keys could not be unlocked.');
        });
    }

    function parseTopicArgs(network, buffer, line) {
        const value = String(line || '').trim();
        if (!value) {
            return null;
        }

        const spaceIdx = value.indexOf(' ');
        const first = spaceIdx === -1 ? value : value.slice(0, spaceIdx);
        if (network.isChannelName(first) && spaceIdx !== -1) {
            return {
                channel: first,
                topic: value.slice(spaceIdx + 1),
            };
        }

        return {
            channel: buffer ? buffer.name : '',
            topic: value,
        };
    }

    function commandTopicPlus(event, command, params, context) {
        event.handled = true;
        const network = context.network;
        const buffer = commandBuffer(context);
        if (!network) {
            return;
        }

        const parsed = parseTopicArgs(network, buffer, params);
        if (!parsed || !parsed.channel || !parsed.topic) {
            addLocalMessage(buffer, 'FiSH: /topic+ needs a topic to set.');
            return;
        }

        const entry = keyFor(network, parsed.channel);
        if (!entry) {
            addLocalMessage(buffer, 'FiSH: no key set for ' + parsed.channel + '.');
            return;
        }
        if (!keysAvailable()) {
            addLocalMessage(buffer, 'FiSH: unlock your keys with /fish <passphrase> first.');
            return;
        }

        network.ircClient.setTopic(
            parsed.channel,
            Fish.encrypt(entry.key, entry.mode, parsed.topic)
        );
    }

    function sendEncrypted(network, buffer, target, type, text) {
        const entry = keyFor(network, target);
        if (!entry) {
            addLocalMessage(buffer, 'FiSH: no key set for ' + target + '.');
            return false;
        }
        if (!keysAvailable()) {
            addLocalMessage(buffer, 'FiSH: unlock your keys with /fish <passphrase> first.');
            return false;
        }

        const wire = encryptWire(network, entry, type, text);
        const hasEcho = network.hasCap('echo-message');
        const hasLabel = network.hasCap('labeled-response');
        const isSpecial = buffer && buffer.isSpecial ? buffer.isSpecial() : false;
        const tags = {};

        if (hasLabel && !isSpecial) {
            tags.label = Misc.generateLabel();
        }

        state.addMessage(buffer, {
            time: Date.now(),
            nick: network.nick,
            message: formatBody(type, network.nick, text),
            raw_text: wire,
            type: type,
            tags: tags,
            is_pending: (hasEcho || hasLabel) && !isSpecial,
            is_encrypted: true,
        });

        let fnName = 'say';
        if (type === 'action') {
            fnName = 'action';
        } else if (type === 'notice') {
            fnName = 'notice';
        }
        network.ircClient[fnName](target, wire, tags);
        return true;
    }

    function splitTargetAndMessage(network, buffer, line) {
        const value = String(line || '').trim();
        const spaceIdx = value.indexOf(' ');
        if (spaceIdx === -1) {
            return null;
        }

        const first = value.slice(0, spaceIdx);
        // `/me+` is a default alias that injects `$destination`, so the first
        // token is the target even when the peer has no user state yet.
        if (network.isChannelName(first) ||
            state.getUser(network.id, first) ||
            (buffer && network.caseCompare(first, buffer.name))
        ) {
            return {
                target: first,
                message: value.slice(spaceIdx + 1).trim(),
            };
        }

        return {
            target: buffer ? buffer.name : '',
            message: value,
        };
    }

    function commandActionPlus(event, command, params, context) {
        event.handled = true;
        const network = context.network;
        const buffer = commandBuffer(context);
        if (!network) {
            return;
        }

        const parsed = splitTargetAndMessage(network, buffer, params);
        if (!parsed || !parsed.target || !parsed.message) {
            addLocalMessage(buffer, 'FiSH: /action+ needs a destination and a message.');
            return;
        }

        const targetBuffer = state.getOrAddBufferByName(network.id, parsed.target);
        sendEncrypted(network, targetBuffer || buffer, parsed.target, 'action', parsed.message);
    }

    function commandNoticePlus(event, command, params, context) {
        event.handled = true;
        const network = context.network;
        const buffer = commandBuffer(context);
        if (!network) {
            return;
        }

        const parsed = splitTargetAndMessage(network, buffer, params);
        if (!parsed || !parsed.target || !parsed.message) {
            addLocalMessage(buffer, 'FiSH: /notice+ needs a destination and a message.');
            return;
        }

        const targetBuffer = state.getOrAddBufferByName(network.id, parsed.target);
        sendEncrypted(network, targetBuffer || buffer, parsed.target, 'notice', parsed.message);
    }

    /* ------------------------------------------------------------------ *
     * Settings UI
     * ------------------------------------------------------------------ */

    const generalTemplate = document.getElementById('fish-general');
    const GeneralSettings = kiwi.Vue.extend({
        template: generalTemplate ? generalTemplate.innerHTML : '<div></div>',
        data() {
            return {
                passphrase: '',
                message: '',
            };
        },
        computed: {
            loaded() {
                return view.loaded;
            },
            hasPassphrase() {
                return view.hasPassphrase;
            },
            unlocked() {
                return view.unlocked;
            },
            secureStore() {
                return view.secureStore;
            },
            automaticExchange: {
                get() {
                    return autoExchangeEnabled();
                },
                set(value) {
                    setConfig('automaticKeyExchange', !!value);
                },
            },
            markerPosition: {
                get() {
                    return markerPosition();
                },
                set(value) {
                    setConfig('markerPosition', String(value || 'suffix'));
                },
            },
        },
        methods: {
            setKeyPassphrase() {
                setPassphrase(this.passphrase).then((result) => {
                    this.passphrase = '';
                    this.message = result.ok ? '' : result.error;
                });
            },
            clearKeyPassphrase() {
                if (!window.confirm(
                    'Remove the FiSH key passphrase? The keys will be stored unprotected.'
                )) {
                    return;
                }
                removePassphrase().then((result) => {
                    this.message = result.ok ? '' : result.error;
                });
            },
            unlockKeys() {
                unlock(this.passphrase).then((result) => {
                    this.passphrase = '';
                    this.message = result.ok ? '' : result.error;
                });
            },
        },
    });

    const networkTemplate = document.getElementById('fish-network');
    const NetworkSettings = kiwi.Vue.extend({
        template: networkTemplate ? networkTemplate.innerHTML : '<div></div>',
        props: ['network'],
        data() {
            return {
                newTarget: '',
                newMode: MODE_ECB,
                newKey: '',
                message: '',
            };
        },
        computed: {
            keys() {
                // Reading the version counter re-runs this when keys change.
                const version = view.version;
                if (!this.network) {
                    return [];
                }
                return version >= 0 ? keysForNetwork(this.network) : [];
            },
            status() {
                if (!view.loaded) {
                    return kiwi.i18n.t('fish:status_loading');
                }
                if (!view.hasPassphrase) {
                    return kiwi.i18n.t('fish:status_no_passphrase');
                }
                return view.unlocked ?
                    kiwi.i18n.t('fish:status_unlocked') :
                    kiwi.i18n.t('fish:status_locked');
            },
        },
        methods: {
            addKey() {
                if (!this.network) {
                    return;
                }
                const target = (this.newTarget || '').trim();
                const key = (this.newKey || '').trim();
                if (!target || !key) {
                    this.message = kiwi.i18n.t('fish:error_key_required');
                    return;
                }
                setKey(this.network, target, this.newMode, key);
                this.newTarget = '';
                this.newKey = '';
                this.message = keyLengthWarning(key);
            },
            removeKey(target) {
                if (!this.network) {
                    return;
                }
                deleteKey(this.network, target);
            },
            decryptAll() {
                const count = decryptNetworkMessages(this.network);
                this.message = count ?
                    kiwi.i18n.t('fish:decrypted_count', { total: count }) :
                    kiwi.i18n.t('fish:decrypted_none');
            },
        },
    });

    const encryptionTemplate = document.getElementById('fish-encryption');
    const EncryptionSettings = kiwi.Vue.extend({
        template: encryptionTemplate ? encryptionTemplate.innerHTML : '<div></div>',
        props: ['network', 'buffer', 'context', 'sidebarState', 'user', 'pluginProps'],
        data() {
            return {
                mode: 'none',
                key: '',
                status: '',
                exchanging: false,
                showKey: false,
            };
        },
        computed: {
            target() {
                return this.buffer ? this.buffer.name : '';
            },
            visible() {
                if (!this.buffer) {
                    return false;
                }
                return this.context === 'userbox' ?
                    this.buffer.isQuery() :
                    this.buffer.isChannel();
            },
            loaded() {
                return view.loaded;
            },
            locked() {
                return view.hasPassphrase && !view.unlocked;
            },
            entry() {
                // Reading the version counter re-runs this when keys change.
                const version = view.version;
                if (!this.network || !this.target) {
                    return null;
                }
                return version >= 0 ? keyFor(this.network, this.target) : null;
            },
            modeWarning() {
                if (this.mode === MODE_ECB) {
                    return kiwi.i18n.t('fish:warning_ecb');
                }
                if (this.mode === MODE_CBC) {
                    return kiwi.i18n.t('fish:warning_cbc');
                }
                return '';
            },
            canExchange() {
                return this.context === 'userbox' &&
                    this.buffer &&
                    this.buffer.isQuery() &&
                    this.network &&
                    this.network.state === 'connected' &&
                    !isServiceNick(this.network, this.target);
            },
            passwordStrengthClass() {
                return PasswordStrength.passwordLevelClass(this.key);
            },
            passwordStrengthLabel() {
                return PasswordStrength.passwordLevelLabelKey(this.key);
            },
        },
        watch: {
            target() {
                this.status = '';
                this.showKey = false;
                this.syncFromEntry();
            },
            entry() {
                this.syncFromEntry();
            },
        },
        created() {
            this.syncFromEntry();
        },
        methods: {
            syncFromEntry() {
                this.mode = this.entry ? this.entry.mode : 'none';
                this.key = this.entry && !this.entry.locked ? this.entry.key : '';
            },
            onModeChange() {
                if (this.mode === 'none') {
                    this.removeKey();
                }
            },
            saveKey() {
                if (this.locked || !this.network || !this.target ||
                    this.mode === 'none') {
                    return;
                }
                const key = String(this.key || '').trim();
                if (!key) {
                    this.status = kiwi.i18n.t('fish:error_key_empty');
                    return;
                }
                setKey(this.network, this.target, this.mode, key);
                this.status = keyLengthWarning(key) ||
                    kiwi.i18n.t('fish:key_saved');
            },
            removeKey() {
                if (this.locked || !this.network || !this.target) {
                    return;
                }
                deleteKey(this.network, this.target);
                this.key = '';
                this.status = kiwi.i18n.t('fish:key_removed');
            },
            exchangeKey() {
                if (!this.canExchange || this.locked || this.exchanging) {
                    return;
                }
                this.exchanging = true;
                this.status = kiwi.i18n.t('fish:exchange_pending');
                startExchange(this.network, this.target, MODE_CBC)
                    .then((result) => {
                        this.mode = result.mode;
                        this.key = result.key;
                        this.status = kiwi.i18n.t('fish:exchange_done', {
                            mode: result.mode.toUpperCase(),
                        });
                    })
                    .catch((err) => {
                        this.status = kiwi.i18n.t('fish:exchange_failed', {
                            error: err && err.message ? err.message : 'unknown',
                        });
                    })
                    .then(() => {
                        this.exchanging = false;
                    });
            },
        },
    });

    kiwi.addSettingsBlock('general', GeneralSettings, {
        title: 't_fish:settings',
    });
    kiwi.addSettingsBlock('network', NetworkSettings, {
        title: 't_fish:settings',
    });

    kiwi.addTab('channel', 't_fish:encryption', EncryptionSettings, {
        context: 'channel',
    });
    kiwi.addUi('userbox_info', EncryptionSettings, {
        props: { context: 'userbox' },
    });

    /* ------------------------------------------------------------------ *
     * Wiring
     * ------------------------------------------------------------------ */

    kiwi.addIncomingMessageFilter(incomingFilter);
    kiwi.addIncomingTopicFilter(incomingTopicFilter);
    kiwi.addOutgoingMessageFilter(outgoingFilter);
    kiwi.addBlockRenderer('fish-marker', renderMarkerBlock);

    kiwi.registerCommand('key', commandKey, {
        description: () => kiwi.i18n.t('fish:command_key'),
    });
    kiwi.registerCommand('keyx', commandKeyx, {
        description: () => kiwi.i18n.t('fish:command_keyx'),
    });
    kiwi.registerCommand('fish', commandFish, {
        description: () => kiwi.i18n.t('fish:command_fish'),
    });
    kiwi.registerCommand('topic+', commandTopicPlus, {
        description: () => kiwi.i18n.t('fish:command_topic_plus'),
    });
    kiwi.registerCommand('action+', commandActionPlus, {
        description: () => kiwi.i18n.t('fish:command_action_plus'),
    });
    kiwi.registerCommand('notice+', commandNoticePlus, {
        description: () => kiwi.i18n.t('fish:command_notice_plus'),
    });

    // Attach the real Message instance to placeholders once they exist, and
    // remember which buffer each message belongs to.
    let wired = false;
    function onStateReady() {
        state = kiwi.state;
        if (!state || wired) {
            return;
        }
        wired = true;

        state.$on('message.new', ({ message, buffer } = {}) => {
            if (!message) {
                return;
            }
            if (buffer) {
                messageBuffers.set(message, buffer);
            }
            if (message.bodyTemplate === PlaceholderComponent) {
                message.bodyTemplateProps = Object.assign(
                    {},
                    message.bodyTemplateProps || {},
                    { message: message }
                );
            }
        });

        state.$on('irc.message', onParsedNotice);
        state.$on('message.blocks', onMessageBlocks);

        loadSecrets().then(() => {
            if (!view.loaded) {
                view.loaded = true;
            }
            touch();
        });
    }

    if (kiwi.state) {
        onStateReady();
    } else {
        kiwi.on('init', onStateReady);
    }
});
