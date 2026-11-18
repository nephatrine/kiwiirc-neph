import Vue from 'vue';
import MessageListMessageCompact from '@/components/MessageListMessageCompact';

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

function mountLayout(wideTimestamp = false) {
    const message = createMessage();
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

describe('MessageListMessageCompact', () => {
    it('does not widen the timestamp reserve for the default format', () => {
        const { vm } = mountLayout(false);

        expect(vm.$el.classList.contains('kiwi-messagelist-message--compact'))
            .toBe(true);
        expect(vm.$el.classList.contains('kiwi-messagelist-message--wide-timestamp'))
            .toBe(false);
        expect(vm.$el.querySelector('.kiwi-messagelist-time').textContent)
            .toContain('11:53');

        vm.$destroy();
    });

    it('uses the wider timestamp reserve for 12-hour and custom formats', () => {
        const { vm } = mountLayout(true);

        expect(vm.$el.classList.contains('kiwi-messagelist-message--wide-timestamp'))
            .toBe(true);

        vm.$destroy();
    });
});
