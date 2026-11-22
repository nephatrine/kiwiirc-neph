import Vue from 'vue';
import state from '@/libs/state';
import TwitchUserNotice from '@/components/TwitchUserNotice';
import { theMiddleware } from '@/libs/TwitchMiddleware';
import {
    formatTwitchMessage,
    twitchMessageTime,
    isTwitchRerouted,
    isTwitchUserMessage,
    isTwitchHost,
    twitchChannelUrl,
    twitchUserModes,
    twitchUserNoticeType,
    twitchUserNoticeDetails
} from '@/helpers/Twitch';
import { installTwitchAction } from '@/libs/IrcClient';

describe('Twitch PRIVMSG helpers', () => {
    it('formats emote and gif ranges', () => {
        const cases = [
            ['Kappa hi Keepo', { emotes: '25:0-4/1902:9-13' }, ':Kappa: hi :Keepo:'],
            ['Kappa Kappa', { emotes: '25:0-4,6-10' }, ':Kappa: :Kappa:'],
            [
                'look gif here',
                { gifs: '5-7|gif-id|https://example.com/a,b.gif' },
                'look https://example.com/a,b.gif here',
            ],
            ['Kappa', { emotes: 'bad-data,25:0-99,25:a-b' }, 'Kappa'],
            ['Kappa', {}, 'Kappa'],
        ];

        cases.forEach(([text, tags, expected]) => {
            expect(formatTwitchMessage(text, tags)).toBe(expected);
        });
    });

    it('parses tmi-sent-ts timestamps', () => {
        const sent = twitchMessageTime({ 'tmi-sent-ts': '1700000000000' });
        expect(sent).toBeInstanceOf(Date);
        expect(sent.getTime()).toBe(1700000000000);
        expect(twitchMessageTime({})).toBe(null);
        expect(twitchMessageTime({ 'tmi-sent-ts': 'not-a-time' })).toBe(null);
    });

    it('detects shared-chat reroutes', () => {
        expect(isTwitchRerouted({
            'room-id': '1',
            'source-room-id': '2',
        })).toBe(true);
        expect(isTwitchRerouted({
            'room-id': '1',
            'source-room-id': '1',
        })).toBe(false);
        expect(isTwitchRerouted({ 'room-id': '1' })).toBe(false);
    });

    it('detects Twitch hosts', () => {
        expect(isTwitchHost('irc.chat.twitch.tv')).toBe(true);
        expect(isTwitchHost('TWITCH.TV')).toBe(true);
        expect(isTwitchHost('nottwitch.tv')).toBe(false);
        expect(isTwitchHost('irc.example.com')).toBe(false);
        expect(isTwitchHost('')).toBe(false);
    });

    it('detects user messages that can create Twitch users', () => {
        expect(isTwitchUserMessage({
            nick: 'alice',
            type: 'privmsg',
            from_server: false,
        })).toBe(true);
        expect(isTwitchUserMessage({
            nick: 'alice',
            type: 'action',
            from_server: false,
        })).toBe(true);
        expect(isTwitchUserMessage({
            nick: 'alice',
            type: 'notice',
            from_server: false,
        })).toBe(false);
        expect(isTwitchUserMessage({
            nick: 'tmi.twitch.tv',
            type: 'privmsg',
            from_server: true,
        })).toBe(false);
        expect(isTwitchUserMessage({
            type: 'privmsg',
            from_server: false,
        })).toBe(false);
        expect(isTwitchUserMessage(null)).toBe(false);
    });
});

describe('Twitch per-channel user modes', () => {
    it('maps channel owner, moderator, VIP, and subscriber modes', () => {
        const cases = [
            ['Alice', '#alice', {}, ['q']],
            ['Alice', '&ALICE', {}, ['q']],
            ['alice', '#channel', { mod: '1' }, ['o']],
            ['alice', '#channel', { vip: '1' }, ['h']],
            ['alice', '#channel', { subscriber: '1' }, ['v']],
            ['alice', '#alice', { mod: '1', vip: '1', subscriber: '1' }, ['q', 'o', 'h', 'v']],
            ['alice', '#channel', { mod: '0', vip: '0', subscriber: '0' }, []],
            ['alice', '#channel', {}, []],
            ['', '#channel', { mod: '1' }, []],
            ['alice', '', { mod: '1' }, []],
            ['alice', '#channel', null, []],
        ];

        cases.forEach(([nick, channel, tags, expected]) => {
            expect(twitchUserModes(nick, channel, tags)).toEqual(expected);
        });
    });
});

describe('Twitch USERNOTICE helpers', () => {
    it('maps notice types and falls back to a generic event', () => {
        expect(twitchUserNoticeType('RESUB').key).toBe('resub');
        expect(twitchUserNoticeType('raid')).toEqual({
            key: 'raid',
            icon: 'bx-rocket',
            labelKey: 'twitch_usernotice_raid',
            accent: '#ff6a00',
        });
        expect(twitchUserNoticeType('unknown-event').key).toBe('event');
        expect(twitchUserNoticeType().key).toBe('event');
    });

    it('builds notice details', () => {
        expect(twitchUserNoticeDetails({
            'msg-param-sub-plan-name': 'Channel Subscription',
            'msg-param-cumulative-months': '14',
            'msg-param-should-share-streak': '1',
            'msg-param-streak-months': '3',
        }, 'resub')).toEqual([
            { labelKey: 'twitch_usernotice_plan', value: 'Channel Subscription' },
            { labelKey: 'twitch_usernotice_total_months', value: '14' },
            { labelKey: 'twitch_usernotice_streak', value: '3' },
        ]);

        expect(twitchUserNoticeDetails({
            'msg-param-sub-plan': 'Prime',
        }, 'sub')).toEqual([{
            labelKey: 'twitch_usernotice_plan',
            valueKey: 'twitch_usernotice_prime',
        }]);
        expect(twitchUserNoticeDetails({
            'msg-param-sub-plan': '2000',
        }, 'sub')).toEqual([{
            labelKey: 'twitch_usernotice_tier',
            valueKey: 'twitch_usernotice_tier_value',
            valueParams: { tier: 2 },
        }]);

        expect(twitchUserNoticeDetails({
            'msg-param-recipient-display-name': 'Recipient',
            'msg-param-months': '6',
            'msg-param-gift-months': '3',
            'msg-param-mass-gift-count': '10',
            'msg-param-sender-count': '42',
        }, 'subgift')).toEqual([
            { labelKey: 'twitch_usernotice_months', value: '6' },
            { labelKey: 'twitch_usernotice_recipient', value: 'Recipient' },
            { labelKey: 'twitch_usernotice_gift_months', value: '3' },
            { labelKey: 'twitch_usernotice_gift_count', value: '10' },
            { labelKey: 'twitch_usernotice_gifts_sent', value: '42' },
        ]);
        expect(twitchUserNoticeDetails({
            'msg-param-displayName': 'Raider',
            'msg-param-viewerCount': '123',
        }, 'raid')).toEqual([
            { labelKey: 'twitch_usernotice_viewers', value: '123' },
        ]);

        expect(twitchUserNoticeDetails({
            'msg-param-threshold': '10000',
        }, 'bitsbadgetier')).toEqual([
            { labelKey: 'twitch_usernotice_bits', value: '10000' },
        ]);
        expect(twitchUserNoticeDetails({
            'msg-param-months': '12',
        }, 'modiversary')).toEqual([
            { labelKey: 'twitch_usernotice_months', value: '12' },
        ]);
        expect(twitchUserNoticeDetails({
            'msg-param-category': 'watch-streak',
            'msg-param-value': '5',
        }, 'viewermilestone')).toEqual([
            { labelKey: 'twitch_usernotice_watch_streak', value: '5' },
        ]);
        expect(twitchUserNoticeDetails({
            'msg-param-category': 'other',
            'msg-param-value': 'gold',
        }, 'viewermilestone')).toEqual([
            { labelKey: 'twitch_usernotice_category', value: 'other' },
            { labelKey: 'twitch_usernotice_value', value: 'gold' },
        ]);

        expect(twitchUserNoticeDetails({}, 'resub')).toEqual([]);
        expect(twitchUserNoticeDetails(null, 'resub')).toEqual([]);
    });
});

describe('Twitch channel links', () => {
    it('builds a channel link from common names and handles empty input', () => {
        expect(twitchChannelUrl('#Some_Channel')).toBe('https://twitch.tv/Some_Channel');
        expect(twitchChannelUrl('Some_Channel')).toBe('https://twitch.tv/Some_Channel');
        expect(twitchChannelUrl('&Some_Channel')).toBe('https://twitch.tv/Some_Channel');
        expect(twitchChannelUrl('#')).toBe('');
        expect(twitchChannelUrl('')).toBe('');
        expect(twitchChannelUrl()).toBe('');
    });
});

describe('Twitch actions', () => {
    it('sends /me literally instead of a CTCP action', () => {
        const ircClient = {
            action: jest.fn(),
            say: jest.fn(),
        };

        installTwitchAction(ircClient);
        ircClient.action('#channel', 'waves', { 'client-nonce': 'abc' });

        expect(ircClient.say).toHaveBeenCalledWith(
            '#channel',
            '/me waves',
            { 'client-nonce': 'abc' }
        );
    });

    it('keeps the /me prefix on each multiline line', () => {
        const ircClient = {
            action: jest.fn(),
            say: jest.fn(),
        };

        installTwitchAction(ircClient);
        ircClient.action('#channel', 'one\ntwo');

        expect(ircClient.say).toHaveBeenNthCalledWith(1, '#channel', '/me one', undefined);
        expect(ircClient.say).toHaveBeenNthCalledWith(2, '#channel', '/me two', undefined);
    });
});

describe('TwitchUserNotice', () => {
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

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('renders rich subscription cards and generic events', async() => {
        let { vm, ml } = mountNotice({
            'msg-id': 'resub',
            'system-msg': 'Streamer subscribed at Tier 2.',
            'msg-param-sub-plan': '2000',
            'msg-param-cumulative-months': '12',
        });
        await Vue.nextTick();

        let comp = vm.$children[0];
        expect(comp.$el.classList.contains('kiwi-twitch-usernotice--resub')).toBe(true);
        expect(comp.$el.textContent).toContain('twitch_usernotice_resub');
        expect(comp.$el.textContent).toContain('Streamer subscribed at Tier 2.');
        expect(comp.$el.textContent).toContain('twitch_usernotice_tier');
        expect(comp.$el.textContent).toContain('twitch_usernotice_total_months');
        expect(comp.$el.textContent).toContain('12');
        expect(comp.$el.querySelector('.kiwi-twitch-usernotice-body').innerHTML)
            .toBe('<strong>Nice stream</strong>');
        expect(ml.formatMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'twitch_usernotice',
        }));

        vm.$destroy();

        ({ vm } = mountNotice({
            'msg-id': 'future-event',
            'system-msg': 'Something happened.',
        }));
        await Vue.nextTick();

        comp = vm.$children[0];
        expect(comp.noticeType.key).toBe('event');
        expect(comp.$el.classList.contains('kiwi-twitch-usernotice--event')).toBe(true);
        expect(comp.$el.textContent).toContain('twitch_usernotice_event');

        vm.$destroy();
    });

    it('styles the fancy actor and prefixes it when the system message omits it', async() => {
        let { vm } = mountNotice({
            'msg-id': 'resub',
            'login': 'streamer',
            'display-name': 'Streamer',
            'system-msg': 'STREAMER subscribed at Tier 2.',
        });
        await Vue.nextTick();

        let comp = vm.$children[0];
        let actor = comp.$el.querySelector('.kiwi-twitch-usernotice-actor');
        expect(actor.textContent).toBe('STREAMER');
        expect(actor.classList.contains('kiwi-formatting-reverse')).toBe(true);
        expect(comp.$el.querySelector('.kiwi-twitch-usernotice-headline').textContent)
            .toBe('STREAMER subscribed at Tier 2.');

        vm.$destroy();

        ({ vm } = mountNotice({
            'msg-id': 'raid',
            'login': 'streamer',
            'display-name': 'Streamer',
            'system-msg': 'A raid has arrived.',
        }));
        await Vue.nextTick();

        comp = vm.$children[0];
        actor = comp.$el.querySelector('.kiwi-twitch-usernotice-actor');
        expect(actor.textContent).toBe('Streamer');
        expect(comp.$el.querySelector('.kiwi-twitch-usernotice-headline').textContent)
            .toBe('Streamer A raid has arrived.');

        vm.$destroy();
    });

    it('plays the entrance animation only for fresh, unseen notices', async() => {
        let { vm } = mountNotice({
            'msg-id': 'resub',
            'system-msg': 'Streamer subscribed.',
        }, {
            is_new: true,
            time: new Date(),
        });
        await Vue.nextTick();

        let comp = vm.$children[0];
        expect(comp.playEntrance).toBe(true);
        expect(comp.$el.classList.contains('kiwi-twitch-usernotice--fresh')).toBe(true);

        vm.$destroy();

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

describe('Twitch channel topic on join', () => {
    let s;
    let network;
    let client;
    let buffer;

    function emitParsed(target, command, event) {
        return new Promise((resolve, reject) => {
            target.parsed_middleware.handle(
                [command, event, target],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    function joinEvent(channel = '#test') {
        return {
            command: 'JOIN',
            nick: 'TestNick',
            channel,
            ident: 'testnick',
            hostname: 'testnick.tmi.twitch.tv',
            gecos: '',
            account: '',
            params: [channel],
            tags: {},
            time: Date.now(),
        };
    }

    function setup(server) {
        s = state.create();
        network = s.addNetwork('Network', 'TestNick', {
            server,
            port: 6697,
            tls: true,
        });
        network.state = 'connected';
        client = network.ircClient;
        client.user.nick = 'TestNick';
        jest.spyOn(client, 'raw').mockImplementation(() => {});
        buffer = s.addBuffer(network.id, '#test');
    }

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('adds a join topic message on a Twitch channel only once', async() => {
        setup('irc.chat.twitch.tv');

        await emitParsed(client, 'JOIN', joinEvent());

        let topics = buffer.messagesObj.messages.filter((msg) => msg.type === 'topic');
        expect(topics).toHaveLength(1);
        expect(topics[0].type_extra).toBe('topic_join');
        expect(topics[0].nick).toBe('');
        expect(topics[0].message).toContain('https://twitch.tv/test');

        await emitParsed(client, 'JOIN', joinEvent());

        topics = buffer.messagesObj.messages.filter((msg) => msg.type === 'topic');
        expect(topics).toHaveLength(1);
    });

    it('leaves non-Twitch channels unchanged', async() => {
        setup('irc.example.com');

        await emitParsed(client, 'JOIN', joinEvent());

        const topics = buffer.messagesObj.messages.filter((msg) => msg.type === 'topic');
        expect(topics).toHaveLength(0);
    });
});

describe('Twitch channel prefixes', () => {
    function makeTwitchNetwork() {
        const s = state.create();
        const network = s.addNetwork('Twitch', 'TestNick', {
            server: 'irc.chat.twitch.tv',
            port: 6697,
            tls: true,
        });
        network.nick = 'TestNick';
        network.enabled_caps = ['twitch.tv/commands'];
        const self = s.addUser(network, { nick: 'TestNick' });
        return { s, network, self };
    }

    it('applies USERSTATE modes and marks the channel owner from NAMES', async() => {
        let { s, network, self } = makeTwitchNetwork();
        let buffer = s.addBuffer(network.id, '#channel');
        let next = jest.fn();

        theMiddleware(network, 'unknown command', {
            command: 'USERSTATE',
            params: ['#channel'],
            tags: {
                mod: '1',
                subscriber: '1',
            },
        }, {}, next);

        expect(buffer.userModePrefix(self)).toBe('@+');
        expect(next).not.toHaveBeenCalled();

        ({ s, network } = makeTwitchNetwork());
        const client = network.ircClient;
        client.user.nick = 'TestNick';
        jest.spyOn(client, 'raw').mockImplementation(() => {});
        buffer = s.addBuffer(network.id, '#Streamer');

        const founder = s.addUser(network, { nick: 'Streamer' });
        s.addUserToBuffer(buffer, founder, []);
        network.applyTwitchUserModes(buffer, founder, { mod: '1' });

        await new Promise((resolve, reject) => {
            client.parsed_middleware.handle(['USERLIST', {
                command: 'USERLIST',
                channel: '#Streamer',
                users: [
                    {
                        nick: 'Streamer',
                        ident: 'streamer',
                        hostname: 'streamer.tmi.twitch.tv',
                        modes: [],
                    },
                    {
                        nick: 'Viewer',
                        ident: 'viewer',
                        hostname: 'viewer.tmi.twitch.tv',
                        modes: [],
                    },
                ],
                tags: {},
            }, client], (err) => (err ? reject(err) : resolve()));
        });

        const viewer = network.userByName('Viewer');
        expect(buffer.userModePrefix(founder)).toBe('~@');
        expect(buffer.userModePrefix(viewer)).toBe('');
        jest.restoreAllMocks();
    });
});
