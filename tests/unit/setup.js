import Vue from 'vue';

/*
 * The real app registers these globals in src/main.js. Tests mount components
 * directly, so mirror the small parts those components rely on. Without these,
 * Vue logs "Failed to resolve directive: focus" and components that use
 * this.listen() throw from their created hook.
 */

Vue.directive('focus', {
    // Support conditional eg. v-focus="false"
    bind(el, bindings) {
        el.dataset.focus = bindings.value === undefined || !!bindings.value;
    },
    // When the bound element is inserted into the DOM...
    inserted(el) {
        // dataset properties are strings
        if (el.dataset.focus !== 'true') {
            return;
        }
        // Element is input so focus it
        if (el.tagName === 'INPUT') {
            el.focus();
            return;
        }
        // Try to focus the first input element
        let input = el.getElementsByTagName('input')[0];
        if (input) {
            input.focus();
        }
    },
});

// Add a handy this.listen() fn to Vue instances, matching src/main.js. Some
// tests use a plain object as a mock $state, so tolerate a missing event API.
Vue.mixin({
    beforeDestroy() {
        (this.listeningEvents || []).forEach((fn) => fn());
    },
    methods: {
        listen(source, event, fn) {
            let on = source.addEventListener || source.$on || source.on;
            let offEvent = source.removeEventListener || source.$off || source.off;
            if (!on || !offEvent) {
                return () => {};
            }

            this.listeningEvents = this.listeningEvents || [];
            let off = () => {
                offEvent.call(source, event, fn);
            };
            this.listeningEvents.push(off);
            on.call(source, event, fn);
            return off;
        },
        listenOnce(source, event, handler) {
            let fn = handler;
            let on = source.addEventListener || source.$once || source.once;
            let offEvent = source.removeEventListener || source.$off || source.off;
            if (!on || !offEvent) {
                return () => {};
            }

            this.listeningEvents = this.listeningEvents || [];
            let off = () => {
                offEvent.call(source, event, fn);
            };
            this.listeningEvents.push(off);

            if (source.addEventListener) {
                // Create our own once handler as the DOM doesn't support this itself
                fn = function onceFn(...args) {
                    source.removeEventListener(event, onceFn);
                    fn(...args);
                };

                source.addEventListener(event, fn);
            } else {
                on.call(source, event, fn);
            }

            return off;
        },
    },
});
