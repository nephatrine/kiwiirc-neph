'kiwi public';

/** @module */

import EventEmitter from 'eventemitter3';
import Vue from 'vue';
import * as Misc from '@/helpers/Misc';
import { each, getPath } from '@/helpers/Utils';
import Logger from './Logger';

let singletonInstance = null;
let pluginsToInit = [];
let nextPluginId = 0;

const LAYOUT_EDGES = ['top', 'right', 'bottom', 'left'];

function normalizeLayoutInsets(insets = {}) {
    const normalized = {};
    LAYOUT_EDGES.forEach((edge) => {
        const value = Number(insets[edge]);
        normalized[edge] = Number.isFinite(value) && value > 0 ? value : 0;
    });
    return normalized;
}

function layoutInsetsEqual(a, b) {
    return LAYOUT_EDGES.every((edge) => a[edge] === b[edge]);
}

/** The global kiwi API instance */
export default class GlobalApi extends EventEmitter {
    constructor() {
        super();

        // Version information from DefinePlugin in vue.config.js
        this.version = __VERSION__; // eslint-disable-line no-undef
        this.commithash = __COMMITHASH__; // eslint-disable-line no-undef

        /** A reference to the internal Vuejs instance */
        this.Vue = Vue;
        /** Expose JSON5 so that plugins can use the same config format */
        this.JSON5 = null;
        /** The applications internal state */
        this.state = null;
        /** Optional desktop integration adapter */
        this.desktop = null;
        /** The applications ThemeManager */
        this.themes = null;
        /** Translations library */
        this.i18n = null;
        this.vueI18n = null;
        this.translationUrls = Object.create(null);

        this.appPlugins = [];
        this.controlInputPlugins = [];
        this.stateBrowserPlugins = [];
        this.channelHeaderPlugins = [];
        this.queryHeaderPlugins = [];
        this.sideBarPlugins = [];
        this.userboxButtonPlugins = [];
        this.userboxInfoPlugins = [];
        this.userboxWhoisPlugins = [];
        this.appSettingsPlugins = [];
        this.generalSettingsBlocks = [];
        this.networkSettingsBlocks = [];
        this.serverViewPlugins = [];
        this.aboutBufferPlugins = [];
        this.messageInfoPlugins = [];
        this.tabs = Object.create(null);
        this.services = Object.create(null);
        this.commands = Object.create(null);
        this.commandMeta = Object.create(null);
        this.autocompleteProviders = Object.create(null);
        this.loadedPlugins = [];
        this.loadedPluginEntries = [];
        this.failedPlugins = [];
        this.pluginEntryName = null;
        this.isReady = false;
        /** Async hooks that may rewrite or cancel an outgoing chat message */
        this.outgoingMessageFilters = [];
        /** Sync hooks that may rewrite the body of an incoming chat message */
        this.incomingMessageFilters = [];
        /** Sync hooks that may rewrite an incoming channel topic */
        this.incomingTopicFilters = [];
        /** Renderers for plugin-defined message block types */
        this.blockRenderers = Object.create(null);
        /** Optional plugin secret storage adapter, wired up by src/main.js */
        this.secretStore = null;
        /** Reactive media playback state reported by plugins */
        this.media = Vue.observable({
            playing: false,
            sources: {},
        });
        /** Reactive viewport-edge insets reserved by layout chrome plugins */
        this.layout = Vue.observable({
            insets: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
            },
            sources: {},
        });
        /* eslint-disable no-underscore-dangle */
        this.exports = window._kiwi_exports || {};

        this.on('init', () => {
            this.isReady = true;
            this.initPlugins();
        });
    }

    static singleton() {
        singletonInstance = singletonInstance || new GlobalApi();
        return singletonInstance;
    }

    versionMatches(v) {
        return Misc.compareVersions(this.version, v) >= 0;
    }

    /**
     * Register a plugin with kiwi
     *
     * Plugins being loaded at startup will be registered once Kiwi is ready. At any
     * other point the plugin will be registered instantly
     * @param {String} pluginName The name of this plugin
     * @param {Function} fn A callback function to start the plugin. function(kiwi, logger)
     */
    plugin(pluginName, fn) {
        let plugin = {
            name: pluginName,
            fn: fn,
            entryName: this.pluginEntryName || pluginName,
        };
        if (this.isReady) {
            this.initPlugin(plugin);
        } else {
            pluginsToInit.push(plugin);
        }
    }

    // Init any plugins that were added before we were ready
    initPlugins() {
        pluginsToInit.forEach((plugin) => this.initPlugin(plugin));
        pluginsToInit = [];
    }

    initPlugin(plugin) {
        let pluginLogger = Logger.namespace(`Plugin ${plugin.name}`);
        try {
            plugin.fn(this, pluginLogger);
            if (this.loadedPlugins.indexOf(plugin.name) === -1) {
                this.loadedPlugins.push(plugin.name);
            }
            if (this.loadedPluginEntries.indexOf(plugin.entryName) === -1) {
                this.loadedPluginEntries.push(plugin.entryName);
            }
            this.state.$emit('plugin.loaded', {
                name: plugin.name,
                entry: plugin.entryName,
            });
        } catch (err) {
            pluginLogger.error(err.stack);
            this.pluginFailed(plugin.entryName || plugin.name, err);
        }
    }

    pluginFailed(name, error) {
        const entry = {
            name: String(name || 'unknown'),
            error: error ? String(error.message || error) : '',
        };

        if (!this.failedPlugins.some((item) => item.name === entry.name)) {
            this.failedPlugins.push(entry);
        }
        if (this.state) {
            this.state.$emit('plugin.failed', entry);
        }
    }

    pluginStatus() {
        return {
            loaded: this.loadedPlugins.slice(),
            loadedEntries: this.loadedPluginEntries.slice(),
            failed: this.failedPlugins.map((entry) => ({ ...entry })),
        };
    }

    /**
     * Get a reference to an internal Kiwi module
     *
     * E.g. require('helpers/TextFormatting');
     * @param {String} mod The module path
     */
    require(modPath) {
        let path = modPath.replace(/\//g, '.');
        let mod = getPath(this.exports, path);
        if (typeof mod === 'undefined') {
            Logger.error('Module does not exist: ' + modPath);
        }

        return mod;
    }

    /**
     * Register a named service that other plugins can consume.
     * @param {String} name Stable service identifier, eg. 'radio'
     * @param {Object} service Service object
     */
    registerService(name, service) {
        if (!name || !service) {
            return;
        }
        this.services[name] = service;
    }

    /**
     * Get a named plugin service.
     * @param {String} name Stable service identifier
     * @returns {Object|null}
     */
    getService(name) {
        return this.services[name] || null;
    }

    /**
     * Register an input command handler.
     *
     * Registered commands also appear in the `/` autocomplete list. The
     * optional metadata controls how they are presented there.
     * @param {String} name Command name without the leading slash
     * @param {Function} handler Called with (event, command, params, context)
     * @param {Object} [options] Autocomplete metadata
     * @param {String|Function} [options.description] Text, a `locale_id_`
     * translation key, or a function returning translated text
     * @param {String[]} [options.alias] Alternative names without the slash
     * @param {Boolean} [options.hidden] Keep the command out of autocomplete
     */
    registerCommand(name, handler, options) {
        const command = String(name || '').toLowerCase();
        if (!command || typeof handler !== 'function') {
            return;
        }
        const meta = (options && typeof options === 'object') ? options : {};
        const alias = Array.isArray(meta.alias) ?
            meta.alias
                .map((item) => String(item || '').replace(/^\//, '').toLowerCase())
                .filter((item) => !!item) :
            [];

        this.commands[command] = handler;
        this.commandMeta[command] = {
            command: command,
            alias: alias,
            description: meta.description || '',
            hidden: !!meta.hidden,
        };
    }

    /**
     * Register a local autocomplete provider.
     * @param {String} name Stable provider identifier
     * @param {Object} provider Object with suggest() and optional hint()
     */
    addAutocompleteProvider(name, provider) {
        if (!name || !provider || typeof provider.suggest !== 'function') {
            return;
        }
        this.autocompleteProviders[name] = provider;
    }

    setState(state) {
        this.state = state;

        // Hacky, but since Vues emitter doesnt support 'all', hijack its $emit call
        // so that we can forward the event on to plugins
        let stateEmit = this.state.$emit;
        let thisEmit = this.emit;

        this.state.$emit = (...args) => {
            try {
                thisEmit.call(this, 'all', args[0], ...args.slice(1));
                thisEmit.call(this, ...args);
            } catch (err) {
                Logger.error(err.stack);
            }

            return stateEmit.call(this.state, ...args);
        };

        // Let plugins emit events into the internal state
        this.emit = (...args) => {
            stateEmit.call(this.state, ...args);
            thisEmit.call(this, ...args);
        };
    }

    /**
     * Register a hook that may rewrite or cancel an outgoing chat message.
     *
     * Hooks run in registration order before the local echo is added and before
     * anything reaches the wire. A hook is called with a context object:
     *
     *   {
     *     network, buffer, target, type,   // type: privmsg|action|notice
     *     text,                            // the text the user typed
     *     tags,                            // outgoing IRCv3 tags
     *   }
     *
     * It may return a context object (to replace or amend it), a Promise that
     * resolves to one, or nothing to leave the message untouched. Returning an
     * object with `cancel: true` stops the message from being sent; an optional
     * `error` string is shown in the buffer as a local error.
     *
     * The returned context recognises two extra fields:
     *
     *   wireText     - text actually sent to the server (defaults to `text`)
     *   displayText  - text shown in the local echo (defaults to `text`)
     *   isEncrypted  - marks the local echo as encrypted, which keeps it out of
     *                  local chat logs and lets other plugins treat it specially
     *
     * A hook may hold the message by returning a Promise that only resolves once
     * it is safe to send, eg. after a key exchange completes.
     * @param {Function} hook Called with the outgoing message context
     */
    addOutgoingMessageFilter(hook) {
        if (typeof hook === 'function') {
            this.outgoingMessageFilters.push(hook);
        }
    }

    /**
     * Register a hook that may rewrite the body of an incoming chat message.
     *
     * Hooks are synchronous and run in registration order before the message is
     * formatted and added to a buffer, so a hook may replace the visible text
     * without losing the raw wire text. Each hook is called with:
     *
     *   { network, buffer, nick, target, type, text, tags }
     *
     * and may return `{ text, isEncrypted, bodyTemplate, bodyTemplateProps }`.
     * `text` defaults to the previous value, and returning nothing leaves the
     * message untouched. `bodyTemplate` replaces the rendered message body with
     * a Vue component, which lets a plugin offer an interactive placeholder.
     * @param {Function} hook Called with the incoming message context
     */
    addIncomingMessageFilter(hook) {
        if (typeof hook === 'function') {
            this.incomingMessageFilters.push(hook);
        }
    }

    /**
     * Register a hook that may rewrite an incoming channel topic.
     *
     * The hook is called with `(topic, buffer)` and may return a replacement
     * topic string. Returning nothing leaves the topic untouched.
     * @param {Function} hook Called with the incoming topic
     */
    addIncomingTopicFilter(hook) {
        if (typeof hook === 'function') {
            this.incomingTopicFilters.push(hook);
        }
    }

    /**
     * Register a renderer for a plugin-defined message block type.
     *
     * Incoming text can only ever produce the block types `parseMessage`
     * emits, so a message body cannot impersonate a plugin block. The renderer
     * receives `(block, blocks)` and returns the inner HTML for the block span;
     * it is responsible for escaping any of its own content.
     * @param {String} type Block type, eg. 'fish-marker'
     * @param {Function} render Renderer returning inner HTML
     */
    addBlockRenderer(type, render) {
        const name = String(type || '');
        if (!name || typeof render !== 'function') {
            return;
        }
        this.blockRenderers[name] = render;
    }

    /**
     * Look up a plugin block renderer.
     * @param {String} type Block type
     * @returns {Function|null}
     */
    getBlockRenderer(type) {
        return this.blockRenderers[String(type || '')] || null;
    }

    /**
     * Run every incoming message hook and return the resulting context.
     * @param {Object} context Incoming message context
     * @returns {Object} The possibly rewritten context
     */
    applyIncomingMessageFilters(context) {
        let current = context;
        this.incomingMessageFilters.forEach((hook) => {
            let result;
            try {
                result = hook(current);
            } catch (err) {
                Logger.error('Incoming message filter failed', err);
                return;
            }

            if (result && typeof result === 'object') {
                current = Object.assign({}, current, result);
            }
        });
        return current;
    }

    /**
     * Run every incoming topic hook and return the resulting topic.
     * @param {String} topic Incoming topic
     * @param {Object} buffer Buffer the topic belongs to
     * @returns {String} The possibly rewritten topic
     */
    applyIncomingTopicFilters(topic, buffer) {
        let current = topic;
        this.incomingTopicFilters.forEach((hook) => {
            let result;
            try {
                result = hook(current, buffer);
            } catch (err) {
                Logger.error('Incoming topic filter failed', err);
                return;
            }

            if (typeof result === 'string') {
                current = result;
            }
        });
        return current;
    }

    /**
     * Run the outgoing message hooks, honouring Promise-returning hooks.
     *
     * The callback runs exactly once, either synchronously (when every hook is
     * synchronous) or after the last Promise settles.
     * @param {Object} context Outgoing message context
     * @param {Function} done Called with the final context
     */
    applyOutgoingMessageFilters(context, done) {
        let filters = this.outgoingMessageFilters;
        let index = 0;

        const mergeContext = (current, result) => (
            result && typeof result === 'object' ?
                Object.assign({}, current, result) :
                current
        );

        const finish = (result) => {
            done(result && typeof result === 'object' ? result : context);
        };

        const step = (current) => {
            if (index >= filters.length) {
                finish(current);
                return;
            }

            let filter = filters[index];
            index += 1;

            let result;
            try {
                result = filter(current);
            } catch (err) {
                Logger.error('Outgoing message filter failed', err);
                step(current);
                return;
            }

            if (result && typeof result.then === 'function') {
                result.then((resolved) => {
                    step(mergeContext(current, resolved));
                }, (err) => {
                    Logger.error('Outgoing message filter failed', err);
                    finish({
                        cancel: true,
                        error: 'The message could not be prepared for sending.',
                    });
                });
                return;
            }

            step(mergeContext(current, result));
        };

        step(context);
    }

    /**
     * Attach the plugin secret storage adapter.
     * @param {Object} store Adapter with get/set/delete and isSecure()
     */
    setSecretStore(store) {
        this.secretStore = store || null;
    }

    /**
     * Read a secret blob belonging to a plugin.
     * @param {String} scope Stable, plugin-owned scope name
     * @returns {Promise<String|null>}
     */
    getSecret(scope) {
        if (!this.secretStore || typeof this.secretStore.get !== 'function') {
            return Promise.resolve(null);
        }
        return Promise.resolve(this.secretStore.get(scope));
    }

    /**
     * Write a secret blob belonging to a plugin.
     * @param {String} scope Stable, plugin-owned scope name
     * @param {String} value Secret payload, or null to remove it
     * @returns {Promise<Boolean>} Whether the write happened
     */
    setSecret(scope, value) {
        if (!this.secretStore || typeof this.secretStore.set !== 'function') {
            return Promise.resolve(false);
        }
        if (value === null || typeof value === 'undefined') {
            return Promise.resolve(this.secretStore.delete(scope)).then(() => true);
        }
        return Promise.resolve(this.secretStore.set(scope, String(value)))
            .then(() => true)
            .catch((err) => {
                Logger.error('Unable to store a plugin secret', err);
                return false;
            });
    }

    /**
     * Report whether plugin secrets are protected by the operating system.
     * @returns {Boolean}
     */
    secretsAreSecure() {
        return !!(
            this.secretStore &&
            typeof this.secretStore.isSecure === 'function' &&
            this.secretStore.isSecure()
        );
    }

    /**
     * Report whether a plugin secret store is available at all.
     * @returns {Boolean}
     */
    hasSecretStore() {
        return !!(
            this.secretStore &&
            typeof this.secretStore.get === 'function' &&
            typeof this.secretStore.set === 'function'
        );
    }

    /**
     * Report whether a plugin is currently playing media.
     * Multiple sources may report playback at once. The aggregate
     * `kiwi.media.playing` flag stays true until every source has stopped.
     * @param {String} source Stable plugin identifier, eg. 'radio'
     * @param {Boolean} playing Whether this source is playing
     * @param {Object} metadata Optional details such as title, station, display, or url
     */
    setMediaPlaying(source, playing, metadata = {}) {
        if (!source) {
            return;
        }

        let wasPlaying = this.media.playing;
        if (playing) {
            Vue.set(this.media.sources, source, Object.assign({}, metadata, {
                playing: true,
            }));
        } else {
            Vue.delete(this.media.sources, source);
        }

        this.media.playing = Object.keys(this.media.sources).length > 0;
        if (wasPlaying !== this.media.playing) {
            let event = {
                playing: this.media.playing,
                source,
                metadata,
            };
            if (this.state) {
                this.state.$emit('media.playing', event);
            } else {
                super.emit('media.playing', event);
            }
        }
    }

    isMediaPlaying() {
        return this.media.playing;
    }

    getMediaSource(source) {
        return this.media.sources[source] || null;
    }

    /**
     * Return a human-readable display string for a media source.
     *
     * Media players should provide `metadata.display`; `title` and `station`
     * are accepted as fallbacks for older sources.
     * @param {String} source Stable plugin identifier, eg. 'radio'
     * @returns {String}
     */
    getMediaDisplay(source) {
        const media = this.getMediaSource(source);
        if (!media) {
            return '';
        }

        const candidates = [media.display, media.title, media.station];
        for (let i = 0; i < candidates.length; i += 1) {
            if (typeof candidates[i] === 'string' && candidates[i]) {
                return candidates[i];
            }
        }
        return '';
    }

    getMediaSources() {
        return this.media.sources;
    }

    clearMediaSource(source) {
        this.setMediaPlaying(source, false);
    }

    /**
     * Register the viewport-edge area reserved by a layout chrome plugin.
     *
     * Values are CSS pixels. Sources are combined by taking the maximum value
     * for each edge. All-zero insets remove the source.
     *
     * @param {String} source Stable source identifier, eg. 'nephwave-desktop'
     * @param {Object} insets Values for top, right, bottom, and left
     * @returns {Function} Removes this source's insets when called
     */
    setLayoutInsets(source, insets = {}) {
        const key = String(source || '');
        if (!key) {
            return () => {};
        }

        const normalized = normalizeLayoutInsets(insets);
        const hasInsets = LAYOUT_EDGES.some((edge) => normalized[edge] > 0);
        if (hasInsets) {
            Vue.set(this.layout.sources, key, normalized);
        } else if (this.layout.sources[key]) {
            Vue.delete(this.layout.sources, key);
        }
        this.recomputeLayoutInsets();

        return () => this.clearLayoutInsets(key);
    }

    /**
     * Remove a previously registered layout chrome source.
     * @param {String} source Stable source identifier
     */
    clearLayoutInsets(source) {
        const key = String(source || '');
        if (!key || !this.layout.sources[key]) {
            return;
        }
        Vue.delete(this.layout.sources, key);
        this.recomputeLayoutInsets();
    }

    /**
     * Get a copy of the combined layout chrome insets.
     * @returns {Object} Values for top, right, bottom, and left
     */
    getLayoutInsets() {
        return {
            top: this.layout.insets.top,
            right: this.layout.insets.right,
            bottom: this.layout.insets.bottom,
            left: this.layout.insets.left,
        };
    }

    recomputeLayoutInsets() {
        const next = {};
        LAYOUT_EDGES.forEach((edge) => {
            next[edge] = 0;
        });

        Object.keys(this.layout.sources).forEach((source) => {
            const insets = this.layout.sources[source];
            LAYOUT_EDGES.forEach((edge) => {
                next[edge] = Math.max(next[edge], insets[edge] || 0);
            });
        });

        if (layoutInsetsEqual(this.layout.insets, next)) {
            return;
        }

        this.layout.insets = next;
        this.emit('layout.insets', this.getLayoutInsets());
    }

    setThemeManager(themeManager) {
        this.themes = themeManager;
    }

    /**
     * Change the logging level output
     * @param {number} newLevel The new logging level
     */
    logLevel(newLevel) {
        Logger.setLevel(newLevel);
    }

    get log() {
        return Logger;
    }

    /**
     * Add a DOM element to different parts of the Kiwi UI
     * - addUi('app', componentObject)
     * - addUi('input', componentObject)
     * - addUi('browser', componentObject)
     * - addUi('header_channel', componentObject)
     * - addUi('header_query', componentObject)
     * - addUi('userbox_button', componentObject)
     * - addUi('about_buffer', componentObject)
     * @param {string} type Where this component should be added
     * @param {object} component The vue.js component object
     * @param {object} args Optional arguments for this plugin { title: '', props: {} }
     */
    addUi(type, component, args = {}) {
        const plugin = Misc.makePluginObject(nextPluginId++, component, args);

        switch (type) {
        case 'app':
            this.appPlugins.push(plugin);
            break;
        case 'input':
            this.controlInputPlugins.push(plugin);
            break;
        case 'browser':
            this.stateBrowserPlugins.push(plugin);
            break;
        case 'header_channel':
            this.channelHeaderPlugins.push(plugin);
            break;
        case 'header_query':
            this.queryHeaderPlugins.push(plugin);
            break;
        case 'userbox_button':
            this.userboxButtonPlugins.push(plugin);
            break;
        case 'userbox_info':
            this.userboxInfoPlugins.push(plugin);
            break;
        case 'userbox_whois':
            this.userboxWhoisPlugins.push(plugin);
            break;
        case 'about_buffer':
            this.aboutBufferPlugins.push(plugin);
            break;
        case 'message_info':
            this.messageInfoPlugins.push(plugin);
            break;
        default:
            break;
        }
    }

    /**
     * Add a Vue component as a tab to different tabbed views in the Kiwi API
     * - addTab('channel', 'title', component, props)
     * - addTab('settings', 'title', component, props)
     * - addTab('server', 'title', component, props)
     * @param {String} type The type of tab to add. This determines where it will be shown
     * @param {String} title The title shown on the tab
     * @param {Object} component The vue.js component object that is displayed in this tab
     * @param {Object} props Optional properties for the vue.js component
     */
    addTab(type, title, component, props) {
        const plugin = Misc.makePluginObject(nextPluginId++, component, { props, title });

        switch (type) {
        case 'channel':
            this.sideBarPlugins.push(plugin);
            break;
        case 'settings':
            this.appSettingsPlugins.push(plugin);
            break;
        case 'server':
            this.serverViewPlugins.push(plugin);
            break;
        default:
            break;
        }
    }

    /**
     * Add a plugin settings block to the bottom of an existing settings tab.
     * - addSettingsBlock('general', component, args)
     * - addSettingsBlock('network', component, args)
     * @param {String} type Which settings tab to append to
     * @param {Object} component The vue.js component object to display
     * @param {Object} args Optional arguments for this plugin { title: '', props: {} }
     */
    addSettingsBlock(type, component, args = {}) {
        const plugin = Misc.makePluginObject(nextPluginId++, component, args);

        switch (type) {
        case 'general':
            this.generalSettingsBlocks.push(plugin);
            break;
        case 'network':
            this.networkSettingsBlocks.push(plugin);
            break;
        default:
            break;
        }
    }

    /**
     * Register a Vue component that may be shown in future. It is shown over the entire
     * client alongside the StateBrowser
     * @param {String} name A name to reference this view in future
     * @param {Object} component The vue.js component object to create the view
     * @param {Object} props Optional properties the the vue.js component
     */
    addView(name, component, props) {
        const plugin = Misc.makePluginObject(nextPluginId++, component, { props });
        this.tabs[name] = plugin;
    }

    /**
     * Show a previously registered view
     * @param {String} name The name of previously registered view to show
     */
    showView(name) {
        // null disables any active component and reverts the UI back to the buffers
        let tab = this.tabs[name];
        if (tab) {
            this.state.$emit('active.component', tab.component, tab.props);
        } else {
            this.state.$emit('active.component', null);
        }
    }

    /**
     * Show a Vue.js component in the sidebar
     * @param {Object} component The vue.js component object to render
     * @param {Object} props Optional properties for the vue.js component
     * @param {String} id Optional stable identifier for the component (eg. the
     *                    plugin name) so plugins can recognise their own
     *                    sidebar content for toggling
     */
    showInSidebar(component, props, id) {
        const plugin = Misc.makePluginObject(0, component, { props });
        this.state.$emit('sidebar.component', plugin.component, plugin.props, id || null);
    }

    /**
     * Toggle a Vue.js component in the sidebar. Closes the sidebar when the
     * component with this id is already shown, otherwise shows it.
     * @param {String} id Stable identifier for the component (eg. the plugin name)
     * @param {Object} component The vue.js component object to render
     * @param {Object} props Optional properties for the vue.js component
     */
    toggleInSidebar(id, component, props) {
        const plugin = Misc.makePluginObject(0, component, { props });
        this.state.$emit('sidebar.component.toggle', id, plugin.component, plugin.props);
    }

    /**
     * Add a custom startup screen that may be loaded by the configuration file
     * @param {String} name The name of this startup screen
     * @param {Object} component The vue.js component object
     */
    addStartup(name, component) {
        const plugin = Misc.makePluginObject(0, component);
        let startups = this.state.getStartups();
        startups[name] = plugin.component;
    }

    /**
     * Replace an existing kiwiirc component/module with a custom one
     * @param {String} dest The module path to replace
     * @param {Object} source The new module to insert in place
     */
    replaceModule(dest, source) {
        let mod = this.require(dest);
        if (!mod) {
            throw new Error(`The module ${dest} does not exist`);
        }

        Misc.replaceObjectProps(mod, source);
    }

    /**
     * Add default config params for a plugin
     * @param {String} namespace Base config location eg: 'plugin-conference'
     * @param {Object} defaultConfig Configuration object
     */
    setConfigDefaults(namespace, defaultConfig) {
        let base = `settings.${namespace}`;
        let getSetting = (key) => this.state.getSetting(`${base}.${key}`);
        let setSetting = (key, value) => this.state.setSetting(`${base}.${key}`, value);
        let walkConfig = (obj, _target) => {
            each(obj, (val, key) => {
                let target = [..._target, key];
                let targetName = target.join('.');
                if (typeof val === 'object' && !Array.isArray(val)) {
                    walkConfig(val, target);
                } else if (typeof getSetting(targetName) === 'undefined') {
                    setSetting(targetName, val);
                }
            });
        };
        walkConfig(defaultConfig, []);
    }

    /**
     * Add translations for use in a plugin
     * @param {String} namespace Translations namespace eg: 'plugin-conference'
     * @param {Object} translations Translations object
     */
    addTranslations(namespace, translations) {
        Object.entries(translations).forEach(([lang, data]) => {
            this.i18n.addResourceBundle(lang, namespace, data);
        });
    }

    /**
     * Add url path to translation files
     * @param {String} namespace Translations namespace eg: 'plugin-conference'
     * @param {String} url Translations url path, supported replacements: {{lng}} {{ns}}
     * @param {Object} fallbackLocale Optional fallback 'en-us' locale data from bundle
     */
    addTranslationFiles(namespace, url, fallbackLocale) {
        if (!url.includes('{{lng}}')) {
            this.log.error('A plugin tried to addTranslationsFiles() without {{lng}} in the url');
            return;
        }
        this.translationUrls[namespace] = url;
        if (fallbackLocale) {
            this.i18n.addResourceBundle('en-us', namespace, fallbackLocale);
        }
        this.i18n.loadNamespaces(namespace);
    }
}
