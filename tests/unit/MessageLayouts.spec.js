import Vue from 'vue';
import MessageListMessageCompact from '@/components/MessageListMessageCompact';
import MessageListMessageCyberdeck from '@/components/MessageListMessageCyberdeck';
import MessageListMessageInline from '@/components/MessageListMessageInline';
import MessageListMessageCorporate from '@/components/MessageListMessageCorporate';

describe('MessageListMessageCompact', () => {
    function createMessage() {
        return {
            id: 1,
            type: 'privmsg',
            nick: 'Neph',
            time: 1000,
            user: {
                nick: 'Neph',
                realname: '',
                displayName: () => 'Neph',
                displayTooltip: () => '',
                isAway: () => false,
                isOffline: () => false,
            },
            is_pending: false,
            is_redacted: false,
            bodyTemplate: null,
            embed: {
                payload: '',
            },
            reactions: {},
        };
    }

    function createMl(message, wideTimestamp) {
        const network = {
            hasCap: () => false,
            resolveMessage: () => null,
        };

        return {
            buffer: {
                last_read: 0,
                setting: () => false,
                state: {
                    setting: () => true,
                },
                userMode: () => '',
                userModePrefix: () => '',
                getNetwork: () => network,
                isServer: () => false,
                isSpecial: () => false,
            },
            filteredMessages: [message],
            message_info_open: null,
            bufferSetting: (name) => name === 'show_timestamps',
            isMessageHighlight: () => false,
            isTemporaryHighlighted: () => false,
            isHoveringOverMessage: () => false,
            isSelfNick: () => false,
            shouldShowReplyPreview: () => false,
            shouldAutoEmbed: false,
            isTemplateVue: () => false,
            formatMessage: () => '<b>Hello traditionally</b>',
            formatTime: () => '11:53',
            formatTimeFull: () => '11:53:16',
            displayNickFor: (msg) => msg.nick,
            userColourFor: () => '#fff',
            usesWideTimestamp: () => wideTimestamp,
            maybeScrollToId: jest.fn(),
            openEmbedInPreview: jest.fn(),
            toggleMessageInfo: jest.fn(),
            onMessageClick: jest.fn(),
            onMessageAuxClick: jest.fn(),
            onMessageDblClick: jest.fn(),
            $t: (key) => key,
        };
    }

    function createMethods() {
        return {
            isRepeat: () => false,
            isHoveringOverMessage: () => false,
            userMode: () => '',
            userModePrefix: () => '',
            getReplyMessage: () => null,
            getReplyMessageText: () => '',
            shouldShowReplyPreview: () => false,
            canReply: () => false,
            getNetwork: () => ({ hasCap: () => false, resolveMessage: () => null }),
        };
    }

    function stubWithClass(className) {
        return {
            render: (h) => h('span', { class: className }),
        };
    }

    function mountLayout(wideTimestamp = false, message = createMessage()) {
        const ml = createMl(message, wideTimestamp);
        const methods = createMethods();
        const vm = new Vue({
            provide: {
                components: {
                    AwayStatusIndicator: stubWithClass('away-status-stub'),
                    MessageInfo: stubWithClass('message-info-stub'),
                    MediaViewer: stubWithClass('media-viewer-stub'),
                    MessageReactions: stubWithClass('message-reactions-stub'),
                    MessageActions: stubWithClass('message-actions-stub'),
                },
            },
            render: (h) => h(MessageListMessageCompact, {
                props: {
                    ml,
                    message,
                    idx: 0,
                    m: () => methods,
                },
            }),
        }).$mount();

        return { vm };
    }

    it('reserves wider timestamp space only for 12-hour and custom formats', () => {
        let { vm } = mountLayout(false);

        expect(vm.$el.classList.contains('kiwi-messagelist-message--compact'))
            .toBe(true);
        expect(vm.$el.classList.contains('kiwi-messagelist-message--wide-timestamp'))
            .toBe(false);
        expect(vm.$el.querySelector('.kiwi-messagelist-time').textContent)
            .toContain('11:53');

        vm.$destroy();

        ({ vm } = mountLayout(true));

        expect(vm.$el.classList.contains('kiwi-messagelist-message--wide-timestamp'))
            .toBe(true);

        vm.$destroy();
    });

    it('renders a local system message with no author or away marker', () => {
        const local = Object.assign(createMessage(), {
            nick: '',
            type: 'system',
            type_extra: 'fish',
            user: null,
        });
        const { vm } = mountLayout(false, local);

        expect(vm.$el.classList.contains('kiwi-messagelist-message-system-fish'))
            .toBe(true);
        expect(vm.$el.querySelector('.away-status-stub')).toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-nick').textContent.trim())
            .toBe('');
        expect(vm.$el.getAttribute('data-nick')).toBe('');

        vm.$destroy();
    });
});

describe('MessageListMessageCyberdeck', () => {
    function createMessage() {
        return {
            id: 1,
            type: 'privmsg',
            nick: 'Neph',
            time: 1000,
            user: {
                nick: 'Neph',
                realname: '',
                displayName: () => 'Neph',
                displayTooltip: () => '',
                isAway: () => false,
                isOffline: () => false,
            },
            is_pending: false,
            is_redacted: false,
            bodyTemplate: null,
            embed: {
                payload: '',
            },
            reactions: {},
        };
    }

    function createMl(message, repeat, wideTimestamp = false) {
        const network = {
            hasCap: () => false,
            resolveMessage: () => null,
        };

        return {
            buffer: {
                last_read: 0,
                setting: () => false,
                state: {
                    setting: () => true,
                },
                userMode: () => '',
                userModePrefix: () => '',
                getNetwork: () => network,
                isServer: () => false,
                isSpecial: () => false,
            },
            filteredMessages: repeat ? [{ condenseKey: () => 'neph' }, message] : [message],
            message_info_open: null,
            bufferSetting: (name) => name === 'show_timestamps',
            isEmojiOnlyMessage: () => false,
            isMessageHighlight: () => false,
            isTemporaryHighlighted: () => false,
            isHoveringOverMessage: () => false,
            isSelfNick: () => false,
            shouldShowReplyPreview: () => false,
            shouldAutoEmbed: false,
            isTemplateVue: () => false,
            formatMessage: () => '<b>Hello from the deck</b>',
            formatTime: () => '22:41',
            formatTimeFull: () => '22:41:00',
            displayNickFor: (msg) => msg.nick,
            userColourFor: () => '#fff',
            usesWideTimestamp: () => wideTimestamp,
            maybeScrollToId: jest.fn(),
            onMessageClick: jest.fn(),
            onMessageAuxClick: jest.fn(),
            onMessageDblClick: jest.fn(),
            $t: (key) => key,
        };
    }

    function createMethods(message, repeat) {
        return {
            isRepeat: () => repeat,
            isHoveringOverMessage: () => false,
            isMessage: (msg) => ['privmsg', 'action', 'notice', 'message']
                .indexOf(msg.type) > -1,
            displayAvatar: () => !repeat,
            userMode: () => '',
            userModePrefix: () => '',
            showRealName: () => false,
            realnameHtml: () => '',
            showHostName: () => false,
            hostName: () => '',
            onRealnameClick: jest.fn(),
            getNetwork: () => ({ hasCap: () => false }),
            getReplyMessage: () => null,
            getReplyMessageText: () => '',
            scrollToReply: jest.fn(),
            shouldShowReplyPreview: () => false,
            canReply: () => false,
        };
    }

    function stubWithClass(className) {
        return {
            render: (h) => h('span', { class: className }),
        };
    }

    const UserAvatarStub = {
        props: {
            shape: {
                type: String,
                default: 'circle',
            },
        },
        render(h) {
            return h('span', {
                class: 'avatar-stub',
                attrs: {
                    'data-shape': this.shape,
                },
            });
        },
    };

    function mountLayout(repeat = false, wideTimestamp = false) {
        const message = createMessage();
        const ml = createMl(message, repeat, wideTimestamp);
        const methods = createMethods(message, repeat);
        const vm = new Vue({
            provide: {
                components: {
                    UserAvatar: UserAvatarStub,
                    MessageInfo: stubWithClass('message-info-stub'),
                    MediaViewer: stubWithClass('media-viewer-stub'),
                    MessageReactions: stubWithClass('message-reactions-stub'),
                    MessageActions: stubWithClass('message-actions-stub'),
                },
            },
            render: (h) => h(MessageListMessageCyberdeck, {
                props: {
                    ml,
                    message,
                    idx: repeat ? 1 : 0,
                    m: () => methods,
                },
            }),
        }).$mount();

        return { vm, ml };
    }

    it('renders the avatar plate and collapses repeats while keeping the time', () => {
        let { vm } = mountLayout(false);

        expect(vm.$el.classList.contains('kiwi-messagelist-message--cyberdeck'))
            .toBe(true);
        expect(vm.$el.classList.contains('kiwi-messagelist-message--authorfirst'))
            .toBe(true);
        expect(vm.$el.classList.contains('kiwi-messagelist-message--wide-timestamp'))
            .toBe(false);
        expect(vm.$el.querySelector('.avatar-stub')).not.toBeNull();
        expect(vm.$el.querySelector('.avatar-stub').getAttribute('data-shape'))
            .toBe('square');
        expect(vm.$el.querySelector('.kiwi-messagelist-cyberdeck-header')).not.toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-cyberdeck-time').textContent)
            .toContain('22:41');
        expect(vm.$el.querySelector('.kiwi-messagelist-body').innerHTML)
            .toContain('Hello from the deck');

        vm.$destroy();

        ({ vm } = mountLayout(true));

        expect(vm.$el.classList.contains('kiwi-messagelist-message--authorrepeat'))
            .toBe(true);
        expect(vm.$el.querySelector('.avatar-stub')).toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-cyberdeck-marker')).not.toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-cyberdeck-time').textContent)
            .toContain('22:41');
        expect(vm.$el.querySelector('.kiwi-messagelist-body').innerHTML)
            .toContain('Hello from the deck');

        vm.$destroy();
    });

    it('uses the wider avatar gutter for 12-hour and custom timestamps', () => {
        const { vm } = mountLayout(false, true);

        expect(vm.$el.classList.contains('kiwi-messagelist-message--wide-timestamp'))
            .toBe(true);

        vm.$destroy();
    });
});

describe('MessageListMessageInline', () => {
    function createMessage() {
        return {
            id: 1,
            type: 'privmsg',
            nick: 'Neph',
            time: 1000,
            user: {
                nick: 'Neph',
                realname: '',
                displayName: () => 'Neph',
                displayTooltip: () => '',
                isAway: () => false,
                isOffline: () => false,
            },
            is_pending: false,
            is_redacted: false,
            bodyTemplate: null,
            embed: {
                payload: '',
            },
            reactions: {},
        };
    }

    function createMl(message, {
        timestampFormat = '%H:%M:%S',
        showActions = false,
        wideTimestamp = false,
    } = {}) {
        const network = {
            hasCap: (cap) => showActions && cap === 'message-tags',
            resolveMessage: () => null,
        };

        return {
            buffer: {
                last_read: 0,
                setting: () => false,
                state: {
                    setting: () => true,
                },
                userMode: () => '',
                userModePrefix: () => '',
                getNetwork: () => network,
                isServer: () => false,
                isSpecial: () => false,
            },
            filteredMessages: [message],
            message_info_open: null,
            bufferSetting: (name) => {
                if (name === 'show_timestamps') {
                    return true;
                }
                if (name === 'timestamp_format') {
                    return timestampFormat;
                }
                return false;
            },
            isEmojiOnlyMessage: () => false,
            isMessageHighlight: () => false,
            isTemporaryHighlighted: () => false,
            isHoveringOverMessage: () => false,
            isSelfNick: () => false,
            shouldShowReplyPreview: () => false,
            shouldAutoEmbed: false,
            isTemplateVue: () => false,
            formatMessage: () => '<b>Hello inline</b>',
            formatTime: () => '11:53',
            formatTimeFull: () => '11:53:16',
            displayNickFor: (msg) => msg.nick,
            userColourFor: () => '#123456',
            usesWideTimestamp: () => wideTimestamp,
            maybeScrollToId: jest.fn(),
            openEmbedInPreview: jest.fn(),
            toggleMessageInfo: jest.fn(),
            onMessageClick: jest.fn(),
            onMessageAuxClick: jest.fn(),
            onMessageDblClick: jest.fn(),
            $t: (key) => key,
        };
    }

    function createMethods({ showActions = false } = {}) {
        return {
            displayNick: () => 'Neph: ',
            userMode: () => '',
            userModePrefix: () => '',
            getReplyMessage: () => null,
            getReplyMessageText: () => '',
            shouldShowReplyPreview: () => false,
            canReply: () => showActions,
            getNetwork: () => ({
                hasCap: (cap) => showActions && cap === 'message-tags',
                resolveMessage: () => null,
            }),
        };
    }

    function stubWithClass(className) {
        return {
            render: (h) => h('span', { class: className }),
        };
    }

    function mountLayout({
        timestampFormat = '%H:%M:%S',
        showActions = false,
        wideTimestamp = false,
    } = {}) {
        const message = createMessage();
        if (showActions) {
            message.irc_id = 'msgid-1';
        }
        const ml = createMl(message, { timestampFormat, showActions, wideTimestamp });
        const methods = createMethods({ showActions });
        const vm = new Vue({
            provide: {
                components: {
                    MessageInfo: stubWithClass('message-info-stub'),
                    MediaViewer: stubWithClass('media-viewer-stub'),
                    MessageReactions: stubWithClass('message-reactions-stub'),
                    MessageActions: stubWithClass('message-actions-stub'),
                },
            },
            render: (h) => h(MessageListMessageInline, {
                props: {
                    ml,
                    message,
                    idx: 0,
                    m: () => methods,
                },
            }),
        }).$mount();

        return { vm };
    }

    it('applies the nickname color and renders actions before the timestamp', () => {
        let { vm } = mountLayout();
        let nick = vm.$el.querySelector('.kiwi-messagelist-nick');
        let link = nick.querySelector('.kiwi-messagelist-nick-link');

        expect(nick.style.color).toBe('rgb(18, 52, 86)');
        expect(link.style.color).toBe('rgb(18, 52, 86)');

        vm.$destroy();

        ({ vm } = mountLayout({ showActions: true }));
        const meta = vm.$el.querySelector('.kiwi-messagelist-inline-meta');
        const children = [...meta.children];

        expect(children[0].classList.contains('message-actions-stub'))
            .toBe(true);
        expect(children[1].classList.contains('kiwi-messagelist-time'))
            .toBe(true);
        expect(vm.$el.classList.contains('kiwi-messagelist-message--wide-timestamp'))
            .toBe(false);

        vm.$destroy();
    });

    it('uses the wider hover reserve for 12-hour and custom formats', () => {
        const { vm } = mountLayout({ wideTimestamp: true });

        expect(vm.$el.classList.contains('kiwi-messagelist-message--wide-timestamp'))
            .toBe(true);

        vm.$destroy();
    });
});

describe('MessageListMessageCorporate', () => {
    function createMessage(embedUrl = '', type = 'privmsg') {
        return {
            id: 1,
            type,
            nick: 'Neph',
            time: 1000,
            irc_id: '',
            user: {
                nick: 'Neph',
                realname: '',
                displayName: () => 'Neph',
                displayTooltip: () => '',
                isAway: () => false,
                isOffline: () => false,
            },
            is_pending: false,
            is_redacted: false,
            bodyTemplate: null,
            bridge_card: null,
            embed: {
                payload: embedUrl,
            },
            reactions: {},
        };
    }

    function createMl(message, repeat, own, autoEmbed = false, showActions = false) {
        const network = {
            hasCap: (cap) => showActions && cap === 'message-tags',
            resolveMessage: () => null,
        };

        return {
            buffer: {
                last_read: 0,
                setting: () => false,
                state: {
                    setting: () => true,
                },
                userMode: () => '',
                userModePrefix: () => '',
                getNetwork: () => network,
                isServer: () => false,
                isSpecial: () => false,
            },
            filteredMessages: repeat ? [{ condenseKey: () => 'neph' }, message] : [message],
            message_info_open: null,
            bufferSetting: (name) => name === 'show_timestamps',
            isEmojiOnlyMessage: () => false,
            isMessageHighlight: () => false,
            isTemporaryHighlighted: () => false,
            isHoveringOverMessage: () => false,
            isSelfNick: () => own,
            shouldShowReplyPreview: () => false,
            shouldAutoEmbed: autoEmbed,
            isTemplateVue: () => false,
            formatMessage: () => '<b>Hello from the office</b>',
            formatTime: () => '09:41',
            formatTimeFull: () => '09:41:00',
            displayNickFor: (msg) => msg.nick,
            userColourFor: () => '#fff',
            maybeScrollToId: jest.fn(),
            onMessageClick: jest.fn(),
            onMessageAuxClick: jest.fn(),
            onMessageDblClick: jest.fn(),
            $t: (key) => key,
        };
    }

    function createMethods(repeat, showActions = false, own = false) {
        const isMessage = (msg) => ['privmsg', 'action', 'notice', 'message']
            .indexOf(msg.type) > -1;

        return {
            isRepeat: () => repeat,
            isHoveringOverMessage: () => false,
            isMessage,
            hasReactions: (msg) => !!(
                msg.reactions && Object.keys(msg.reactions).length
            ),
            isOwnMessage: (msg) => !repeat && own && isMessage(msg),
            displayAvatar: () => !repeat,
            userMode: () => '',
            userModePrefix: () => '',
            showRealName: () => false,
            realnameHtml: () => '',
            showHostName: () => false,
            hostName: () => '',
            onRealnameClick: jest.fn(),
            getNetwork: () => ({
                hasCap: (cap) => showActions && cap === 'message-tags',
            }),
            getReplyMessage: () => null,
            getReplyMessageText: () => '',
            scrollToReply: jest.fn(),
            shouldShowReplyPreview: () => false,
            canReply: () => showActions,
        };
    }

    function stubWithClass(className) {
        return {
            render: (h) => h('span', { class: className }),
        };
    }

    function mountLayout({
        repeat = false,
        own = false,
        embed = false,
        showActions = false,
        bridgeCard = false,
        reactions = false,
        type = 'privmsg',
    } = {}) {
        const message = createMessage(
            embed ? 'https://example.com/image.png' : '',
            type
        );
        if (showActions) {
            message.irc_id = 'msgid-1';
        }
        if (bridgeCard) {
            message.bridge_card = { marker: 'preview' };
        }
        if (reactions) {
            message.reactions = {
                '👍': { count: 1, users: ['Neph'] },
            };
        }
        const ml = createMl(message, repeat, own, embed, showActions);
        const methods = createMethods(repeat, showActions, own);
        const vm = new Vue({
            provide: {
                components: {
                    UserAvatar: stubWithClass('avatar-stub'),
                    MessageInfo: stubWithClass('message-info-stub'),
                    MediaViewer: stubWithClass('media-viewer-stub'),
                    MessageReactions: stubWithClass('message-reactions-stub'),
                    MessageActions: stubWithClass('message-actions-stub'),
                },
            },
            render: (h) => h(MessageListMessageCorporate, {
                props: {
                    ml,
                    message,
                    idx: repeat ? 1 : 0,
                    m: () => methods,
                },
            }),
        }).$mount();

        return { vm };
    }

    it('renders incoming messages as metadata, bubble, and outside media', () => {
        let { vm } = mountLayout({ reactions: true });

        expect(vm.$el.classList.contains('kiwi-messagelist-message--corporate'))
            .toBe(true);
        expect(vm.$el.classList.contains('kiwi-messagelist-message--authorfirst'))
            .toBe(true);
        expect(vm.$el.classList.contains('kiwi-messagelist-message--own'))
            .toBe(false);
        expect(vm.$el.querySelector('.avatar-stub')).not.toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-corporate-meta')).not.toBeNull();
        let bubble = vm.$el.querySelector('.kiwi-messagelist-corporate-bubble');
        const reactions = vm.$el.querySelector('.message-reactions-stub');
        expect(bubble).not.toBeNull();
        expect(reactions).not.toBeNull();
        expect(bubble.contains(reactions)).toBe(false);
        expect(vm.$el.querySelector('.kiwi-messagelist-body').innerHTML)
            .toContain('Hello from the office');
        vm.$destroy();

        ({ vm } = mountLayout({ embed: true }));
        bubble = vm.$el.querySelector('.kiwi-messagelist-corporate-bubble');
        const embed = vm.$el.querySelector('.kiwi-messagelist-embed');
        expect(embed).not.toBeNull();
        expect(bubble.contains(embed)).toBe(false);
        expect(embed.querySelector('.media-viewer-stub')).not.toBeNull();
        vm.$destroy();
    });

    it('marks own messages and keeps their actions in the row', () => {
        let { vm } = mountLayout({ own: true });

        expect(vm.$el.classList.contains('kiwi-messagelist-message--own'))
            .toBe(true);
        expect(vm.$el.querySelector('.avatar-stub')).not.toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-corporate-bubble')).not.toBeNull();
        vm.$destroy();

        ({ vm } = mountLayout({ own: true, showActions: true }));
        const bubble = vm.$el.querySelector('.kiwi-messagelist-corporate-bubble');
        const actions = vm.$el.querySelector('.message-actions-stub');
        expect(actions).not.toBeNull();
        expect(bubble.contains(actions)).toBe(false);
        expect(vm.$el.contains(actions)).toBe(true);
        expect(actions.classList.contains('kiwi-messageactions--corporate-own'))
            .toBe(true);
        vm.$destroy();

        ({ vm } = mountLayout({ own: true, bridgeCard: true }));
        expect(vm.$el.classList.contains('kiwi-messagelist-message--bridge-card'))
            .toBe(true);
        expect(vm.$el.classList.contains('kiwi-messagelist-message--own'))
            .toBe(true);
        vm.$destroy();
    });

    it('collapses repeated authors and skips own styling for traffic', () => {
        let { vm } = mountLayout({ repeat: true });

        expect(vm.$el.classList.contains('kiwi-messagelist-message--authorrepeat'))
            .toBe(true);
        expect(vm.$el.querySelector('.kiwi-messagelist-corporate-avatar')).not.toBeNull();
        expect(vm.$el.querySelector('.avatar-stub')).toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-corporate-meta')).toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-corporate-bubble')).not.toBeNull();
        vm.$destroy();

        ({ vm } = mountLayout({ own: true, type: 'traffic' }));
        expect(vm.$el.classList.contains('kiwi-messagelist-message--own'))
            .toBe(false);
        expect(vm.$el.classList.contains('kiwi-messagelist-message-traffic'))
            .toBe(true);
        vm.$destroy();
    });
});
