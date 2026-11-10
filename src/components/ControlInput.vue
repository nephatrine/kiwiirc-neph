<template>
    <div
        :class="{
            'kiwi-controlinput--focus': has_focus,
            'kiwi-controlinput--show-send': shouldShowSendButton,
            'kiwi-controlinput--show-tools': shouldShowTools,
            'kiwi-controlinput--show-tools--inline': shouldShowToolsInline,
            'kiwi-controlinput--selfuser-open': selfuser_open,
            'kiwi-controlinput--autocomplete-always': autocompleteAlwaysActive,
        }"
        class="kiwi-controlinput kiwi-theme-bg"
        @dragover="onUploadDragOver"
        @drop="onUploadDrop"
    >
        <auto-complete
            v-if="autocomplete_open"
            ref="autocomplete"
            :items="autocomplete_items"
            :filter="autocomplete_filter"
            :buffer="buffer"
            @selected="onAutocompleteSelected"
            @temp="onAutocompleteTemp"
            @cancel="onAutocompleteCancel"
        />
        <div class="kiwi-controlinput-selfuser">
            <transition name="kiwi-selfuser-trans">
                <self-user
                    v-if="networkState === 'connected'
                        && selfuser_open === true"
                    :network="network"
                    @close="selfuser_open = false"
                />
            </transition>
        </div>

        <div v-if="serviceArgGhost()" class="kiwi-controlinput-ns-hint">{{ serviceArgGhost() }}</div>
        <div v-if="providerAutocompleteHint" class="kiwi-controlinput-ns-hint">
            {{ providerAutocompleteHint }}
        </div>
        <div
            v-if="autocompleteAlwaysActive"
            class="kiwi-controlinput-autocomplete-hint"
            role="status"
            aria-live="polite"
        >
            <i class="bx bx-bolt-circle" aria-hidden="true" />
            <span>{{ $t('autocomplete_always_hint') }}</span>
        </div>
        <div
            v-if="showCommandWarning"
            class="kiwi-controlinput-command-warn"
            role="alert"
            aria-live="assertive"
        >
            <div class="kiwi-controlinput-command-text">
                <i class="bx bx-error" aria-hidden="true" />
                <div>
                    <strong>{{ $t('command_accidental_title') }}</strong>
                    <div>{{ $t('command_accidental_text') }}</div>
                </div>
            </div>
            <div class="u-input-confirm">
                <button
                    type="button"
                    class="u-button u-button-warning"
                    @mousedown.prevent
                    @click="sendCommandWarning"
                >
                    {{ $t('command_accidental_send') }}
                </button>
                <button
                    type="button"
                    class="u-button"
                    @mousedown.prevent
                    @click="dismissCommandWarning"
                >
                    {{ $t('command_accidental_edit') }}
                </button>
            </div>
        </div>
        <div class="kiwi-controlinput-inner">
            <typing-users-list :buffer="buffer" />
            <away-status-indicator
                v-if="network && network.state === 'connected'"
                :network="network"
                :user="network.currentUser()"
            />
            <div v-if="currentNick" :title="$t('state_account')" class="kiwi-controlinput-user" @click="toggleSelfUser">
                <span class="kiwi-controlinput-user-nick">{{ currentNick }}</span>
                <i
                    :class="[selfuser_open ? 'bx-caret-down' : 'bx-caret-up']"
                    class="bx"
                    aria-hidden="true"
                />
            </div>
            <div v-if="buffer.replying_to" class="kiwi-controlinput-reply">
                <div class="kiwi-controlinput-reply-nick">{{ $t('replying_to') }} {{ buffer.replying_to.nick }}</div>
                <div class="kiwi-controlinput-reply-message">{{ buffer.replying_to.message }}</div>
                <div :title="$t('cancel')" class="kiwi-controlinput-reply-cancel" @click="buffer.replying_to = null">
                    <i class="bx bx-x" aria-hidden="true" />
                </div>
            </div>
            <form
                class="kiwi-controlinput-form"
                @submit.prevent="submitForm(false)"
                @click="maybeHidePlugins"
            >
                <div class="kiwi-controlinput-input-wrap">
                    <irc-input
                        ref="input"
                        :placeholder="$t('input_placeholder')"
                        class="kiwi-controlinput-input"
                        wrap="off"
                        @input="inputUpdate"
                        @keydown="inputKeyDown($event)"
                        @keyup="inputKeyUp($event)"
                        @click="showPlugins = false"
                        @focus="focusChanged"
                        @blur="focusChanged"
                        @files="uploadFiles"
                    />
                </div>
                <div
                    v-if="shouldShowSendButton"
                    class="kiwi-controlinput-send-container kiwi-controlinput-tools"
                >
                    <button
                        ref="sendButton"
                        :title="$t('send_message')"
                        type="submit"
                        class="kiwi-controlinput-button kiwi-controlinput-send bx bx-paper-plane"
                    />
                </div>
            </form>

            <div
                v-if="shouldShowTools"
                ref="plugins"
                class="kiwi-controlinput-tools kiwi-controlinput-tools-wrapper"
            >
                <div
                    v-if="!shouldShowToolsInline"
                    :title="$t('tools')"
                    class="kiwi-controlinput-tools-expand kiwi-controlinput-button"
                    :class="{ 'kiwi-controlinput-tools-expand--closed': !showPlugins }"
                    @click="showPlugins = !showPlugins"
                    @mousedown.prevent
                >
                    <i class="bx bx-menu" aria-hidden="true" />
                </div>
                <transition name="kiwi-plugin-ui-trans">
                    <div
                        v-if="showPlugins || shouldShowToolsInline"
                        class="kiwi-controlinput-tools-container"
                    >
                        <div
                            v-if="shouldShowColorPicker && isWideEnough"
                            :title="$t('styling_tools')"
                            class="kiwi-controlinput-button"
                            @click.prevent="onToolClickStyling"
                            @mousedown.prevent
                        >
                            <i class="bx bx-font" aria-hidden="true" />
                        </div>
                        <template v-if="shouldShowColorPicker && !isWideEnough">
                            <div
                                :title="`${$t('color_picker')} (${$t('color_shift_hint')})`"
                                class="kiwi-controlinput-button"
                                @click.prevent="onToolClickTextStyle"
                                @mousedown.prevent
                            >
                                <i class="bx bx-adjust" aria-hidden="true" />
                            </div>
                            <div
                                :title="$t('formatting_tools')"
                                class="kiwi-controlinput-button"
                                @click.prevent="onToolClickFormatting"
                                @mousedown.prevent
                            >
                                <i class="bx bx-font" aria-hidden="true" />
                            </div>
                        </template>
                        <div
                            v-if="shouldShowEmojiPicker"
                            :title="$t('emoji_picker')"
                            class="kiwi-controlinput-button"
                            @click.prevent="onToolClickEmoji"
                            @mousedown.prevent
                        >
                            <i class="bx bx-smile" aria-hidden="true" />
                        </div>
                        <div
                            v-if="shouldShowFileUpload"
                            :title="$t('fileupload_button')"
                            class="kiwi-controlinput-button"
                            :class="{ 'kiwi-controlinput-button--busy': uploading }"
                            @click.prevent="onUploadClick"
                            @mousedown.prevent
                        >
                            <i
                                :class="uploading ? 'bx-loader-alt bx-spin' : 'bx-upload'"
                                class="bx"
                                aria-hidden="true"
                            />
                        </div>
                        <component
                            :is="plugin.component"
                            v-for="plugin in pluginUiElements"
                            :key="plugin.id"
                            :plugin-props="{
                                buffer,
                                controlinput: self,
                            }"
                            v-bind="plugin.props"
                            :network="network"
                            :buffer="buffer"
                            class="kiwi-controlinput-button"
                        />
                    </div>
                </transition>
            </div>
        </div>

        <input
            v-if="shouldShowFileUpload"
            ref="fileUpload"
            type="file"
            multiple
            tabindex="-1"
            class="kiwi-controlinput-fileupload"
            @change="onUploadSelected"
        >
        <div class="kiwi-controlinput-active-tool">
            <template v-if="active_tool === 'styling'">
                <tool-text-style v-bind="active_tool_props" />
                <tool-formatting v-bind="active_tool_props" />
            </template>
            <component :is="active_tool" v-else v-bind="active_tool_props" />
        </div>

    </div>
</template>

<script>
'kiwi public';

import * as Misc from '@/helpers/Misc';
import { escapeHtml } from '@/helpers/Utils';
import * as TextFormatting from '@/helpers/TextFormatting';
import * as EmojiProvider from '@/libs/EmojiProvider';
import * as Emoji from '@/helpers/Emoji';
import * as settingTools from '@/libs/settingTools';
import {
    AUTOCOMPLETE_REQUEST,
    AUTOCOMPLETE_RESPONSE,
    AUTOCOMPLETE_TIMEOUT,
    autocompleteCommandContext,
    canRequestAutocomplete,
    parseAutocompleteResponses
} from '@/libs/Autocomplete';
import Logger from '@/libs/Logger';

import autocompleteCommands from '@/res/autocompleteCommands';
import {
    nickservSubcommands,
    NICKSERV_SYNTAX,
    NICKSERV_FLAGS,
    nickservBadge,
    isNickservSubcommandPosition,
    parseNickservInput,
    nickservArgSuggestions,
    nickservSyntaxFor
} from '@/libs/ErgoServices';
import {
    chanservSubcommands,
    CHANSERV_SYNTAX,
    chanservBadge,
    isChanservSubcommandPosition,
    parseChanservInput,
    chanservArgSuggestions,
    chanservSyntaxFor,
    CHANSERV_FLAGS
} from '@/libs/ErgoChanServ';
import {
    hostservSubcommands,
    HOSTSERV_SYNTAX,
    HOSTSERV_FLAGS,
    hostservBadge,
    isHostservSubcommandPosition,
    parseHostservInput,
    hostservArgSuggestions,
    hostservSyntaxFor
} from '@/libs/ErgoHostServ';
import {
    histservSubcommands,
    HISTSERV_SYNTAX,
    HISTSERV_FLAGS,
    histservBadge,
    isHistservSubcommandPosition,
    parseHistservInput,
    histservArgSuggestions,
    histservSyntaxFor
} from '@/libs/ErgoHistServ';
import {
    BOUNCERSERV_SUBCOMMANDS,
    BOUNCERSERV_SYNTAX,
    isBouncerservSubcommandPosition,
    parseBouncerservInput,
    bouncerservArgSuggestions,
    bouncerservSyntaxFor
} from '@/libs/SojuServices';
import GlobalApi from '@/libs/GlobalApi';
import { effectiveRetention, effectiveService } from '@/libs/fileupload';
import AutoComplete from './AutoComplete';
import ToolTextStyle from './inputtools/TextStyle';
import ToolFormatting from './inputtools/Formatting';
import SelfUser from './SelfUser';
import AwayStatusIndicator from './AwayStatusIndicator';
import TypingUsersList from './TypingUsersList';

const EMOJI_AUTOCOMPLETE_RE = /:([^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}/:]+)(?:\/([^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Zs}:]+))?$/u;

function trailingEmojiToken(value) {
    const token = String(value || '');
    const match = EMOJI_AUTOCOMPLETE_RE.exec(token);
    if (!match) {
        return '';
    }

    const start = match.index;
    if (start > 0 && /[\p{L}\p{N}_]/u.test(token[start - 1])) {
        return '';
    }

    return match[0];
}

export default {
    components: {
        AutoComplete,
        AwayStatusIndicator,
        SelfUser,
        TypingUsersList,
        ToolTextStyle,
        ToolFormatting,
    },
    props: ['network', 'buffer', 'sidebarState'],
    data() {
        return {
            self: this,
            selfuser_open: false,
            autocomplete_open: false,
            autocomplete_remote: false,
            autocomplete_remote_context: null,
            autocompleteProviders: GlobalApi.singleton().autocompleteProviders,
            autocomplete_items: [],
            autocomplete_filter: '',
            // Typing filters the suggestion list. Tab or Enter accepts the
            // highlighted item; the arrow keys navigate without inserting.
            autocomplete_filtering: true,
            active_tool: null,
            active_tool_props: {},
            pluginUiElements: GlobalApi.singleton().controlInputPlugins,
            showPlugins: false,
            showCommandWarning: false,
            current_input_value: '',
            has_focus: false,
            keep_focus: false,
            uploading: false,
            uploadQueue: [],
        };
    },
    computed: {
        currentNick() {
            let activeNetwork = this.$state.getActiveNetwork();
            return activeNetwork ?
                activeNetwork.nick :
                '';
        },
        providerAutocompleteHint() {
            if (!this.network || !this.buffer) {
                return '';
            }

            const input = this.current_input_value || '';
            const providers = Object.entries(this.autocompleteProviders || {});
            for (let i = 0; i < providers.length; i += 1) {
                const name = providers[i][0];
                const provider = providers[i][1];
                if (!provider || typeof provider.hint !== 'function') {
                    continue;
                }
                try {
                    const hint = provider.hint({
                        input,
                        network: this.network,
                        buffer: this.buffer,
                    });
                    if (hint) {
                        return String(hint);
                    }
                } catch (err) {
                    Logger.error('Autocomplete hint provider failed', name, err);
                }
            }
            return '';
        },
        networkState() {
            let activeNetwork = this.$state.getActiveNetwork();
            return activeNetwork ?
                activeNetwork.state :
                '';
        },
        shouldShowSendButton() {
            return this.$state.ui.is_touch || this.$state.setting('showSendButton');
        },
        shouldShowEmojiPicker() {
            if (this.network && !this.network.isUtf8) {
                return false;
            }

            return (
                this.$state.setting('forceShowEmojiPicker') ||
                (this.$state.setting('showEmojiPicker') && !this.$state.ui.is_touch)
            );
        },
        shouldShowColorPicker() {
            return this.$state.setting('showColorPicker');
        },
        fileUploadNetwork() {
            let buffer = this.buffer;
            if (buffer && typeof buffer.getNetwork === 'function') {
                return buffer.getNetwork();
            }
            return this.network;
        },
        shouldShowFileUpload() {
            return !!effectiveService(this.$state, this.fileUploadNetwork);
        },
        shouldShowTools() {
            if (
                this.pluginUiElements.length ||
                this.shouldShowEmojiPicker ||
                this.shouldShowColorPicker ||
                this.shouldShowFileUpload
            ) {
                return true;
            }
            return false;
        },
        shouldShowToolsInline() {
            let toolCount = this.pluginUiElements.length;
            if (this.shouldShowEmojiPicker) {
                toolCount++;
            }
            if (this.shouldShowColorPicker) {
                toolCount += (this.isWideEnough ? 1 : 2);
            }
            if (this.shouldShowFileUpload) {
                toolCount++;
            }

            if (toolCount <= 1) {
                // No point showing a menu button to replace one item
                return true;
            }

            // Button size (36px)
            // Total buttons width < 1/5 screen width
            return (36 * toolCount < this.$state.ui.app_width / 5);
        },
        isWideEnough() {
            return this.$state.ui.app_width > 1030;
        },
        history() {
            if (this.$state.setting('buffers.shared_input')) {
                return this.$state.ui.input_history;
            }

            return this.buffer.input_history;
        },
        history_pos: {
            get() {
                if (this.$state.setting('buffers.shared_input')) {
                    return this.$state.ui.input_history_pos;
                }
                return this.buffer.input_history_pos;
            },
            set(newVal) {
                if (this.$state.setting('buffers.shared_input')) {
                    this.$state.ui.input_history_pos = newVal;
                } else {
                    this.buffer.input_history_pos = newVal;
                }
            },
        },
        autocompleteAlways() {
            if (!this.network) {
                return false;
            }
            const networks = this.$state.ui.autocomplete_always_networks || [];
            return networks.indexOf(this.network.id) !== -1;
        },
        autocompleteAlwaysActive() {
            if (!this.autocompleteAlways || !this.buffer) {
                return false;
            }
            const isMessageBuffer =
                typeof this.buffer.isChannel === 'function' &&
                (this.buffer.isChannel() || (
                    typeof this.buffer.isQuery === 'function' &&
                    this.buffer.isQuery()
                ));
            return isMessageBuffer && canRequestAutocomplete(this.network);
        },
    },
    watch: {
        history_pos(newVal) {
            let val = this.history[this.history_pos];
            this.$refs.input.setValue(val || '');
        },
        buffer() {
            if (!this.$state.setting('buffers.shared_input')) {
                this.inputRestore();
            }

            this.clearAutocompletePending();
            this.autocomplete_open = false;
            this.autocomplete_remote = false;
            this.autocomplete_remote_context = null;
        },
    },
    created() {
        this.typingTimer = null;
        this.lastTypingTime = 0;
        this.autocomplete_pending = null;

        this.listen(this.$state, 'autocomplete.request', (payload) => {
            this.onAutocompleteRequestEcho(payload);
        });
        this.listen(this.$state, 'autocomplete.response', (payload) => {
            this.onAutocompleteResponse(payload);
        });
        this.listen(this.$state, 'autocomplete.toggle', (payload) => {
            this.onAutocompleteToggle(payload);
        });

        this.listen(this.$state, 'document.keydown', (ev) => {
            // No input box currently? Nothing to shift focus to
            if (!this.$refs.input) {
                return;
            }

            // If we're copying text, don't shift focus
            if (ev.ctrlKey || ev.altKey || ev.metaKey) {
                return;
            }

            // shift key on its own, don't shift focus we handle this below
            if (ev.key === 'Shift') {
                return;
            }

            // If we are using shift and arrow keys, don't shift focus
            // this allows users to adjust text selection
            let arrowKeyCodes = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
            if (ev.shiftKey && arrowKeyCodes.indexOf(ev.key) !== -1) {
                return;
            }

            // If we're typing into an input box somewhere, ignore
            let elements = ['input', 'select', 'textarea', 'button', 'datalist', 'keygen'];
            let doNotRefocus =
                elements.indexOf(ev.target.tagName.toLowerCase()) > -1 ||
                ev.target.getAttribute('contenteditable');

            if (doNotRefocus) {
                return;
            }

            this.$refs.input.focus();
        });

        this.listen(this.$state, 'input.insertnick', (nick) => {
            if (!this.$refs.input) {
                return;
            }

            let val = nick;
            if (this.current_input_value === '') {
                val += ': ';
            } else {
                val += ' ';
            }

            this.$refs.input.insertText(val);
        });

        this.listen(this.$state, 'input.tool', (toolComponent) => {
            this.toggleInputTool(toolComponent);
        });

        this.listen(this.$state, 'input.reply', (nick) => {
            if (!this.$refs.input) {
                return;
            }

            this.$refs.input.focus();
            this.$refs.input.selectionToStart();
            this.$refs.input.insertText(nick + ': ');
        });
    },
    mounted() {
        this.inputRestore();
    },
    methods: {
        inputUpdate(val) {
            this.current_input_value = val;

            if (this.$state.setting('buffers.shared_input')) {
                this.$state.ui.current_input = val;
            } else {
                this.buffer.current_input = val;
            }

            // Clear the command warning on any new input
            this.showCommandWarning = false;
            this.maybeHidePlugins();

            // Let plugins react to typing without exposing the draft text.
            this.$state.$emit('input.activity', {
                network: this.network,
                buffer: this.buffer,
                textLength: (val || '').length,
            });
        },
        inputRestore() {
            let currentInput = this.$state.setting('buffers.shared_input') ?
                this.$state.ui.current_input :
                this.buffer.current_input;

            this.$refs.input.reset(currentInput, this.keep_focus);
            this.$refs.input.selectionToEnd();
        },
        toggleSelfUser() {
            if (this.networkState === 'connected') {
                this.selfuser_open = !this.selfuser_open;
            }
        },
        maybeHidePlugins() {
            // Save some space if we're typing on a small screen
            if (this.$state.ui.app_width < 500) {
                this.showPlugins = false;
            }
        },
        onToolClickTextStyle() {
            this.toggleInputTool(ToolTextStyle);
        },
        onToolClickFormatting() {
            this.toggleInputTool(ToolFormatting);
        },
        onToolClickStyling() {
            if (this.active_tool === 'styling') {
                this.active_tool = null;
            } else {
                this.active_tool_props = {
                    buffer: this.buffer,
                    ircinput: this.$refs.input,
                };
                this.active_tool = 'styling';
            }
        },
        onToolClickEmoji() {
            this.$state.$emit('emojipicker.show', {
                type: 'input',
                ircinput: this.$refs.input,
            });
        },
        onUploadClick() {
            if (this.uploading || !this.$refs.fileUpload) {
                return;
            }
            this.$refs.fileUpload.click();
        },
        onUploadSelected(event) {
            let input = event.target;
            this.uploadFiles(input.files);
            input.value = '';
        },
        onUploadDragOver(event) {
            if (!this.shouldShowFileUpload || !this.transferHasFiles(event.dataTransfer)) {
                return;
            }
            event.preventDefault();
        },
        onUploadDrop(event) {
            if (!this.shouldShowFileUpload || !this.transferHasFiles(event.dataTransfer)) {
                return;
            }
            event.preventDefault();
            this.uploadFiles(event.dataTransfer.files);
        },
        transferHasFiles(dataTransfer) {
            let types = dataTransfer && dataTransfer.types;
            return !!(types && Array.prototype.indexOf.call(types, 'Files') !== -1);
        },
        uploadFiles(fileList) {
            let files = Array.from(fileList || []);
            if (!files.length || !this.shouldShowFileUpload) {
                return;
            }

            // Keep the upload in the buffer where it was started, even if the
            // user switches buffers before a queued file finishes uploading.
            const buffer = this.buffer;
            const network = this.fileUploadNetwork;
            const queued = files.map((file) => ({ file, buffer, network }));
            this.uploadQueue = this.uploadQueue.concat(queued);
            if (this.uploading) {
                return;
            }
            this.drainUploadQueue();
        },
        drainUploadQueue() {
            this.uploading = true;
            let next = () => {
                if (!this.uploadQueue.length) {
                    this.uploading = false;
                    return undefined;
                }
                let item = this.uploadQueue.shift();
                return this.uploadOne(item.file, item.buffer, item.network).then(next);
            };
            return next();
        },
        async uploadOne(file, uploadBuffer = this.buffer, uploadNetwork = this.fileUploadNetwork) {
            let network = uploadNetwork;
            let service = effectiveService(this.$state, network);
            let buffer = uploadBuffer;
            let canSend = service && buffer && network && network.state === 'connected'
                && network.ircClient
                && (buffer.isChannel() || buffer.isQuery());
            if (!canSend) {
                this.showUploadError(file);
                return;
            }
            try {
                if (service.maxBytes && file.size > service.maxBytes) {
                    this.showUploadError(file, 'fileupload_too_large', {
                        service: service.label,
                    });
                    return;
                }
                let url = await service.upload(file, {
                    retention: effectiveRetention(this.$state, service),
                    network,
                    state: this.$state,
                });
                this.appendUploadUrl(buffer, url);
            } catch (err) {
                this.showUploadError(file);
            }
        },
        appendUploadUrl(buffer, url) {
            if (!buffer || !url) {
                return;
            }

            const sharedInput = this.$state.setting('buffers.shared_input');
            const isActiveBuffer = this.buffer === buffer;
            const input = this.$refs.input;

            if ((sharedInput || isActiveBuffer) && input) {
                const raw = input.getRawText();
                const prefix = raw && !/\s$/.test(raw) ? ' ' : '';
                input.appendText(prefix + url);
                return;
            }

            const current = buffer.current_input || '';
            const container = document.createElement('div');
            container.innerHTML = current;
            const text = container.textContent || '';
            const prefix = text && !/\s$/.test(text) ? ' ' : '';
            buffer.current_input = current + (prefix ? ' ' : '') + escapeHtml(url);
        },
        showUploadError(file, key = 'fileupload_failed', params = {}) {
            if (!this.buffer) {
                return;
            }
            this.$state.addMessage(this.buffer, {
                time: Date.now(),
                nick: '*',
                message: this.$t(key, {
                    name: file && file.name ? file.name : '',
                    ...params,
                }),
                type: 'error',
            });
        },
        closeInputTool() {
            this.active_tool = null;
        },
        toggleInputTool(tool) {
            if (!tool || this.active_tool === tool) {
                this.active_tool = null;
            } else {
                this.active_tool_props = {
                    buffer: this.buffer,
                    ircinput: this.$refs.input,
                };
                this.active_tool = tool;
            }
        },
        toggleBold() {
            this.$refs.input.toggleBold();
        },
        toggleItalic() {
            this.$refs.input.toggleItalic();
        },
        toggleUnderline() {
            this.$refs.input.toggleUnderline();
        },
        toggleStrikethrough() {
            this.$refs.input.toggleStrikethrough();
        },
        toggleMonospace() {
            this.$refs.input.toggleMonospace();
        },
        providerAutocompleteResult(inputVal, currentToken) {
            if (!this.network || !this.buffer) {
                return null;
            }

            const providers = Object.entries(this.autocompleteProviders || {});
            for (let i = 0; i < providers.length; i += 1) {
                const name = providers[i][0];
                const provider = providers[i][1];
                if (!provider || typeof provider.suggest !== 'function') {
                    continue;
                }
                try {
                    const result = provider.suggest({
                        input: inputVal,
                        token: currentToken,
                        network: this.network,
                        buffer: this.buffer,
                    });
                    if (result && result.active) {
                        return {
                            active: true,
                            items: Array.isArray(result.items) ? result.items : [],
                            filter: typeof result.filter === 'string' ?
                                result.filter :
                                currentToken,
                            filtering: result.filtering !== false,
                        };
                    }
                } catch (err) {
                    Logger.error(
                        'Autocomplete suggestion provider failed',
                        name,
                        err
                    );
                }
            }
            return null;
        },
        openProviderAutocomplete(result, currentToken, filtering) {
            if (!result || !result.active) {
                return false;
            }
            if (result.items.length === 0) {
                this.autocomplete_open = false;
                return true;
            }
            this.openAutoComplete(result.items);
            this.autocomplete_filter = typeof result.filter === 'string' ?
                result.filter :
                currentToken;
            this.autocomplete_filtering = typeof filtering === 'boolean' ?
                filtering :
                result.filtering;
            return true;
        },
        maybeRequestAutocomplete(inputVal) {
            if (this.autocomplete_pending || this.autocomplete_remote) {
                return false;
            }
            return this.requestAutocomplete(inputVal);
        },
        clearAutocompletePending() {
            if (!this.autocomplete_pending) {
                return;
            }
            clearTimeout(this.autocomplete_pending.timer);
            this.autocomplete_pending = null;
        },
        requestAutocomplete(inputVal) {
            if (!canRequestAutocomplete(this.network)) {
                return false;
            }
            const context = autocompleteCommandContext(
                inputVal,
                this.buffer,
                this.autocompleteAlways
            );
            if (!context) {
                return false;
            }

            this.clearAutocompletePending();
            this.autocomplete_remote_context = {
                prefix: context.prefix,
                text: context.text,
            };
            const label = this.network.hasCap('labeled-response') ?
                Misc.generateLabel() :
                '';
            const tags = {
                [AUTOCOMPLETE_REQUEST]: context.text,
            };
            if (label) {
                tags.label = label;
            }

            const pending = {
                text: context.text,
                prefix: context.prefix,
                target: context.target,
                label,
                msgid: '',
                timer: null,
            };
            this.autocomplete_pending = pending;
            pending.timer = setTimeout(() => {
                if (this.autocomplete_pending === pending) {
                    this.autocomplete_pending = null;
                }
            }, AUTOCOMPLETE_TIMEOUT);

            this.network.ircClient.tagmsg(context.target, tags);
            return true;
        },
        onAutocompleteRequestEcho(payload) {
            const pending = this.autocomplete_pending;
            if (!pending || !payload || payload.network !== this.network) {
                return;
            }
            const event = payload.event;
            if (!event || !event.tags) {
                return;
            }
            if (event.nick && !this.network.caseCompare(event.nick, this.network.nick)) {
                return;
            }
            if (pending.label && event.tags.label && event.tags.label !== pending.label) {
                return;
            }
            const request = event.tags[AUTOCOMPLETE_REQUEST];
            if (typeof request === 'string' && request !== pending.text) {
                return;
            }
            if (event.tags.msgid) {
                pending.msgid = event.tags.msgid;
            }
        },
        onAutocompleteResponse(payload) {
            const pending = this.autocomplete_pending;
            if (!pending || !payload || payload.network !== this.network) {
                return;
            }
            const event = payload.event;
            if (!event || !event.tags) {
                return;
            }
            if (event.nick && this.network.caseCompare(event.nick, this.network.nick)) {
                return;
            }

            const reply = event.tags['+draft/reply'] || event.tags['+reply'];
            if (pending.msgid && reply && reply !== pending.msgid) {
                return;
            }

            const current = this.$refs.input ? this.$refs.input.getRawText() : '';
            if (!current.startsWith(pending.prefix) ||
                current.slice(pending.prefix.length) !== pending.text
            ) {
                this.clearAutocompletePending();
                this.autocomplete_open = false;
                this.autocomplete_remote = false;
                this.autocomplete_remote_context = null;
                return;
            }

            const responses = parseAutocompleteResponses(
                pending.text,
                event.tags[AUTOCOMPLETE_RESPONSE]
            );
            if (responses.length === 0) {
                return;
            }

            const source = event.nick || pending.target;
            const firstResponse = !this.autocomplete_remote;
            const existingKeys = firstResponse ?
                new Set() :
                new Set(this.autocomplete_items.map((item) => item.key));
            const newItems = responses
                .map((text) => {
                    const key = `${source}\u0000${text}`;
                    return {
                        text,
                        description: source,
                        type: 'command',
                        remote: true,
                        prefix: pending.prefix,
                        key,
                    };
                })
                .filter((item) => !existingKeys.has(item.key));

            if (newItems.length === 0) {
                return;
            }

            // The first remote response starts a clean list. Local command
            // suggestions may still be cached from before the popup closed.
            this.autocomplete_items = firstResponse ?
                newItems :
                this.autocomplete_items.concat(newItems);
            this.autocomplete_filter = '';
            this.autocomplete_filtering = true;
            this.autocomplete_remote = true;
            this.autocomplete_open = true;
            if (firstResponse) {
                this.$nextTick(() => {
                    if (this.$refs.autocomplete) {
                        this.$refs.autocomplete.resetSelection();
                    }
                });
            }
        },
        applyAutocompleteValue(selectedValue, selectedItem) {
            if (selectedItem && selectedItem.remote) {
                const prefix = typeof selectedItem.prefix === 'string' ?
                    selectedItem.prefix :
                    '';
                this.$refs.input.setPlainText(prefix + selectedValue);
            } else if (selectedItem && selectedItem.type === 'emoji') {
                this.applyEmojiAutocompleteValue(selectedValue);
            } else if (selectedValue.length > 0) {
                this.$refs.input.setCurrentWord(selectedValue);
            }
        },
        applyEmojiAutocompleteValue(selectedValue) {
            const currentWord = this.$refs.input.getCurrentWord();
            const prefix = currentWord.word.substr(0, currentWord.position);
            const token = this.emojiAutocompleteToken(prefix);

            if (!token) {
                this.$refs.input.setCurrentWord(selectedValue);
                return;
            }

            const tokenStart = prefix.length - token.length;
            this.$refs.input.setCurrentWord(
                prefix.substr(0, tokenStart) + selectedValue,
                false,
                true
            );
        },
        onAutocompleteToggle(payload) {
            if (!payload || !payload.network) {
                return;
            }

            const networks = this.$state.ui.autocomplete_always_networks || [];
            const networkId = payload.network.id;
            const idx = networks.indexOf(networkId);
            if (idx === -1) {
                networks.push(networkId);
            } else {
                networks.splice(idx, 1);
            }

            if (payload.network === this.network) {
                this.clearAutocompletePending();
                this.autocomplete_open = false;
                this.autocomplete_remote = false;
                this.autocomplete_remote_context = null;
            }
        },
        onAutocompleteCancel() {
            this.clearAutocompletePending();
            this.autocomplete_open = false;
            this.autocomplete_remote = false;
            this.autocomplete_remote_context = null;
        },
        onAutocompleteTemp(selectedValue, selectedItem) {
            if (!this.autocomplete_filtering && !this.autocomplete_remote) {
                this.applyAutocompleteValue(selectedValue, selectedItem);
            }
        },
        onAutocompleteSelected(selectedValue, selectedItem) {
            this.applyAutocompleteValue(selectedValue, selectedItem);
            this.clearAutocompletePending();
            this.autocomplete_open = false;
            this.autocomplete_remote = false;
            this.autocomplete_remote_context = null;
        },
        inputKeyDown(event) {
            let meta = false;

            if (navigator.appVersion.indexOf('Mac') !== -1) {
                meta = event.metaKey;
            } else {
                meta = event.ctrlKey;
            }

            const isPlainTab = event.key === 'Tab' &&
                !event.shiftKey &&
                !event.altKey &&
                !event.metaKey &&
                !event.ctrlKey;
            let inputText = '';
            let autocompleteRequested = false;

            // Let an open list consume Tab/Enter and word-break keys before
            // starting a remote autocomplete request.
            const hasAutocomplete = this.autocomplete_open && this.$refs.autocomplete;
            const autocompleteHandled = hasAutocomplete &&
                this.$refs.autocomplete.handleOnKeyDown(event);
            if (autocompleteHandled) {
                // Enter accepts the highlighted item and sends it. Tab only
                // completes, letting the user keep editing.
                if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
                    this.maybeReplaceEmoji();
                    event.preventDefault();
                    this.submitForm(false);
                }
                return;
            }

            if (isPlainTab) {
                inputText = this.$refs.input.getRawText();
                autocompleteRequested = this.maybeRequestAutocomplete(inputText);
            }
            const autocompletePending = !!this.autocomplete_pending;

            if (event.key === 'Enter' && (
                (event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey) ||
                (event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey)
            )) {
                // Add new line when shift+enter or alt+enter is pressed
                event.preventDefault();
                this.$refs.input.insertText('\n');
            } else if (event.key === 'Enter') {
                this.maybeReplaceEmoji();
                // Send message when enter is pressed
                event.preventDefault();
                this.submitForm(false);
            } else if (event.key === 'Escape' && this.showCommandWarning) {
                // Close command warning if the user presses escape
                this.showCommandWarning = false;
            } else if ([' ', '.', ',', '!', '?', ':', ';'].includes(event.key)) {
                // Hitting a word-breaker after just typing an emoji shortcode will get it replaced
                // with its native unicode character if enabled
                this.maybeReplaceEmoji();
            } else if (event.key === 'ArrowUp') {
                // Up
                if (this.$refs.input.getCaretIdx() > 0) {
                    // not at the start of input, allow normal input behaviour
                    return;
                }

                event.preventDefault();
                this.historyBack();
            } else if (event.key === 'ArrowDown') {
                // Down
                let text = this.$refs.input.getRawText().replace(/\r?\n/g, '');
                if (this.$refs.input.getCaretIdx() < text.length) {
                    // not at the end of input, allow normal input behaviour
                    return;
                }
                event.preventDefault();
                this.historyForward();
                this.$nextTick(() => {
                    this.$refs.input.selectionToEnd();
                });
            } else if (
                event.key === 'Tab'
                && !event.shiftKey
                && !event.altKey
                && !event.metaKey
                && !event.ctrlKey
            ) {
                // Tab and no other keys as tab+other is often a keyboard shortcut
                // Tab key was just pressed, start general auto completion
                let currentWord = this.$refs.input.getCurrentWord();
                let currentToken = currentWord.word.substr(0, currentWord.position);
                const providerResult = this.providerAutocompleteResult(
                    inputText,
                    currentToken
                );

                if (this.openProviderAutocomplete(
                    providerResult,
                    currentToken,
                    true
                )) {
                    event.preventDefault();
                    return;
                }

                if (autocompleteRequested || autocompletePending) {
                    event.preventDefault();
                    return;
                }

                let items = [];
                if (inputText.indexOf('/set') === 0) {
                    items = this.buildAutoCompleteItems({ settings: true });
                } else if (this.shouldCompleteNickserv(inputText)) {
                    items = this.buildAutoCompleteItems({ nickserv: true });
                } else if (this.shouldCompleteChanserv(inputText)) {
                    items = this.buildAutoCompleteItems({ chanserv: true });
                } else if (this.shouldCompleteHostserv(inputText)) {
                    items = this.buildAutoCompleteItems({ hostserv: true });
                } else if (this.shouldCompleteHistserv(inputText)) {
                    items = this.buildAutoCompleteItems({ histserv: true });
                } else if (this.shouldCompleteBouncerserv(inputText)) {
                    items = this.buildAutoCompleteItems({ bouncerserv: true });
                } else {
                    let nsArgItems = this.nsArgContextItems(inputText);
                    let csArgItems = this.csArgContextItems(inputText);
                    let hsArgItems = this.hsArgContextItems(inputText);
                    let histArgItems = this.histArgContextItems(inputText);
                    let bncArgItems = this.bouncerservArgContextItems(inputText);
                    if (nsArgItems.length > 0) {
                        // Completing a NickServ argument, not the subcommand
                        items = nsArgItems;
                    } else if (csArgItems.length > 0) {
                        // Completing a ChanServ argument, not the subcommand
                        items = csArgItems;
                    } else if (hsArgItems.length > 0) {
                        // Completing a HostServ argument, not the subcommand
                        items = hsArgItems;
                    } else if (histArgItems.length > 0) {
                        // Completing a HistServ argument, not the subcommand
                        items = histArgItems;
                    } else if (bncArgItems.length > 0) {
                        // Completing a BouncerServ argument, not the subcommand
                        items = bncArgItems;
                    } else {
                        items = this.buildAutoCompleteItems({
                            users: true,
                            buffers: true,
                        });
                    }
                }

                this.openAutoComplete(items);
                this.autocomplete_filter = currentToken;

                // Keep filtering enabled so typing refines the list; Tab accepts
                // the highlighted suggestion and the arrow keys navigate.
                this.autocomplete_filtering = true;
                event.preventDefault();
            } else if (meta && event.key === 'k') {
                // meta + k
                this.toggleInputTool(ToolTextStyle);
                event.preventDefault();
            } else if (meta && event.key === 'b') {
                // meta + b
                this.toggleBold();
                event.preventDefault();
            } else if (meta && event.key === 'i') {
                // meta + i
                this.toggleItalic();
                event.preventDefault();
            } else if (meta && event.key === 'u') {
                // meta + u
                this.toggleUnderline();
                event.preventDefault();
            } else if (meta && event.key === 'e') {
                // meta + e
                this.toggleStrikethrough();
                event.preventDefault();
            } else if (meta && event.key === 'q') {
                // meta + q
                this.toggleMonospace();
                event.preventDefault();
            }
        },
        inputKeyUp(event) {
            let inputVal = this.$refs.input.getRawText();

            if (this.autocomplete_remote && this.autocomplete_remote_context) {
                const context = this.autocomplete_remote_context;
                if (!inputVal.startsWith(context.prefix) ||
                    inputVal.slice(context.prefix.length) !== context.text
                ) {
                    this.clearAutocompletePending();
                    this.autocomplete_open = false;
                    this.autocomplete_remote = false;
                    this.autocomplete_remote_context = null;
                }
            }

            let currentWord = this.$refs.input.getCurrentWord();
            let currentToken = currentWord.word.substr(0, currentWord.position);
            let autocompleteTokens = this.$state.setting('autocompleteTokens');
            let nsArgItems = this.nsArgContextItems(inputVal);
            let csArgItems = this.csArgContextItems(inputVal);
            let hsArgItems = this.hsArgContextItems(inputVal);
            let histArgItems = this.histArgContextItems(inputVal);
            let bncArgItems = this.bouncerservArgContextItems(inputVal);
            let providerResult = this.providerAutocompleteResult(
                inputVal,
                currentToken
            );
            let emojiToken = this.emojiAutocompleteToken(currentToken);
            let emojiItems = emojiToken ?
                Emoji.getEmojiAutocompleteItems(emojiToken, this.buffer) :
                [];

            if (event.key === 'Escape' && this.autocomplete_open) {
                this.onAutocompleteCancel();
            } else if (
                this.autocomplete_open &&
                !this.autocomplete_remote &&
                currentToken === '' &&
                !this.shouldCompleteNickserv(inputVal) &&
                !this.shouldCompleteChanserv(inputVal) &&
                !this.shouldCompleteHostserv(inputVal) &&
                !this.shouldCompleteHistserv(inputVal) &&
                !this.shouldCompleteBouncerserv(inputVal) &&
                nsArgItems.length === 0 &&
                csArgItems.length === 0 &&
                hsArgItems.length === 0 &&
                histArgItems.length === 0 &&
                bncArgItems.length === 0 &&
                (!providerResult || providerResult.items.length === 0)
            ) {
                // Empty token closes the list, unless a service completion
                // still wants it open (subcommand or argument suggestions).
                // Without this exemption, arrow-key navigation with an empty
                // token (eg. '/ns GET ') closes the list on keyup and the
                // next arrow falls through to message history instead.
                this.autocomplete_open = false;
            } else if (this.autocomplete_open) {
                if (!this.autocomplete_remote && emojiToken) {
                    if (emojiItems.length) {
                        this.autocomplete_items = emojiItems;
                        this.autocomplete_filtering = true;
                    } else {
                        this.autocomplete_open = false;
                    }
                } else if (!this.autocomplete_remote && this.isEmojiAutocomplete()) {
                    this.autocomplete_open = false;
                } else if (!this.autocomplete_remote &&
                    providerResult &&
                    providerResult.items.length === 0
                ) {
                    this.autocomplete_open = false;
                } else if (currentToken[0] === '@') {
                    // @ is a shortcut to open the nicklist autocomplete. It's not part
                    // of the nick so strip it out before passing currentToken to the
                    // filter.
                    currentToken = currentToken.substr(1);
                }
            } else if (currentToken === '@' && autocompleteTokens.includes('@')) {
                // Just typed @ so start the nick auto completion
                this.openAutoComplete(this.buildAutoCompleteItems({ users: true }));
                this.autocomplete_filtering = true;
            } else if (inputVal === '/' && autocompleteTokens.includes('/')) {
                // Just typed / so start the command auto completion
                this.openAutoComplete(this.buildAutoCompleteItems({ commands: true }));
                this.autocomplete_filtering = true;
            } else if (currentToken === '#' && autocompleteTokens.includes('#')) {
                // Just typed # so start the command auto completion
                this.openAutoComplete(this.buildAutoCompleteItems({ buffers: true }));
                this.autocomplete_filtering = true;
            } else if (providerResult && providerResult.items.length > 0) {
                this.openProviderAutocomplete(providerResult, currentToken);
            } else if (this.shouldCompleteNickserv(inputVal)) {
                this.openAutoComplete(this.buildAutoCompleteItems({ nickserv: true }));
                this.autocomplete_filtering = true;
            } else if (this.shouldCompleteChanserv(inputVal)) {
                this.openAutoComplete(this.buildAutoCompleteItems({ chanserv: true }));
                this.autocomplete_filtering = true;
            } else if (this.shouldCompleteHostserv(inputVal)) {
                this.openAutoComplete(this.buildAutoCompleteItems({ hostserv: true }));
                this.autocomplete_filtering = true;
            } else if (this.shouldCompleteHistserv(inputVal)) {
                this.openAutoComplete(this.buildAutoCompleteItems({ histserv: true }));
                this.autocomplete_filtering = true;
            } else if (this.shouldCompleteBouncerserv(inputVal)) {
                this.openAutoComplete(this.buildAutoCompleteItems({ bouncerserv: true }));
                this.autocomplete_filtering = true;
            } else if (nsArgItems.length > 0) {
                // Completing a NickServ argument: suggest argument values
                // instead of subcommand names
                this.openAutoComplete(nsArgItems);
                this.autocomplete_filtering = true;
            } else if (csArgItems.length > 0) {
                // Completing a ChanServ argument: suggest argument values
                // instead of subcommand names
                this.openAutoComplete(csArgItems);
                this.autocomplete_filtering = true;
            } else if (hsArgItems.length > 0) {
                // Completing a HostServ argument: suggest argument values
                // instead of subcommand names
                this.openAutoComplete(hsArgItems);
                this.autocomplete_filtering = true;
            } else if (histArgItems.length > 0) {
                // Completing a HistServ argument: suggest argument values
                // instead of subcommand names
                this.openAutoComplete(histArgItems);
                this.autocomplete_filtering = true;
            } else if (bncArgItems.length > 0) {
                // Completing a BouncerServ argument: suggest subcommands
                this.openAutoComplete(bncArgItems);
                this.autocomplete_filtering = true;
            } else if (emojiToken && emojiItems.length > 0) {
                this.openAutoComplete(emojiItems);
                this.autocomplete_filtering = true;
            } else if (
                event.key === 'Tab'
                && !event.shiftKey
                && !event.altKey
                && !event.metaKey
                && !event.ctrlKey
            ) {
                // Tab and no other keys as tab+other is often a keyboard shortcut
                event.preventDefault();
            } else if (!event.key.match(/^(Shift|Control|Alt|Enter)/)) {
                if (inputVal[0] === '/') {
                    // Don't send typing status for commands
                    return;
                }

                if (inputVal.trim()) {
                    this.startTyping();
                } else {
                    this.stopTyping(true);
                }
            }

            if (this.autocomplete_open &&
                this.autocomplete_filtering &&
                !this.autocomplete_remote
            ) {
                this.autocomplete_filter = emojiToken || currentToken;
            }
        },
        submitForm(force = false) {
            let rawInput = this.$refs.input.getValue();
            if (!rawInput) {
                if (!this.has_focus && this.keep_focus) {
                    // Maybe triggered by the send button on empty input,
                    // put focus back into the input
                    this.$refs.input.focus();
                }
                return;
            }

            let ircText = this.$refs.input.buildIrcText();

            // Show a warning if a command is preceded by spaces
            let warnExpectedCommand = this.$state.setting('buffers.warn_expected_command');
            if (!force && warnExpectedCommand && !this.showCommandWarning) {
                const spacePrecededCommand = /^\s+\//;
                const hasPrecedingSpace = ircText.split('\n').some(
                    (line) => spacePrecededCommand.test(Misc.stripStyles(line))
                );

                if (hasPrecedingSpace) {
                    this.showCommandWarning = true;
                    return;
                }
            }

            if (this.$state.setting('buffers.emoji_convert_as_typed') && (!this.network || this.network.isUtf8)) {
                ircText = Emoji.replaceShortcodes(ircText, this.buffer);
            }

            this.$state.$emit('input.raw', ircText);

            this.historyAdd(rawInput);

            this.showCommandWarning = false;
            this.$refs.input.reset('', this.keep_focus);

            this.stopTyping(false);
        },
        sendCommandWarning() {
            this.submitForm(true);
        },
        dismissCommandWarning() {
            this.showCommandWarning = false;
            this.$nextTick(() => {
                if (this.$refs.input) {
                    this.$refs.input.focus();
                }
            });
        },
        historyAdd(rawInput) {
            // Add to history, keeping the history trimmed to the last 50 entries
            this.history.push(rawInput);
            this.history.splice(0, this.history.length - 50);
            this.history_pos = this.history.length;
        },
        historyBack() {
            let rawText = this.$refs.input.getRawText();
            let rawInput = this.$refs.input.getValue();
            if (rawText.trim() && this.history_pos === this.history.length) {
                this.historyAdd(rawInput);
                this.history_pos--;
            }
            if (this.history_pos > 0) {
                this.history_pos--;
            }
        },
        historyForward() {
            // Purposely let history_pos go 1 index beyond the history length
            // so that we can detect if we're not currently using a history value
            if (this.history_pos < this.history.length) {
                this.history_pos++;
            }
        },
        focusChanged(event) {
            this.has_focus = event.type === 'focus';

            // iOS does not populate relatedTarget when the relatedTarget is the send button
            // leaving it impossible to detect if returning focus is required
            if (
                event.type === 'blur' &&
                event.relatedTarget &&
                event.relatedTarget === this.$refs.sendButton
            ) {
                // new target is the send button, keep focus on reset
                return;
            }
            this.keep_focus = event.type === 'focus';
        },
        openAutoComplete(items) {
            if (this.$state.setting('showAutocomplete')) {
                this.autocomplete_items = items;
                this.autocomplete_remote = false;
                this.autocomplete_open = true;
            }
        },
        maybeReplaceEmoji() {
            if (this.$state.setting('buffers.emoji_convert_as_typed') && (!this.network || this.network.isUtf8)) {
                let currentWord = this.$refs.input.getCurrentWord(true);
                let emojis = EmojiProvider.getEmojis(currentWord.word, this.buffer);
                if (emojis.length && emojis[0].char) {
                    const emoji = emojis[0];
                    const replacement = currentWord.word.substr(0, emoji.index) +
                        emoji.char +
                        currentWord.word.substr(emoji.index + emoji.match.length);
                    this.$refs.input.setCurrentWord(replacement, false, true);
                }
            }
        },
        shouldCompleteEmoji(currentToken) {
            return !!trailingEmojiToken(currentToken);
        },
        emojiAutocompleteToken(currentToken) {
            return trailingEmojiToken(currentToken);
        },
        isEmojiAutocomplete() {
            return this.autocomplete_items.some((item) => item.type === 'emoji');
        },
        shouldCompleteNickserv(inputVal) {
            if (!inputVal || !this.network || !this.network.isErgo) {
                return false;
            }
            if (typeof this.network.isErgo !== 'function' || !this.network.isErgo()) {
                return false;
            }
            // Subcommand suggestions only while typing the subcommand itself;
            // once arguments start, completion gets out of the way.
            return isNickservSubcommandPosition(inputVal);
        },
        shouldCompleteChanserv(inputVal) {
            if (!inputVal || !this.network || !this.network.isErgo) {
                return false;
            }
            if (typeof this.network.isErgo !== 'function' || !this.network.isErgo()) {
                return false;
            }
            return isChanservSubcommandPosition(inputVal);
        },
        shouldCompleteHistserv(inputVal) {
            if (!inputVal || !this.network || !this.network.isErgo) {
                return false;
            }
            if (typeof this.network.isErgo !== 'function' || !this.network.isErgo()) {
                return false;
            }
            return isHistservSubcommandPosition(inputVal);
        },
        shouldCompleteHostserv(inputVal) {
            if (!inputVal || !this.network || !this.network.isErgo) {
                return false;
            }
            if (typeof this.network.isErgo !== 'function' || !this.network.isErgo()) {
                return false;
            }
            return isHostservSubcommandPosition(inputVal);
        },
        shouldCompleteBouncerserv(inputVal) {
            if (!inputVal || !this.network || !this.network.isSoju) {
                return false;
            }
            if (typeof this.network.isSoju !== 'function' || !this.network.isSoju()) {
                return false;
            }
            return isBouncerservSubcommandPosition(inputVal);
        },
        nsArgContextItems(inputVal) {
            if (!this.network || typeof this.network.isErgo !== 'function' || !this.network.isErgo()) {
                return [];
            }
            let parsed = parseNickservInput(inputVal);
            if (!parsed) {
                return [];
            }
            // Argument suggestions follow the same visibility rules as the
            // top-level list: gated commands offer nothing when logged out
            // or non-oper. The syntax ghost still shows as reference.
            let firstFlags = NICKSERV_FLAGS[parsed.path[0]];
            if (firstFlags) {
                if (firstFlags.auth && !this.network.currentAccount()) {
                    return [];
                }
                if (firstFlags.capabs && !this.network.is_oper) {
                    return [];
                }
            }
            let ghost = nickservSyntaxFor(parsed.path);
            let knownNicks = Object.values(this.buffer.users).map((user) => user.nick);
            let accounts = {};
            Object.values(this.network.users).forEach((user) => {
                if (user.account) {
                    accounts[user.account] = true;
                }
            });
            let suggestions = nickservArgSuggestions(parsed, {
                oper: !!this.network.is_oper,
                selfNick: this.network.nick,
                selfAccount: this.network.currentAccount(),
                knownNicks: knownNicks,
                knownAccounts: Object.keys(accounts).sort(Misc.strCompare),
            });
            return suggestions.map((text) => ({
                text: text,
                description: ghost,
                type: 'command',
            }));
        },
        csArgContextItems(inputVal) {
            if (!this.network || typeof this.network.isErgo !== 'function' || !this.network.isErgo()) {
                return [];
            }
            let parsed = parseChanservInput(inputVal);
            if (!parsed) {
                return [];
            }
            // Argument suggestions follow the same visibility rules as the
            // top-level list: gated commands offer nothing when logged out
            // or non-oper. The syntax ghost still shows as reference.
            let firstFlags = CHANSERV_FLAGS[parsed.path[0]];
            if (firstFlags) {
                if (firstFlags.auth && !this.network.currentAccount()) {
                    return [];
                }
                if (firstFlags.capabs && !this.network.is_oper) {
                    return [];
                }
            }
            let ghost = chanservSyntaxFor(parsed.path);
            let selfNick = this.network.nick;
            let channels = { ops: [], founder: [], known: [], notFounder: [] };
            let channelUsers = {};
            let channelAccounts = {};
            let selfUser = this.$state.getUser(this.network.id, selfNick);
            this.network.buffers.forEach((buffer) => {
                if (!buffer.isChannel()) {
                    return;
                }
                channels.known.push(buffer.name);
                let userModes = [];
                let info = selfUser && selfUser.buffers[buffer.id];
                if (info && info.modes) {
                    userModes = info.modes.map((mode) => String(mode).toLowerCase());
                }
                // Founder is approximated by the owner (+q) mode, the closest
                // client-visible signal of channel ownership on Ergo.
                if (buffer.isUserAnOp(selfNick)) {
                    channels.ops.push(buffer.name);
                }
                if (userModes.indexOf('q') !== -1) {
                    channels.founder.push(buffer.name);
                } else {
                    channels.notFounder.push(buffer.name);
                }
                let channelNicks = Object.values(buffer.users).map((user) => user.nick);
                channelUsers[buffer.name.toLowerCase()] = channelNicks;
                let accounts = {};
                Object.values(buffer.users).forEach((user) => {
                    if (user.account) {
                        accounts[user.account] = true;
                    }
                });
                let channelAccountNames = Object.keys(accounts).sort(Misc.strCompare);
                channelAccounts[buffer.name.toLowerCase()] = channelAccountNames;
            });
            let suggestions = chanservArgSuggestions(parsed, {
                channels: channels,
                channelUsers: channelUsers,
                channelAccounts: channelAccounts,
            });
            return suggestions.map((text) => ({
                text: text,
                description: ghost,
                type: 'command',
            }));
        },
        hsArgContextItems(inputVal) {
            if (!this.network || typeof this.network.isErgo !== 'function' || !this.network.isErgo()) {
                return [];
            }
            let parsed = parseHostservInput(inputVal);
            if (!parsed) {
                return [];
            }
            // Argument suggestions follow the same visibility rules as the
            // top-level list: gated commands offer nothing when logged out
            // or non-oper. The syntax ghost still shows as reference.
            let firstFlags = HOSTSERV_FLAGS[parsed.path[0]];
            if (firstFlags) {
                if (firstFlags.auth && !this.network.currentAccount()) {
                    return [];
                }
                if (firstFlags.capabs && !this.network.is_oper) {
                    return [];
                }
            }
            let ghost = hostservSyntaxFor(parsed.path);
            let accounts = {};
            Object.values(this.network.users).forEach((user) => {
                if (user.account) {
                    accounts[user.account] = true;
                }
            });
            let suggestions = hostservArgSuggestions(parsed, {
                oper: !!this.network.is_oper,
                selfAccount: this.network.currentAccount(),
                knownAccounts: Object.keys(accounts).sort(Misc.strCompare),
            });
            return suggestions.map((text) => ({
                text: text,
                description: ghost,
                type: 'command',
            }));
        },
        histArgContextItems(inputVal) {
            if (!this.network || typeof this.network.isErgo !== 'function' || !this.network.isErgo()) {
                return [];
            }
            let parsed = parseHistservInput(inputVal);
            if (!parsed) {
                return [];
            }
            // Argument suggestions follow the same visibility rules as the
            // top-level list: gated commands offer nothing when logged out
            // or non-oper. The syntax ghost still shows as reference.
            let firstFlags = HISTSERV_FLAGS[parsed.path[0]];
            if (firstFlags) {
                if (firstFlags.auth && !this.network.currentAccount()) {
                    return [];
                }
                if (firstFlags.capabs && !this.network.is_oper) {
                    return [];
                }
            }
            let ghost = histservSyntaxFor(parsed.path);
            let accounts = {};
            Object.values(this.network.users).forEach((user) => {
                if (user.account) {
                    accounts[user.account] = true;
                }
            });
            let targets = [];
            this.network.buffers.forEach((buffer) => {
                if (buffer.isChannel() || buffer.isQuery()) {
                    targets.push(buffer.name);
                }
            });
            let suggestions = histservArgSuggestions(parsed, {
                knownAccounts: Object.keys(accounts).sort(Misc.strCompare),
                knownTargets: targets,
            });
            return suggestions.map((text) => ({
                text: text,
                description: ghost,
                type: 'command',
            }));
        },
        bouncerservArgContextItems(inputVal) {
            if (!this.network || typeof this.network.isSoju !== 'function' || !this.network.isSoju()) {
                return [];
            }
            let parsed = parseBouncerservInput(inputVal);
            if (!parsed) {
                return [];
            }
            let ghost = bouncerservSyntaxFor(parsed.path);
            let suggestions = bouncerservArgSuggestions(parsed);
            return suggestions.map((text) => ({
                text: text,
                description: ghost,
                type: 'command',
            }));
        },
        serviceArgGhost() {
            if (!this.network) {
                return '';
            }
            let isErgo = typeof this.network.isErgo === 'function' && this.network.isErgo();
            let isSoju = typeof this.network.isSoju === 'function' && this.network.isSoju();
            if (!isErgo && !isSoju) {
                return '';
            }
            if (!this.$refs.input) {
                return '';
            }
            // Read the reactive input mirror so the hint recomputes on every
            // keystroke. The mirror holds raw HTML, where a trailing space
            // becomes &nbsp; or vanishes, so parse the plain-text rendering
            // instead (the same source the completion branches use).
            let mirror = this.current_input_value;
            if (typeof mirror !== 'string' || mirror.length === 0) {
                return '';
            }
            let plainText = this.$refs.input.getRawText();
            if (isErgo) {
                let parsed = parseNickservInput(plainText);
                if (parsed) {
                    return nickservSyntaxFor(parsed.path);
                }
                parsed = parseChanservInput(plainText);
                if (parsed) {
                    return chanservSyntaxFor(parsed.path);
                }
                parsed = parseHostservInput(plainText);
                if (parsed) {
                    return hostservSyntaxFor(parsed.path);
                }
                parsed = parseHistservInput(plainText);
                if (parsed) {
                    return histservSyntaxFor(parsed.path);
                }
            }
            if (isSoju) {
                let parsed = parseBouncerservInput(plainText);
                if (parsed) {
                    return bouncerservSyntaxFor(parsed.path);
                }
            }
            return '';
        },
        userAutocompleteItem(user) {
            const nick = user.nick;
            const display = user.metadata && user.metadata['display-name'];
            const displayName = display && !this.network.caseCompare(display, nick) ?
                display :
                '';

            return {
                text: nick,
                type: 'user',
                displayName,
                alias: displayName ? [displayName] : [],
            };
        },
        buildAutoCompleteItems(_opts) {
            let opts = _opts || {};
            let list = [];

            if (opts.users) {
                const users = new Map();
                const addUser = (user) => {
                    if (!user || !user.nick) {
                        return;
                    }
                    const key = this.network.caseUpper(user.nick);
                    if (!users.has(key)) {
                        users.set(key, user);
                    }
                };

                Object.values(this.buffer.users).forEach(addUser);
                Object.values(this.buffer.relayNicks || {}).forEach((nick) => {
                    addUser(this.network.users[this.network.caseUpper(nick)]);
                });

                const userList = Array.from(users.values()).map((user) => (
                    this.userAutocompleteItem(user)
                ));

                if (this.buffer.isQuery()) {
                    const queryNick = this.buffer.name;
                    const queryUser = this.network.users[this.network.caseUpper(queryNick)];
                    if (queryUser) {
                        userList.push(this.userAutocompleteItem(queryUser));
                    } else {
                        userList.push({
                            text: queryNick,
                            type: 'user',
                            displayName: '',
                            alias: [],
                        });
                    }
                }

                list = list.concat(userList);
            }

            if (opts.buffers) {
                let bufferList = [];
                this.network.buffers.forEach((buffer) => {
                    if (buffer.isChannel()) {
                        bufferList.push({
                            text: buffer.name,
                            type: 'buffer',
                        });
                    }
                });

                list = list.concat(bufferList);
            }

            if (opts.commands) {
                let commandList = [];
                autocompleteCommands.forEach((command) => {
                    // allow descriptions to be translation keys or static strings
                    let desc = command.description.indexOf('locale_id_') === 0 ?
                        TextFormatting.t(command.description.substr(10)) :
                        command.description;
                    commandList.push({
                        text: '/' + command.command,
                        description: desc,
                        type: 'command',
                        // Each alias needs the / command prefix adding
                        alias: (command.alias || []).map((c) => '/' + c),
                    });
                });

                list = list.concat(commandList);
            }

            if (opts.nickserv) {
                let oper = !!(this.network && this.network.is_oper);
                let authenticated = !!(this.network && this.network.currentAccount());
                let cmds = nickservSubcommands({ oper: oper, authenticated: authenticated });
                let nsList = cmds.map((cmd) => {
                    let desc = NICKSERV_SYNTAX[cmd] || (cmd + ' ...');
                    return {
                        text: cmd,
                        description: desc,
                        type: 'command',
                        badge: nickservBadge(cmd),
                    };
                });
                list = list.concat(nsList);
            }

            if (opts.chanserv) {
                let oper = !!(this.network && this.network.is_oper);
                let authenticated = !!(this.network && this.network.currentAccount());
                let cmds = chanservSubcommands({ oper: oper, authenticated: authenticated });
                let csList = cmds.map((cmd) => {
                    let desc = CHANSERV_SYNTAX[cmd] || (cmd + ' ...');
                    return {
                        text: cmd,
                        description: desc,
                        type: 'command',
                        badge: chanservBadge(cmd),
                    };
                });
                list = list.concat(csList);
            }

            if (opts.hostserv) {
                let oper = !!(this.network && this.network.is_oper);
                let authenticated = !!(this.network && this.network.currentAccount());
                let cmds = hostservSubcommands({ oper: oper, authenticated: authenticated });
                let hsList = cmds.map((cmd) => {
                    let desc = HOSTSERV_SYNTAX[cmd] || (cmd + ' ...');
                    return {
                        text: cmd,
                        description: desc,
                        type: 'command',
                        badge: hostservBadge(cmd),
                    };
                });
                list = list.concat(hsList);
            }

            if (opts.histserv) {
                let oper = !!(this.network && this.network.is_oper);
                let authenticated = !!(this.network && this.network.currentAccount());
                let cmds = histservSubcommands({ oper: oper, authenticated: authenticated });
                let hisList = cmds.map((cmd) => {
                    let desc = HISTSERV_SYNTAX[cmd] || (cmd + ' ...');
                    return {
                        text: cmd,
                        description: desc,
                        type: 'command',
                        badge: histservBadge(cmd),
                    };
                });
                list = list.concat(hisList);
            }

            if (opts.bouncerserv) {
                let bncList = BOUNCERSERV_SUBCOMMANDS.map((cmd) => ({
                    text: cmd,
                    description: BOUNCERSERV_SYNTAX[cmd] || (cmd + ' ...'),
                    type: 'command',
                }));
                list = list.concat(bncList);
            }

            if (opts.settings) {
                let out = {};
                let base = [];
                settingTools.buildTree(out, base, this.$state.getSetting('settings'), false);
                settingTools.buildTree(out, base, this.$state.getSetting('user_settings'), true);

                let settingList = [];
                Object.keys(out).forEach((setting) => {
                    settingList.push({
                        text: setting,
                        type: 'setting',
                    });
                });

                list = list.concat(settingList);
            }

            return list;
        },
        startTyping() {
            if (!this.network || !this.network.hasCap('message-tags')) {
                return;
            }
            if (!this.buffer || !this.buffer.shouldShareTyping()) {
                return;
            }

            if (this.typingTimer) {
                clearTimeout(this.typingTimer);
                this.typingTimer = null;
            }
            this.typingTimer = setTimeout(() => this.stopTyping(true), 3000);

            if (Date.now() < this.lastTypingTime + 3000) {
                return;
            }

            this.network.ircClient.typing.start(this.buffer.name);

            this.lastTypingTime = Date.now();
        },
        stopTyping(sendStop) {
            if (!this.network || !this.network.hasCap('message-tags')) {
                return;
            }
            if (!this.buffer || !this.buffer.shouldShareTyping()) {
                return;
            }

            if (this.typingTimer) {
                clearTimeout(this.typingTimer);
                this.typingTimer = null;
                this.lastTypingTime = 0;
            }

            this.$refs.input.getRawText().trim() ?
                this.network.ircClient.typing.pause(this.buffer.name) :
                this.network.ircClient.typing.stop(this.buffer.name, sendStop);
        },
    },
};
</script>

<style lang="less">

.kiwi-controlinput {
    z-index: 2;
    position: relative;
    border-top: 1px solid;
    max-height: 40%;
}

.kiwi-controlinput--autocomplete-always {
    border-top-color: var(--brand-primary);
    box-shadow: inset 0 2px 0 var(--brand-primary);
}

.kiwi-controlinput,
.kiwi-controlinput-inner {
    padding: 0;
    box-sizing: border-box;
    transition: width 0.2s;
    transition-delay: 0.2s;
}

.kiwi-controlinput-inner {
    display: flex;
    position: relative;
    height: 100%;

    .kiwi-awaystatusindicator {
        margin-top: 14px;
        margin-left: 10px;
        margin-right: -2px;
    }
}

.kiwi-controlinput-user {
    height: 100%;
    padding-left: 10px;
    font-weight: bold;
    text-align: center;
    cursor: pointer;
    line-height: 38px;
    transition: width 0.2s 0.1s;
    user-select: none;

    > i {
        font-size: 120%;
        margin-left: 8px;
    }
}

.kiwi-controlinput--selfuser-open {
    .kiwi-controlinput-inner > .kiwi-awaystatusindicator {
        visibility: hidden;
    }

    .kiwi-controlinput-user {
        width: 296px;
        visibility: hidden;
    }

    .kiwi-controlinput-selfuser {
        width: 324px;
        max-height: 300px;
        opacity: 1;
    }
}

.kiwi-controlinput-form {
    flex: 1;
    overflow: hidden;
    display: flex;
    box-sizing: border-box;
}

.kiwi-controlinput-command-warn {
    position: absolute;
    right: 10px;
    bottom: 100%;
    left: 10px;
    box-sizing: border-box;
    padding: 8px 10px;
    border: 1px solid;
    border-radius: 10px 10px 0 0;
    z-index: 1;

    .kiwi-controlinput-command-text {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        line-height: 1.4;
    }

    .kiwi-controlinput-command-text strong {
        display: block;
        margin-bottom: 2px;
    }

    .bx-error {
        margin-top: 2px;
    }

    .u-input-confirm {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 8px 0 0;
    }

    .u-input-confirm .u-button {
        margin: 0;
    }
}

.kiwi-controlinput-input {
    text-align: left;
    height: 100%;
    outline: none;
    border: none;
}

.kiwi-controlinput-input-wrap {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
    margin: 0 10px;
}

.kiwi-controlinput-reply {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    padding: 5px 10px;
    border-top: 1px solid var(--comp-border);
    border-bottom: 1px solid var(--comp-border);
    z-index: 10;
    font-size: 0.9em;
    background-color: var(--brand-default-bg);
    color: var(--brand-default-fg);
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);

    .kiwi-controlinput-reply-nick {
        font-weight: bold;
        margin-right: 10px;
        white-space: nowrap;
    }

    .kiwi-controlinput-reply-message {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.8;
    }

    .kiwi-controlinput-reply-cancel {
        margin-left: 10px;
        cursor: pointer;
        padding: 5px;
        opacity: 0.6;

        &:hover {
            opacity: 1;
        }
    }
}

.kiwi-controlinput-ns-hint {
    font-family: monospace;
    font-size: 0.85em;
    opacity: 0.7;
    padding: 2px 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.kiwi-controlinput-autocomplete-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    color: var(--brand-primary);
    font-size: 0.85em;
}

.kiwi-controlinput-active-tool {
    position: absolute;
    bottom: calc(100% + 1px);
    right: 74px;
    left: 0;
    z-index: 1;
}

.kiwi-controlinput-selfuser {
    position: absolute;
    bottom: 0;
    z-index: 10;
    left: 0;
    max-height: 0;
    width: 324px;
    box-sizing: border-box;
    border-radius: 0 6px 0 0;
    opacity: 0;
    border-top: 1px solid;
    border-right: 1px solid;
    overflow: hidden;
}

.kiwi-selfuser-trans-enter,
.kiwi-selfuser-trans-leave-to {
    opacity: 0;
    height: 0;
}

.kiwi-selfuser-trans-enter-to,
.kiwi-selfuser-trans-leave {
    opacity: 1;
}

.kiwi-selfuser-trans-enter-active,
.kiwi-selfuser-trans-leave-active {
    transition: all 0.4s;
}

.kiwi-controlinput-tools {
    border-radius: 8px;
    padding: 1px;
    height: 36px;
}

.kiwi-controlinput-tools-expand > i {
    transition: transform 0.2s;
}

.kiwi-controlinput-tools-expand--closed > i {
    transform: rotateZ(180deg);
}

.kiwi-controlinput-send {
    padding: 1px 6px;
}

.kiwi-controlinput--show-send.kiwi-controlinput--show-tools {
    // The send button and tools are visible, merge their borders
    .kiwi-controlinput-tools-wrapper {
        border-radius: 0 8px 8px 0;
        padding: 1px 1px 1px 0;
    }

    .kiwi-controlinput-send-container {
        border-radius: 8px 0 0 8px;
        padding: 1px 0 1px 1px;
    }
}

.kiwi-controlinput-tools-container {
    display: flex;
    flex-wrap: wrap-reverse;
    flex-direction: row-reverse;
    padding: 1px;
    border-radius: 8px;
    position: absolute;
    bottom: calc(100% + 1px);
    top: auto;
    right: 0;
    width: 72px;
}

.kiwi-controlinput--show-tools--inline {
    .kiwi-controlinput-tools-container {
        flex-direction: row;
        position: relative;
        width: auto;
        top: 0;
        padding: 0;
    }

    .kiwi-controlinput-active-tool {
        right: 0;
    }
}

.kiwi-controlinput-fileupload {
    display: none;
}

.kiwi-controlinput-button--busy {
    opacity: 0.45;
    cursor: wait;
}

.kiwi-controlinput-button {
    display: inline-block;
    width: 34px;
    height: 34px;
    margin: 1px;
    text-align: center;
    border-radius: 8px;
    box-sizing: border-box;
    cursor: pointer;
    user-select: none;

    i {
        font-size: 20px;
        line-height: 32px;
        margin: 0;
    }
}

.kiwi-plugin-ui-trans-enter,
.kiwi-plugin-ui-trans-leave-to {
    right: -100%;
}

.kiwi-plugin-ui-trans-enter-to,
.kiwi-plugin-ui-trans-leave {
    right: 0;
}

.kiwi-plugin-ui-trans-enter-active,
.kiwi-plugin-ui-trans-leave-active {
    transition: right 0.2s;
}

@media screen and (max-width: 500px) {
    .kiwi-controlinput-user-nick {
        display: none;
    }

    .kiwi-controlinput-user > i {
        margin-left: 0;
    }
}

@media screen and (max-width: 769px) {
    .kiwi-controlinput--selfuser-open .kiwi-controlinput-selfuser {
        width: 100%;
        border-radius: 0;
        border-right: 0;
    }

    .kiwi-wrap--statebrowser-drawopen .kiwi-controlinput {
        z-index: 0;
    }

    // hide the control input on narrow screens when the self user box is open
    .kiwi-controlinput--selfuser-open .kiwi-controlinput-inner {
        display: none;
    }

    .kiwi-controlinput-tools-container {
        width: 34px;
    }

    .kiwi-controlinput-active-tool {
        right: 36px;
    }
}
</style>
