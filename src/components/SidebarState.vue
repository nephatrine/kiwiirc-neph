<script>
'kiwi public';

import Vue from 'vue';

export default Vue.extend({
    data() {
        return {
            sidebarOpen: false,
            // sidebarSection may contain: '', 'user', 'settings', 'nicklist', 'about', 'component'
            sidebarSection: '',
            sidebarUser: null,
            activeComponent: null,
            activeComponentProps: null,
            // Stable identifier for the plugin currently shown in the sidebar.
            // Lets sidebar plugins recognise their own component for toggling.
            activeComponentId: null,
        };
    },
    computed: {
        isDrawn() {
            return this.sidebarOpen && this.section() && this.$state.ui.app_width <= 769;
        },
        isOpen() {
            return this.sidebarOpen && this.section() && this.$state.ui.app_width > 769;
        },
    },
    created() {
        this.listen(this.$state, 'sidebar.component', (component, props, id) => {
            this.showComponent(component, props, id);
        });
        this.listen(this.$state, 'sidebar.component.toggle', (id, component, props) => {
            if (this.isComponentOpen(id)) {
                this.close();
            } else {
                this.showComponent(component, props, id);
            }
        });

        // Allow forcing the sidebar open at startup
        this.$nextTick(() => {
            // nextTick is needed because app_width is 0 on created()
            let sidebarDefault = this.$state.setting('sidebarDefault');
            if (sidebarDefault && this.$state.ui.app_width > 769) {
                this.sidebarOpen = true;
                this.sidebarSection = sidebarDefault;
            }
        });
    },
    methods: {
        section() {
            if (!this.sidebarOpen) {
                return '';
            }

            let section = this.sidebarSection;
            if (section === 'component') {
                return section;
            }

            let buffer = this.$state.getActiveBuffer();
            if (buffer.isQuery()) {
                // This is a query with only one possible sidebar dont change the current state
                // instead attempt to show the user, this allows channels to show their nicklist
                let user = this.$state.getUser(buffer.getNetwork().id, buffer.name);
                if (user) {
                    this.sidebarUser = user;
                    return 'user';
                }
                return '';
            }

            // The following code is for channels only
            if (!buffer.isChannel()) {
                return '';
            }

            if (section === 'user' && this.sidebarUser) {
                if (buffer.hasNick(this.sidebarUser.nick) || this.sidebarUser.relayed_by) {
                    return 'user';
                }
                // This was going to show a user that is not even present in the current channel
                // permantly switch back to nicklist so it does not jump back to user
                // when they switch to a channel with that user
                this.sidebarSection = 'nicklist';
                return this.sidebarSection;
            } else if (section === 'nicklist') {
                return 'nicklist';
            } else if (section === 'settings') {
                return 'settings';
            } else if (section === 'about') {
                return 'about';
            }

            return '';
        },
        resetSidebarState() {
            this.sidebarOpen = false;
            this.sidebarSection = '';
            this.sidebarUser = null;
            this.activeComponent = null;
            this.activeComponentProps = null;
            this.activeComponentId = null;
        },
        close() {
            this.resetSidebarState();
        },
        showComponent(component, props, id) {
            this.resetSidebarState();
            this.sidebarOpen = !!component;
            this.activeComponent = component;
            this.activeComponentProps = props || {};
            this.activeComponentId = component ? (id || null) : null;
            this.sidebarSection = component ? 'component' : '';
        },
        isComponentOpen(id) {
            return this.sidebarOpen && this.activeComponentId === id;
        },
        showUser(user) {
            this.resetSidebarState();
            this.sidebarOpen = true;
            this.sidebarUser = user;
            this.sidebarSection = 'user';
        },
        showNicklist() {
            this.resetSidebarState();
            this.sidebarOpen = true;
            this.sidebarSection = 'nicklist';
        },
        showBufferSettings() {
            this.resetSidebarState();
            this.sidebarOpen = true;
            this.sidebarSection = 'settings';
        },
        showAbout() {
            this.resetSidebarState();
            this.sidebarOpen = true;
            this.sidebarSection = 'about';
        },
        toggleUser(user) {
            this.section() === 'user' ?
                this.close() :
                this.showUser(user);
        },
        toggleNicklist() {
            this.section() === 'nicklist' ?
                this.close() :
                this.showNicklist();
        },
        toggleBufferSettings() {
            this.section() === 'settings' ?
                this.close() :
                this.showBufferSettings();
        },
        toggleAbout() {
            this.section() === 'about' ?
                this.close() :
                this.showAbout();
        },
    },
});

</script>
