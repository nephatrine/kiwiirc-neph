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

describe('Twitch PRIVMSG helpers', () => {
    it('wraps emote ranges in colons', () => {
        expect(formatTwitchMessage('Kappa hi Keepo', {
            emotes: '25:0-4/1902:9-13',
        })).toBe(':Kappa: hi :Keepo:');
    });

    it('supports multiple ranges for one emote', () => {
        expect(formatTwitchMessage('Kappa Kappa', {
            emotes: '25:0-4,6-10',
        })).toBe(':Kappa: :Kappa:');
    });

    it('replaces gif ranges with their full URL', () => {
        const url = 'https://example.com/a,b.gif';
        expect(formatTwitchMessage('look gif here', {
            gifs: `5-7|gif-id|${url}`,
        })).toBe(`look ${url} here`);
    });

    it('ignores malformed and out-of-range emote data', () => {
        expect(formatTwitchMessage('Kappa', {
            emotes: 'bad-data,25:0-99,25:a-b',
        })).toBe('Kappa');
    });

    it('returns the original text without Twitch range tags', () => {
        expect(formatTwitchMessage('Kappa', {})).toBe('Kappa');
    });

    it('parses tmi-sent-ts as a date', () => {
        const sent = twitchMessageTime({ 'tmi-sent-ts': '1700000000000' });
        expect(sent).toBeInstanceOf(Date);
        expect(sent.getTime()).toBe(1700000000000);
    });

    it('returns null for missing or invalid timestamps', () => {
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
    it('maps the channel owner to founder', () => {
        expect(twitchUserModes('Alice', '#alice', {})).toEqual(['q']);
        expect(twitchUserModes('Alice', '&ALICE', {})).toEqual(['q']);
    });

    it('maps moderator, VIP, and subscriber tags', () => {
        expect(twitchUserModes('alice', '#channel', { mod: '1' })).toEqual(['o']);
        expect(twitchUserModes('alice', '#channel', { vip: '1' })).toEqual(['h']);
        expect(twitchUserModes('alice', '#channel', { subscriber: '1' })).toEqual(['v']);
    });

    it('returns every applicable mode in rank order', () => {
        expect(twitchUserModes('alice', '#alice', {
            mod: '1',
            vip: '1',
            subscriber: '1',
        })).toEqual(['q', 'o', 'h', 'v']);
    });

    it('ignores disabled and missing tags', () => {
        expect(twitchUserModes('alice', '#channel', {
            mod: '0',
            vip: '0',
            subscriber: '0',
        })).toEqual([]);
        expect(twitchUserModes('alice', '#channel', {})).toEqual([]);
    });

    it('returns no modes without a nick, channel, or tags', () => {
        expect(twitchUserModes('', '#channel', { mod: '1' })).toEqual([]);
        expect(twitchUserModes('alice', '', { mod: '1' })).toEqual([]);
        expect(twitchUserModes('alice', '#channel', null)).toEqual([]);
    });
});

describe('Twitch USERNOTICE helpers', () => {
    it('maps known notice types and falls back to a generic event', () => {
        expect(twitchUserNoticeType('RESUB').key).toBe('resub');
        expect(twitchUserNoticeType('raid')).toEqual({
            key: 'raid',
            icon: 'fa-rocket',
            labelKey: 'twitch_usernotice_raid',
            accent: '#ff6a00',
        });
        expect(twitchUserNoticeType('unknown-event').key).toBe('event');
        expect(twitchUserNoticeType().key).toBe('event');
    });

    it('builds resubscription details', () => {
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
    });

    it('maps Prime and numbered subscription tiers', () => {
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
    });

    it('builds gift and raid details', () => {
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
    });

    it('builds bits, modiversary, and viewer milestone details', () => {
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
    });

    it('falls back to generic category and value details', () => {
        expect(twitchUserNoticeDetails({
            'msg-param-category': 'other',
            'msg-param-value': 'gold',
        }, 'viewermilestone')).toEqual([
            { labelKey: 'twitch_usernotice_category', value: 'other' },
            { labelKey: 'twitch_usernotice_value', value: 'gold' },
        ]);
    });

    it('returns no details for empty tags', () => {
        expect(twitchUserNoticeDetails({}, 'resub')).toEqual([]);
        expect(twitchUserNoticeDetails(null, 'resub')).toEqual([]);
    });
});

describe('Twitch channel links', () => {
    it('builds a channel link from common channel names', () => {
        expect(twitchChannelUrl('#Some_Channel')).toBe('https://twitch.tv/Some_Channel');
        expect(twitchChannelUrl('Some_Channel')).toBe('https://twitch.tv/Some_Channel');
        expect(twitchChannelUrl('&Some_Channel')).toBe('https://twitch.tv/Some_Channel');
    });

    it('returns an empty link without a channel name', () => {
        expect(twitchChannelUrl('#')).toBe('');
        expect(twitchChannelUrl('')).toBe('');
        expect(twitchChannelUrl()).toBe('');
    });
});
