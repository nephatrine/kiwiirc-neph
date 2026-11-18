import Vue from 'vue';
import MessageListMessageCyberdeck from '@/components/MessageListMessageCyberdeck';

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

describe('MessageListMessageCyberdeck', () => {
    it('renders an avatar plate, timestamp, header, and body', () => {
        const { vm } = mountLayout(false);

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
    });

    it('collapses the avatar and header for repeated authors but keeps the time', () => {
        const { vm } = mountLayout(true);

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
