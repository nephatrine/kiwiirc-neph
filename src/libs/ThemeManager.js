'kiwi public';

import _ from 'lodash';
import Vue from 'vue';

import Logger from '@/libs/Logger';

const log = Logger.namespace('ThemeManager');

let createdInstance = null;

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
            document.head.removeChild(this.loadingElement);
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
            document.head.removeChild(this.currentFontElement);
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
                document.head.removeChild(this.currentElement);
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
                document.head.removeChild(this.loadingElement);
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

    themeVar(varName) {
        if (!this.varsElement) {
            this.varsElement = document.querySelector('.kiwi-wrap');
        }

        const styles = window.getComputedStyle(this.varsElement);
        const value = styles.getPropertyValue('--kiwi-' + varName);
        return (value || '').trim();
    }

    themeMode() {
        return this.mode;
    }

    guessMode(theme) {
        if (!theme || !theme.name) {
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
        if (!this.varsElement) {
            this.varsElement = document.querySelector('.kiwi-wrap');
        }

        if (!this.varsElement) {
            return;
        }

        const styles = window.getComputedStyle(this.varsElement);
        const bg = styles.getPropertyValue('background-color');

        // Parse rgb(a) or hex
        const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            const r = parseInt(match[1], 10);
            const g = parseInt(match[2], 10);
            const b = parseInt(match[3], 10);

            // Simple luminance formula
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            this.setMode(luminance < 0.5 ? 'dark' : 'light');
            return;
        }

        // Fallback if no color detected (should be rare once CSS is loaded)
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
