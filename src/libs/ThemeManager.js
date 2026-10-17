'kiwi public';

import _ from 'lodash';
import Vue from 'vue';

import Logger from '@/libs/Logger';

const log = Logger.namespace('ThemeManager');

let createdInstance = null;

// A theme/font <link> may have been detached from <head> by other code before
// we try to clean it up, so only remove it when it still has a parent.
function removeHeadNode(el) {
    if (el && el.parentNode) {
        el.parentNode.removeChild(el);
    }
}

export default class ThemeManager {
    constructor(state, argTheme) {
        this.state = state;

        this.activeTheme = null;
        this.previousTheme = null;

        this.varsElement = null;
        this.currentElement = null;
        this.loadingElement = null;
        this.currentFontElement = null;
        this.mode = 'light';

        Vue.observable(this);

        const initialTheme = this.findTheme(argTheme)
            || this.findTheme(state.setting('theme'))
            || this.availableThemes()[0];

        // Guess initial mode based on name for instant color-scheme signal
        this.guessMode(initialTheme);
        this.setTheme(initialTheme);
    }

    static themeUrl(theme) {
        let [url, qs] = theme.url.split('?');
        if (url[url.length - 1] !== '/') {
            url += '/';
        }
        return url + 'theme.css' + (qs ? '?' + qs : '');
    }

    availableThemes() {
        return this.state.getSetting('settings.themes');
    }

    findTheme(name) {
        if (!name) {
            return null;
        }
        return _.find(this.availableThemes(), (t) => t.name.toLowerCase() === name.toLowerCase());
    }

    currentTheme() {
        const theme = this.activeTheme || this.availableThemes()[0];
        return this.findTheme(theme.name);
    }

    setTheme(theme) {
        const nextTheme = Object.assign(
            Object.create(null),
            (typeof theme === 'string')
                ? this.findTheme(theme)
                : theme,
        );

        if (!nextTheme || !nextTheme.url) {
            // Tried to set an invalid theme, abort
            // reset the theme setting name to current if its not valid
            if (this.activeTheme && this.activeTheme.name !== this.state.setting('theme')) {
                this.state.setting('theme', this.activeTheme.name);
            }
            log.error('Invalid theme', nextTheme);
            return;
        }

        if (this.loadingElement) {
            // There is already a loading theme
            // remove it as we are about to load another
            removeHeadNode(this.loadingElement);
            this.loadingElement = null;
        }

        if (this.activeTheme && this.activeTheme.url === nextTheme.url) {
            // Theme did not change, abort
            return;
        }

        // Guess mode immediately to provide early signal for embeds/scrollbars
        this.guessMode(nextTheme);

        const nextNameLower = nextTheme.name.toLowerCase();
        const themeElement = document.createElement('link');

        // Handle Google Fonts if the theme specifies them
        if (this.currentFontElement) {
            removeHeadNode(this.currentFontElement);
            this.currentFontElement = null;
        }

        const fonts = nextTheme.google_fonts || this.state.getSetting('settings.google_fonts');
        if (fonts && fonts.length > 0) {
            const fontElement = document.createElement('link');
            fontElement.rel = 'stylesheet';
            const families = fonts.map((f) => `family=${f.replace(/ /g, '+')}`).join('&');
            fontElement.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
            document.head.appendChild(fontElement);
            this.currentFontElement = fontElement;
        }

        themeElement.onload = () => {
            // New theme loaded successfully
            const isInitial = !this.previousTheme;
            this.previousTheme = this.activeTheme || nextTheme;
            this.activeTheme = nextTheme;

            if (this.currentElement && this.currentElement !== this.loadingElement) {
                // Remove the old theme from the DOM
                removeHeadNode(this.currentElement);
            }

            // Move our loaded element into current position
            this.currentElement = this.loadingElement;
            this.loadingElement = null;

            if (nextTheme.name !== this.state.setting('theme')) {
                // Reset the theme setting name to current if its not valid
                this.state.setting('theme', nextTheme.name);
            }

            // Refine mode calculation now that CSS is active
            this.refreshMode();

            if (!isInitial) {
                this.state.$emit('theme.change', nextTheme, this.previousTheme);
            }
        };

        themeElement.onerror = () => {
            // New theme failed to load, remove its loading element
            if (this.loadingElement) {
                removeHeadNode(this.loadingElement);
                this.loadingElement = null;
            }

            if (nextNameLower === 'custom' && !/\/theme\.css(\?|$)/.test(nextTheme.url)) {
                // For custom themes try appending /theme.css
                this.setCustomThemeUrl(ThemeManager.themeUrl(nextTheme));
                return;
            }

            this.state.$emit('theme.failed', nextTheme, this.activeTheme);
        };

        this.loadingElement = themeElement;
        themeElement.rel = 'stylesheet';
        themeElement.type = 'text/css';
        themeElement.href = (nextNameLower !== 'custom')
            ? ThemeManager.themeUrl(nextTheme)
            : nextTheme.url;
        document.head.appendChild(themeElement);
    }

    setCustomThemeUrl(url) {
        const theme = this.findTheme('custom');
        if (!theme) {
            return;
        }

        theme.url = url;
        this.setTheme(theme);
    }

    reload() {
        const theme = this.currentTheme();
        if (!theme) {
            return;
        }

        let url = theme.url;
        if (url.indexOf('cb=') > -1) {
            url = url.replace(/cb=[0-9]+/, () => 'cb=' + Date.now());
        } else if (url.indexOf('?') > -1) {
            url += '&cb=' + Date.now();
        } else {
            url += '?cb=' + Date.now();
        }

        theme.url = url;
        this.setTheme(theme.name);
    }

    /* An explicit light/dark value from the theme config, if it has one */
    static declaredMode(theme) {
        if (!theme || typeof theme.mode !== 'string') {
            return null;
        }

        const mode = theme.mode.toLowerCase();
        return (mode === 'dark' || mode === 'light') ? mode : null;
    }

    /* Derive light/dark from a colour using a simple luminance formula */
    static modeFromColour(colour) {
        if (!colour || typeof colour !== 'string') {
            return null;
        }

        const value = colour.trim().toLowerCase();
        let r;
        let g;
        let b;

        const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)/);
        if (rgb) {
            if (rgb[4] !== undefined && parseFloat(rgb[4]) === 0) {
                // Fully transparent, nothing to measure
                return null;
            }

            r = parseInt(rgb[1], 10);
            g = parseInt(rgb[2], 10);
            b = parseInt(rgb[3], 10);
        } else {
            const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
            if (!hex) {
                return null;
            }

            let digits = hex[1];
            if (digits.length === 3) {
                digits = digits.split('').map((c) => c + c).join('');
            }

            r = parseInt(digits.slice(0, 2), 16);
            g = parseInt(digits.slice(2, 4), 16);
            b = parseInt(digits.slice(4, 6), 16);
        }

        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5 ? 'dark' : 'light';
    }

    ensureVarsElement() {
        if (!this.varsElement || !document.body.contains(this.varsElement)) {
            this.varsElement = document.querySelector('.kiwi-wrap');
        }

        return this.varsElement;
    }

    cssVar(varName) {
        const el = this.ensureVarsElement();
        if (!el) {
            return '';
        }

        const value = window.getComputedStyle(el).getPropertyValue(varName);
        return (value || '').trim();
    }

    themeVar(varName) {
        return this.cssVar('--kiwi-' + varName);
    }

    themeMode() {
        return this.mode;
    }

    guessMode(theme) {
        if (!theme) {
            return;
        }

        // 1. An explicit mode in the theme config always wins
        const declared = ThemeManager.declaredMode(theme);
        if (declared) {
            this.setMode(declared);
            return;
        }

        // 2. Otherwise guess from the theme name
        if (!theme.name) {
            return;
        }

        const name = theme.name.toLowerCase();
        if (name.includes('dark')) {
            this.setMode('dark');
        } else if (name.includes('light')) {
            this.setMode('light');
        }
    }

    setMode(mode) {
        if (this.mode === mode) {
            return;
        }

        this.mode = mode;
        document.documentElement.style.colorScheme = mode;
    }

    refreshMode() {
        // 1. An explicit mode in the theme config is authoritative
        const declared = ThemeManager.declaredMode(this.activeTheme);
        if (declared) {
            this.setMode(declared);
            return;
        }

        // 2. Otherwise measure the theme background now the CSS is live.
        //    The theme background lives on --brand-default-bg rather than
        //    the (transparent) .kiwi-wrap background-color.
        const colour = this.cssVar('--brand-default-bg') || this.cssVar('background-color');
        const measured = ThemeManager.modeFromColour(colour);
        if (measured) {
            this.setMode(measured);
            return;
        }

        // 3. Fall back to guessing from the theme name
        if (this.activeTheme) {
            this.guessMode(this.activeTheme);
        }
    }
}

ThemeManager.instance = (...args) => {
    if (!createdInstance) {
        createdInstance = new ThemeManager(...args);
    }

    return createdInstance;
};
