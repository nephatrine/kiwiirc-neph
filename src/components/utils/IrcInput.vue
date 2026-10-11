<template>
    <div class="kiwi-ircinput">
        <div
            ref="editor"
            :placeholder="placeholder"
            class="kiwi-ircinput-editor"
            contenteditable="true"
            role="textbox"
            spellcheck="true"
            @keypress="updateValueProps(); $emit('keypress', $event)"
            @keydown="updateValueProps(); $emit('keydown', $event)"
            @keyup="updateValueProps(); $emit('keyup', $event)"
            @textInput="updateValueProps(); onTextInput($event); $emit('textInput', $event)"
            @mouseup="updateValueProps();"
            @click="$emit('click', $event)"
            @paste="onPaste"
            @drop="onDrop"
            @focus="onFocus"
            @blur="$emit('blur', $event)"
        />
    </div>
</template>

<script>
'kiwi public';

import _ from 'lodash';
import Vue from 'vue';
import * as htmlparser from 'htmlparser2';
import * as Colours from '@/helpers/Colours';
import * as Misc from '@/helpers/Misc';
import * as EmojiProvider from '@/libs/EmojiProvider';

export default Vue.component('irc-input', {
    props: ['placeholder'],
    data() {
        return {
            last_known_value: '',
            text_value: '',
            current_anchor_node: null,
            current_anchor_offset: 0,
            current_focus_node: null,
            current_focus_offset: 0,
            is_applying_style: false,
            default_colour: null,
            default_bg_colour: null,
            code_map: Object.create(null),
        };
    },
    computed: {
        editor() {
            return this.$refs.editor;
        },
    },
    mounted() {
        this.resetStyles();
    },
    methods: {
        onTextInput(event) {
            // Mobile devices trigger a textInput event for things such as autocompletion
            // and suggested words. Unfortunately they end with a return character which
            // is not what we expect, so prevent the original event from inserting anything
            // and manually place it in with the current word.
            if (event.data[event.data.length - 1] === '\n') {
                event.preventDefault();
                this.setCurrentWord(event.data.trim());
            }
        },
        onPaste(event) {
            event.preventDefault();
            if (typeof event.clipboardData !== 'undefined') {
                let ignoreThisPaste = false;
                let clpData = event.clipboardData;
                clpData.types.forEach((type) => {
                    let ignoreTypes = ['Files', 'image'];
                    ignoreTypes.forEach((ig) => {
                        if (type.indexOf(ig) > -1) {
                            ignoreThisPaste = true;
                        }
                    });
                });

                if (ignoreThisPaste) {
                    return;
                }

                document.execCommand('insertText', false, clpData.getData('text/plain'));
            }

            setTimeout(() => {
                this.updateValueProps();
            }, 0);
        },
        onDrop(event) {
            // Allow dragging of single emoji's from the message list
            const raw = event.dataTransfer.getData('text/html');
            if (!raw) {
                return;
            }

            let html = document.createElement('div');
            html.innerHTML = raw;
            if (html.childNodes.length === 0 || html.childNodes.length > 1) {
                return;
            }

            let node = html.childNodes[0];
            if (node instanceof HTMLImageElement && node.classList.contains('kiwi-messagelist-emoji')) {
                event.preventDefault();
                let emojis = EmojiProvider.getEmojis(node.alt.trim());
                if (!emojis.length) {
                    return;
                }
                this.addImg(
                    emojis[0].ascii,
                    emojis[0].url,
                    emojis[0].imgProps,
                );
            }
        },
        onFocus(event) {
            // Chrome sometimes focus' the element but does not add the cursor
            // https://bugs.chromium.org/p/chromium/issues/detail?id=1125078
            this.focus();

            // when the input is empty there are no children to remember the current colour
            // so upon regaining focus we must set the current colour again
            if (!this.getRawText()) {
                if (this.default_colour) {
                    this.setStyles({
                        fg: this.default_colour.colour,
                        fg_code: this.default_colour.code,
                    });
                }
                if (this.default_bg_colour) {
                    this.setStyles({
                        bg: this.default_bg_colour.colour,
                        bg_code: this.default_bg_colour.code,
                    });
                }
            }

            this.$emit('focus', event);
        },
        updateSpacing() {
            let editor = this.$refs.editor;
            if (!editor) {
                return;
            }

            // This will make sure any image nodes are padded with spaces
            editor.childNodes.forEach((node) => {
                if (node.nodeName !== 'IMG') {
                    return;
                }

                node.alt = node.alt.trim();

                if (node.previousSibling) {
                    let text = node.previousSibling.textContent.replace(/\xA0/g, ' ');
                    let isEmpty = text.length === 0;
                    let isImg = node.previousSibling.nodeName === 'IMG';
                    let isText = ['#text', 'SPAN'].includes(node.previousSibling.nodeName);
                    if (isImg || (isText && (isEmpty || text[text.length - 1].indexOf(' ') === -1))) {
                        // The previous node is an image or text and does not end with a space
                        node.alt = ' ' + node.alt;
                    }
                }

                if (node.nextSibling) {
                    let text = node.nextSibling.textContent.replace(/\xA0/g, ' ');
                    let isNeeded = text.length !== 0 || !node.nextSibling.nextSibling;
                    let isText = ['#text', 'SPAN'].includes(node.nextSibling.nodeName);
                    if (isText && isNeeded && (text.length === 0 || text[0].indexOf(' ') === -1)) {
                        // The next node is text and does not start with a space
                        node.alt += ' ';
                    }
                }
            });
        },
        updateValueProps() {
            if (this.is_applying_style || !this.$el.contains(document.activeElement)) {
                // Focused element is not a child of IrcInput
                // selection would not be relevant
                return;
            }

            let selection = window.getSelection();

            if (selection.rangeCount === 0) {
                return;
            }

            this.current_anchor_node = selection.anchorNode;
            this.current_anchor_offset = selection.anchorOffset;
            this.current_focus_node = selection.focusNode;
            this.current_focus_offset = selection.focusOffset;

            this.maybeEmitInput();
        },
        selectionToStart() {
            // Move the caret to the start
            let el = this.$refs.editor.firstChild || this.$refs.editor;
            this.current_anchor_node = el;
            this.current_anchor_offset = 0;
            this.current_focus_node = el;
            this.current_focus_offset = 0;

            if (this.$el.contains(document.activeElement)) {
                // IrcInput has focus select all content and collapse to start
                let sel = window.getSelection();
                sel.collapse(el, 0);
                this.updateValueProps();
            }
        },
        selectionToEnd() {
            // Move the caret to the end
            let el = this.$refs.editor.lastChild || this.$refs.editor;
            this.current_anchor_node = el;
            this.current_focus_node = el;

            if (el.nodeType === 3) {
                this.current_anchor_offset = el.length;
                this.current_focus_offset = el.length;
            } else if (this.$el.contains(document.activeElement)) {
                // IrcInput has focus select all content and collapse to end
                document.execCommand('selectAll', false, null);
                document.getSelection().collapseToEnd();
                this.updateValueProps();
            } else {
                this.current_anchor_offset = 0;
                this.current_focus_offset = 0;
            }
        },
        setValue(newVal) {
            this.value = newVal;
            this.$refs.editor.innerHTML = newVal;
        },
        getValue() {
            return this.$refs.editor.innerHTML;
        },
        maybeEmitInput() {
            let currentHtml = this.$refs.editor.innerHTML;
            if (this.last_known_value !== currentHtml) {
                this.$emit('input', currentHtml);
                this.last_known_value = currentHtml;
            }
        },
        buildIrcText() {
            this.updateSpacing();
            let source = this.$refs.editor.innerHTML;
            let textValue = '';
            let pendingStyles = '';

            // Stack of style states for nested tags
            let styleStack = [{
                fg: '',
                bg: '',
                bold: false,
                italic: false,
                underline: false,
                strike: false,
                mono: false,
                fancy: false,
            }];

            const getActive = () => styleStack[styleStack.length - 1];

            const pad = (code) => {
                if (!code || code[0] === '#') return code;
                return code.length === 1 ? '0' + code : code;
            };

            const flushStyles = (nextText) => {
                if (!pendingStyles) return;

                // Check for \x03 followed by a digit or comma.
                // If it is, we must make the \x03 reset explicit (\x0399) to avoid
                // it being misparsed as a color code for the following text.
                if (nextText && pendingStyles.endsWith('\x03')) {
                    if ('0123456789,'.includes(nextText[0])) {
                        pendingStyles += '99';
                    }
                }

                textValue += pendingStyles;
                pendingStyles = '';
            };

            const extractIrcColor = (colorStr) => {
                if (!colorStr) return '';
                let cleanColor = this.normalizeColor(colorStr);
                let mappedCode = this.code_map[cleanColor];
                return mappedCode || cleanColor;
            };

            const parseStyle = (styleAttr) => {
                let styles = Object.create(null);
                if (!styleAttr) return styles;
                styleAttr.split(';').forEach((s) => {
                    let parts = s.split(':');
                    if (parts.length >= 2) {
                        styles[parts[0].trim().toLowerCase()] = parts.slice(1).join(':').trim();
                    }
                });
                return styles;
            };

            const emitStyleChanges = (next, current) => {
                let out = '';

                // Optimization: if we are moving to a completely plain state,
                // just use the global reset character.
                const isPlain = !next.fg && !next.bg && !next.bold && !next.italic &&
                    !next.underline && !next.strike && !next.mono && !next.fancy;

                if (isPlain && (current.fg || current.bg || current.bold || current.italic ||
                    current.underline || current.strike || current.mono || current.fancy)) {
                    return '\x0f';
                }

                // Handle Colors
                if (next.fg !== current.fg || next.bg !== current.bg) {
                    let isNextHex = (next.fg && next.fg[0] === '#') || (next.bg && next.bg[0] === '#');
                    if (isNextHex) {
                        // Protocol \x04 requires a foreground if background is present.
                        // We strictly only emit if a hex foreground is present.
                        if (next.fg && next.fg[0] === '#') {
                            let fgHex = next.fg.substr(1);
                            let bgHex = next.bg && next.bg[0] === '#' ?
                                next.bg.substr(1) :
                                '';

                            out += '\x04' + fgHex;
                            if (bgHex) {
                                out += ',' + bgHex;
                            }
                        } else if (!next.fg && !next.bg) {
                            // If both are cleared, emit hex reset
                            out += '\x04';
                        }
                    } else if (!next.fg && !next.bg) {
                        // Standard IRC color reset
                        out += '\x03';
                    } else {
                        // Standard IRC colors
                        out += '\x03' + (pad(next.fg) || '99');
                        if (next.bg || current.bg) {
                            out += ',' + (pad(next.bg) || '99');
                        }
                    }
                }

                if (next.bold !== current.bold) out += '\x02';
                if (next.italic !== current.italic) out += '\x1d';
                if (next.underline !== current.underline) out += '\x1f';
                if (next.strike !== current.strike) out += '\x1e';
                if (next.mono !== current.mono) out += '\x11';
                if (next.fancy !== current.fancy) out += '\x16';

                return out;
            };

            let parser = new htmlparser.Parser({
                onopentag: (name, attribs) => {
                    let current = getActive();
                    let next = Object.assign({}, current);

                    if (attribs.style) {
                        let styles = parseStyle(attribs.style);
                        if (styles.color) {
                            next.fg = extractIrcColor(styles.color);
                        }
                        if (styles['background-color']) {
                            next.bg = extractIrcColor(styles['background-color']);
                        }
                        if (attribs.style.indexOf('bold') > -1) {
                            next.bold = !next.bold;
                        }
                        if (attribs.style.indexOf('italic') > -1) {
                            next.italic = !next.italic;
                        }
                        if (attribs.style.indexOf('underline') > -1) {
                            next.underline = !next.underline;
                        }
                        if (attribs.style.indexOf('line-through') > -1) {
                            next.strike = !next.strike;
                        }
                        if (attribs.style.indexOf('monospace') > -1) {
                            next.mono = !next.mono;
                        }
                        if (attribs.style.indexOf('kiwi-reverse') > -1) {
                            next.fancy = !next.fancy;
                        }
                    }

                    if (name === 'strong' || name === 'b') next.bold = !next.bold;
                    if (name === 'em' || name === 'i') next.italic = !next.italic;
                    if (name === 'u') next.underline = !next.underline;
                    if (name === 'strike' || name === 's' || name === 'del') next.strike = !next.strike;
                    if (name === 'code' || name === 'tt' || name === 'kbd') next.mono = !next.mono;

                    if (name === 'div' || name === 'br') {
                        flushStyles('\n');
                        textValue += '\n';
                    } else if (name === 'img' && attribs.alt) {
                        flushStyles(attribs.alt);
                        textValue += attribs.alt;
                    } else {
                        pendingStyles += emitStyleChanges(next, current);
                        styleStack.push(next);
                    }
                },
                ontext: (text) => {
                    flushStyles(text);
                    textValue += text;
                },
                onclosetag: (name) => {
                    if (['div', 'br', 'img'].includes(name)) return;

                    let current = getActive();
                    styleStack.pop();
                    let next = getActive();

                    pendingStyles += emitStyleChanges(next, current);
                },
            }, {
                decodeEntities: true,
            });

            parser.write(source);
            parser.end();

            // Final reset of any lingering styles
            let currentState = getActive();
            let hasStyles = currentState.fg || currentState.bg || currentState.bold ||
                currentState.italic || currentState.underline || currentState.strike ||
                currentState.mono || currentState.fancy;

            if (hasStyles) {
                pendingStyles += '\x0f';
            }
            flushStyles();

            // Firefox likes to add <br/> at the end (some times inside the span)
            // fix by filtering out any lines that contain no content
            return textValue.split(/\r?\n/).filter((line) => !!Misc.stripStyles(line)).join('\n');
        },
        reset(rawHtml, shouldFocus) {
            this.$refs.editor.innerHTML = rawHtml || '';

            this.current_anchor_offset = 0;
            this.current_anchor_node = this.$refs.editor;
            this.current_focus_offset = 0;
            this.current_focus_node = this.$refs.editor;

            // Firefox inserts a <br> on empty contenteditables after it's been reset. But that
            // fucks up the placeholder :empty CSS selector we use. So just remove it.
            let br = this.$refs.editor.querySelector('br');
            if (br) {
                br.parentNode.removeChild(br);
            }

            if (shouldFocus) {
                this.focus();

                if (this.default_colour) {
                    this.setStyles({
                        fg: this.default_colour.colour,
                        fg_code: this.default_colour.code,
                    });
                }

                this.updateValueProps();
            } else {
                this.maybeEmitInput();
            }
        },
        resetStyles() {
            let selection = window.getSelection();
            let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            let hasSelection = range && !range.collapsed &&
                this.$refs.editor.contains(range.commonAncestorContainer);

            if (!hasSelection) {
                this.focus();
                document.execCommand('selectAll', false, null);
            }

            document.execCommand('styleWithCSS', false, true);
            document.execCommand('removeFormat', false, null);
            this.default_colour = null;
            this.default_bg_colour = null;
        },
        setColour(code, colour) {
            this.setIrcColor(code, colour);
        },
        setBackgroundColour(code, colour) {
            this.setIrcColor(undefined, undefined, code, colour);
        },
        setIrcColor(fgCode, fgVisual, bgCode, bgVisual) {
            this.is_applying_style = true;
            this.focus();

            document.execCommand('styleWithCSS', false, true);

            // If we are applying an IRC color, clear any HEX formatting first
            let styles = this.getSelectionStyles();
            let currentFgCode = this.code_map[this.normalizeColor(styles.fg)];
            let currentBgCode = this.code_map[this.normalizeColor(styles.bg)];

            let isCurrentFgHex = currentFgCode && currentFgCode[0] === '#';
            let isCurrentBgHex = currentBgCode && currentBgCode[0] === '#';

            if (isCurrentFgHex) {
                document.execCommand('foreColor', false, 'initial');
            }
            if (isCurrentBgHex) {
                document.execCommand('hiliteColor', false, 'transparent');
            }

            if (fgVisual) {
                document.execCommand('foreColor', false, fgVisual);
                this.code_map[this.normalizeColor(fgVisual)] = fgCode;
            }

            if (bgVisual) {
                document.execCommand('hiliteColor', false, bgVisual);
                this.code_map[this.normalizeColor(bgVisual)] = bgCode;
            }

            this.is_applying_style = false;
            this.updateValueProps();
        },
        setHexColor(fg, bg) {
            this.is_applying_style = true;
            this.focus();

            document.execCommand('styleWithCSS', false, true);

            // If we are applying a HEX color, clear any Standard IRC formatting first
            let styles = this.getSelectionStyles();
            let currentFgCode = this.code_map[this.normalizeColor(styles.fg)];
            let currentBgCode = this.code_map[this.normalizeColor(styles.bg)];

            let isCurrentFgHex = currentFgCode && currentFgCode[0] === '#';
            let isCurrentBgHex = currentBgCode && currentBgCode[0] === '#';

            if (currentFgCode && !isCurrentFgHex) {
                document.execCommand('foreColor', false, 'initial');
            }
            if (currentBgCode && !isCurrentBgHex) {
                document.execCommand('hiliteColor', false, 'transparent');
            }

            let selection = window.getSelection();
            let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

            if (range && range.collapsed) {
                // Apply FG (Always required for HEX system)
                document.execCommand('foreColor', false, fg);
                this.code_map[this.normalizeColor(fg)] = fg;

                // Apply BG if provided
                if (bg) {
                    document.execCommand('hiliteColor', false, bg);
                    this.code_map[this.normalizeColor(bg)] = bg;
                }
            } else if (range) {
                // For text selections, use insertHTML with a marker to pin the selection
                let container = document.createElement('div');
                container.appendChild(range.cloneContents());

                let style = `color: ${fg};`;
                if (bg) {
                    style += ` background-color: ${bg};`;
                }

                let markerId = 'kiwi-hex-marker-' + Math.random().toString(36).substr(2, 9);
                let html = `<span id="${markerId}" style="${style}">${container.innerHTML}</span>`;
                document.execCommand('insertHTML', false, html);

                // Re-select the inserted content using the marker
                let insertedNode = this.$refs.editor.querySelector('#' + markerId);
                if (insertedNode) {
                    let newRange = document.createRange();
                    newRange.selectNodeContents(insertedNode);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    insertedNode.removeAttribute('id');
                }

                this.code_map[this.normalizeColor(fg)] = fg;
                if (bg) {
                    this.code_map[this.normalizeColor(bg)] = bg;
                }
            }

            this.is_applying_style = false;
            this.updateValueProps();
        },
        getSelectionStyles() {
            let selection = window.getSelection();
            if (!selection.rangeCount) {
                return { fg: '', bg: '' };
            }

            let node = selection.anchorNode;
            if (!node) return { fg: '', bg: '' };

            let element = node.nodeType === 1 ? node : node.parentElement;
            if (!element) return { fg: '', bg: '' };

            let style = window.getComputedStyle(element);
            return {
                fg: style.color,
                bg: style.backgroundColor,
            };
        },
        normalizeColor(colorStr) {
            if (!colorStr) return '';
            let clean = colorStr.trim().toLowerCase();
            if (clean[0] === '#') return clean;
            let m = clean.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (m) {
                return Colours.rgb2hex({
                    r: parseInt(m[1], 10),
                    g: parseInt(m[2], 10),
                    b: parseInt(m[3], 10),
                }).toLowerCase();
            }
            return clean;
        },
        toggleBold() {
            document.execCommand('bold', false, null);
            this.updateValueProps();
        },
        toggleItalic() {
            document.execCommand('italic', false, null);
            this.updateValueProps();
        },
        toggleUnderline() {
            document.execCommand('underline', false, null);
            this.updateValueProps();
        },
        toggleStrikethrough() {
            document.execCommand('strikethrough', false, null);
            this.updateValueProps();
        },
        toggleMonospace() {
            document.execCommand('fontName', false, 'monospace');
            this.updateValueProps();
        },
        toggleSpoiler() {
            this.setColour('1', 'black');
            this.setBackgroundColour('1', 'black');
        },
        toggleFancy() {
            document.execCommand('fontName', false, 'kiwi-reverse');
            this.updateValueProps();
        },
        addImg(alt, url, props) {
            this.focus();

            let existingImages = [..._.values(this.$refs.editor.querySelectorAll('img'))];

            document.execCommand('styleWithCSS', false, true);
            document.execCommand('insertImage', false, url);

            let newImg = null;
            let images = [..._.values(this.$refs.editor.querySelectorAll('img'))];

            // Find image that has just been inserted
            images.forEach((img) => {
                if (existingImages.indexOf(img) === -1) {
                    newImg = img;
                }
            });

            newImg.alt = alt;
            Object.assign(newImg, props);

            // Find the position of this new image node
            let prevElCnt = 0;
            let el = newImg;
            while (el) {
                el = el.previousSibling;
                prevElCnt++;
            }

            this.current_focus_node = this.$refs.editor;
            this.current_anchor_node = this.$refs.editor;
            this.current_focus_offset = prevElCnt;
            this.current_anchor_offset = prevElCnt;

            this.updateValueProps();
            this.focus();
        },

        // Insert some text at the current position
        insertText(text) {
            this.focus();
            document.execCommand('insertText', false, text);
            this.updateValueProps();
            this.focus();
        },

        // Replace the word at the current position with another
        setCurrentWord(text, keepPosition, toPosition) {
            let el = this.current_focus_node;
            let pos = this.current_focus_offset;
            let val = el.textContent || '';

            let startVal = val.substr(0, pos);
            let space = startVal.replace(/\xA0/g, ' ').lastIndexOf(' ');
            if (space === -1) {
                space = 0;
            } else {
                // include the space after the word
                space++;
            }
            let startPos = space;

            let endVal = val.substr(pos);
            space = endVal.replace(/\xA0/g, ' ').indexOf(' ');
            if (space === -1) space = endVal.length;
            let endPos = toPosition ? 0 : space;

            el.textContent = startVal.substr(0, startPos) + text + endVal.substr(endPos);

            // Move the caret after the word
            let range = document.createRange();
            if (keepPosition) {
                range.setStart(el, pos);
                range.setEnd(el, pos);
            } else if (el.nodeType === 3) {
                // TEXT_NODE
                range.setStart(el, startPos + text.length);
                range.setEnd(el, startPos + text.length);
            } else {
                // el is another type of node, so setStart/End() counts in nodes instead
                // of text length
                range.setStart(el, 1);
                range.setEnd(el, 1);
            }

            // ensure the input has focus so the cursor position can be set correctly
            this.$refs.editor.focus();

            let sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            this.updateValueProps();
        },

        getCurrentWord(toPosition) {
            let el = this.current_focus_node;
            let pos = this.current_focus_offset;
            let val = el.textContent;
            let cleanVal = val.replace(/\xA0/g, ' ');

            let startVal = cleanVal.substr(0, pos);
            let space = startVal.lastIndexOf(' ');
            if (space === -1) {
                space = 0;
            } else {
                // include the space after the word
                space++;
            }
            let startPos = space;

            space = cleanVal.indexOf(' ', startPos);
            if (space === -1) {
                space = val.length;
            }
            let endPos = toPosition ? pos - startPos : space;

            return {
                word: val.substr(startPos, endPos),
                position: pos - startPos,
            };
        },

        getRawText() {
            return this.$refs.editor.innerText;
        },

        getCaretIdx() {
            return this.current_focus_offset;
        },

        // Focus the editable div and move the caret to the end
        focus() {
            this.$refs.editor.focus();
            let selection = window.getSelection();
            let el = this.current_focus_node || this.$refs.editor;
            let offset = this.current_focus_offset || 0;

            // Safety check: Ensure the offset is valid for the target node
            if (el.nodeType === 3) {
                // TEXT_NODE
                offset = Math.min(offset, el.length);
            } else if (el.childNodes) {
                offset = Math.min(offset, el.childNodes.length);
            }

            if (this.current_anchor_node) {
                let aEl = this.current_anchor_node;
                let aOffset = this.current_anchor_offset;
                if (aEl.nodeType === 3) {
                    aOffset = Math.min(aOffset, aEl.length);
                } else if (aEl.childNodes) {
                    aOffset = Math.min(aOffset, aEl.childNodes.length);
                }
                selection.setBaseAndExtent(aEl, aOffset, el, offset);
            } else {
                let range = document.createRange();
                range.setStart(el, offset);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        },
    },
});
</script>

<style>

.kiwi-ircinput {
    box-sizing: border-box;
    position: relative;
    overflow: visible;
    z-index: 1;
}

.kiwi-ircinput-editor {
    overflow: hidden auto;
    outline: none;
    padding: 7px 0 8px 0;
    box-sizing: border-box;

    /* When the contenteditable div is empty firefox makes its height 0px */
    height: 100%;
}

.kiwi-ircinput-editor:empty:not(:focus)::before {
    content: attr(placeholder);
    cursor: text;
}

.kiwi-ircinput-editor img {
    height: 1em;
    vertical-align: -0.1em;
}

/* WYSIWYG feedback for Monospace and Fancy styles */
.kiwi-ircinput-editor [face='monospace'] {
    background: rgb(128 128 128 / 15%);
    border: 1px solid rgb(128 128 128 / 30%);
    border-radius: 3px;
    padding: 0 3px;
}

.kiwi-ircinput-editor [face='kiwi-reverse'] {
    background: rgb(255 255 0 / 10%);
    border-bottom: 1px dashed orange;
    animation: kiwi-reverse-pulse 2s infinite;
}

</style>
