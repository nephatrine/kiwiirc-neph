import Vue from 'vue';
import TwitchUserNotice from '@/components/TwitchUserNotice';

Vue.mixin({
    computed: {
        $t() {
            return (key) => key;
        },
    },
});

function mountNotice(tags = {}, messageOverrides = {}, exactMessage = null) {
    const message = exactMessage || Object.assign({
        id: 123,
        type: 'twitch_usernotice',
        type_extra: tags['msg-id'] || 'event',
        time: new Date(1700000000000),
        nick: 'streamer',
        tags,
        message: '<strong>Nice stream</strong>',
        user: null,
    }, messageOverrides);
    const buffer = {
        getNetwork: () => ({}),
    };
    const ml = {
        formatMessage: jest.fn(() => '<strong>Nice stream</strong>'),
        bufferSetting: jest.fn(() => true),
        isMessageHighlight: jest.fn(() => false),
        formatTime: jest.fn(() => '12:00'),
        formatTimeFull: jest.fn(() => 'full time'),
    };
    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);

    const vm = new Vue({
        el: mountEl,
        render: (h) => h(TwitchUserNotice, {
            props: {
                buffer,
                message,
                idx: 0,
                ml,
            },
        }),
    });

    return { vm, ml };
}

describe('TwitchUserNotice', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('renders a rich subscription card', async() => {
        const tags = {
            'msg-id': 'resub',
            'system-msg': 'Streamer subscribed at Tier 2.',
            'msg-param-sub-plan': '2000',
            'msg-param-cumulative-months': '12',
        };
        const { vm, ml } = mountNotice(tags);
        await Vue.nextTick();

        const comp = vm.$children[0];
        const el = comp.$el;
        expect(el.classList.contains('kiwi-twitch-usernotice--resub')).toBe(true);
        expect(el.textContent).toContain('twitch_usernotice_resub');
        expect(el.textContent).toContain('Streamer subscribed at Tier 2.');
        expect(el.textContent).toContain('twitch_usernotice_tier');
        expect(el.textContent).toContain('twitch_usernotice_total_months');
        expect(el.textContent).toContain('12');
        expect(el.querySelector('.kiwi-twitch-usernotice-body').innerHTML)
            .toBe('<strong>Nice stream</strong>');
        expect(ml.formatMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'twitch_usernotice',
        }));

        vm.$destroy();
    });

    it('uses the generic event card for unknown notice types', async() => {
        const { vm } = mountNotice({
            'msg-id': 'future-event',
            'system-msg': 'Something happened.',
        });
        await Vue.nextTick();

        const comp = vm.$children[0];
        expect(comp.noticeType.key).toBe('event');
        expect(comp.$el.classList.contains('kiwi-twitch-usernotice--event')).toBe(true);
        expect(comp.$el.textContent).toContain('twitch_usernotice_event');

        vm.$destroy();
    });

    it('applies the theme fancy style to the notice actor', async() => {
        const { vm } = mountNotice({
            'msg-id': 'resub',
            'login': 'streamer',
            'display-name': 'Streamer',
            'system-msg': 'STREAMER subscribed at Tier 2.',
        });
        await Vue.nextTick();

        const comp = vm.$children[0];
        const actor = comp.$el.querySelector('.kiwi-twitch-usernotice-actor');
        expect(actor.textContent).toBe('STREAMER');
        expect(actor.classList.contains('kiwi-formatting-reverse')).toBe(true);
        expect(comp.$el.querySelector('.kiwi-twitch-usernotice-headline').textContent)
            .toBe('STREAMER subscribed at Tier 2.');

        vm.$destroy();
    });

    it('prefixes the fancy actor when the system message omits it', async() => {
        const { vm } = mountNotice({
            'msg-id': 'raid',
            'login': 'streamer',
            'display-name': 'Streamer',
            'system-msg': 'A raid has arrived.',
        });
        await Vue.nextTick();

        const comp = vm.$children[0];
        const actor = comp.$el.querySelector('.kiwi-twitch-usernotice-actor');
        expect(actor.textContent).toBe('Streamer');
        expect(comp.$el.querySelector('.kiwi-twitch-usernotice-headline').textContent)
            .toBe('Streamer A raid has arrived.');

        vm.$destroy();
    });

    it('plays a one-shot entrance animation for fresh notices', async() => {
        const { vm } = mountNotice({
            'msg-id': 'resub',
            'system-msg': 'Streamer subscribed.',
        }, {
            is_new: true,
            time: new Date(),
        });
        await Vue.nextTick();

        const comp = vm.$children[0];
        expect(comp.playEntrance).toBe(true);
        expect(comp.$el.classList.contains('kiwi-twitch-usernotice--fresh')).toBe(true);

        vm.$destroy();
    });

    it('does not replay the entrance animation for old or seen notices', async() => {
        const oldNotice = mountNotice({
            'msg-id': 'resub',
            'system-msg': 'Streamer subscribed.',
        }, {
            is_new: true,
            time: new Date(1700000000000),
        });
        await Vue.nextTick();

        expect(oldNotice.vm.$children[0].playEntrance).toBe(false);
        oldNotice.vm.$destroy();

        const seenMessage = {
            id: 456,
            type: 'twitch_usernotice',
            is_new: true,
            time: new Date(),
            nick: 'streamer',
            tags: {
                'msg-id': 'resub',
                'system-msg': 'Streamer subscribed.',
            },
            message: '',
            user: null,
        };
        const first = mountNotice({}, {}, seenMessage);
        await Vue.nextTick();
        expect(first.vm.$children[0].playEntrance).toBe(true);
        first.vm.$destroy();

        const second = mountNotice({}, {}, seenMessage);
        await Vue.nextTick();
        expect(second.vm.$children[0].playEntrance).toBe(false);
        second.vm.$destroy();
    });
});
