import Vue from 'vue';
import MessageListMessageInline from '@/components/MessageListMessageInline';

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

describe('MessageListMessageInline', () => {
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
