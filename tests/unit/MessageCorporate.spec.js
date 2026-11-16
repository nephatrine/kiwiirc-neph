import Vue from 'vue';
import MessageListMessageCorporate from '@/components/MessageListMessageCorporate';

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

describe('MessageListMessageCorporate', () => {
    it('renders incoming messages as a metadata line and chat bubble', () => {
        const { vm } = mountLayout({ reactions: true });

        expect(vm.$el.classList.contains('kiwi-messagelist-message--corporate'))
            .toBe(true);
        expect(vm.$el.classList.contains('kiwi-messagelist-message--authorfirst'))
            .toBe(true);
        expect(vm.$el.classList.contains('kiwi-messagelist-message--own'))
            .toBe(false);
        expect(vm.$el.querySelector('.avatar-stub')).not.toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-corporate-meta')).not.toBeNull();
        const bubble = vm.$el.querySelector('.kiwi-messagelist-corporate-bubble');
        const reactions = vm.$el.querySelector('.message-reactions-stub');
        expect(bubble).not.toBeNull();
        expect(reactions).not.toBeNull();
        expect(bubble.contains(reactions)).toBe(false);
        expect(vm.$el.querySelector('.kiwi-messagelist-body').innerHTML)
            .toContain('Hello from the office');

        vm.$destroy();
    });

    it('marks own messages for right-aligned bubbles', () => {
        const { vm } = mountLayout({ own: true });

        expect(vm.$el.classList.contains('kiwi-messagelist-message--own'))
            .toBe(true);
        expect(vm.$el.querySelector('.avatar-stub')).not.toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-corporate-bubble')).not.toBeNull();

        vm.$destroy();
    });

    it('collapses avatar and metadata for repeated authors', () => {
        const { vm } = mountLayout({ repeat: true });

        expect(vm.$el.classList.contains('kiwi-messagelist-message--authorrepeat'))
            .toBe(true);
        expect(vm.$el.querySelector('.kiwi-messagelist-corporate-avatar')).not.toBeNull();
        expect(vm.$el.querySelector('.avatar-stub')).toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-corporate-meta')).toBeNull();
        expect(vm.$el.querySelector('.kiwi-messagelist-corporate-bubble')).not.toBeNull();

        vm.$destroy();
    });

    it('renders automatic media previews outside the bubble', () => {
        const { vm } = mountLayout({ embed: true });
        const bubble = vm.$el.querySelector('.kiwi-messagelist-corporate-bubble');
        const embed = vm.$el.querySelector('.kiwi-messagelist-embed');

        expect(embed).not.toBeNull();
        expect(bubble.contains(embed)).toBe(false);
        expect(embed.querySelector('.media-viewer-stub')).not.toBeNull();

        vm.$destroy();
    });

    it('keeps own-message actions in the row with an inward tray', () => {
        const { vm } = mountLayout({ own: true, showActions: true });
        const bubble = vm.$el.querySelector('.kiwi-messagelist-corporate-bubble');
        const actions = vm.$el.querySelector('.message-actions-stub');

        expect(actions).not.toBeNull();
        expect(bubble.contains(actions)).toBe(false);
        expect(vm.$el.contains(actions)).toBe(true);
        expect(actions.classList.contains('kiwi-messageactions--corporate-own'))
            .toBe(true);

        vm.$destroy();
    });

    it('does not apply own-message styling to self traffic messages', () => {
        const { vm } = mountLayout({ own: true, type: 'traffic' });

        expect(vm.$el.classList.contains('kiwi-messagelist-message--own'))
            .toBe(false);
        expect(vm.$el.classList.contains('kiwi-messagelist-message-traffic'))
            .toBe(true);

        vm.$destroy();
    });

    it('marks bridge card messages so the outer bubble can be removed', () => {
        const { vm } = mountLayout({ own: true, bridgeCard: true });

        expect(vm.$el.classList.contains('kiwi-messagelist-message--bridge-card'))
            .toBe(true);
        expect(vm.$el.classList.contains('kiwi-messagelist-message--own'))
            .toBe(true);

        vm.$destroy();
    });
});
