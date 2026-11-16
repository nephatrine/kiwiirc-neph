import getState from '@/libs/state';
import EmojiPacks from '@/components/EmojiPacks.vue';
import {
    channelPackEnabled,
    channelPolicy,
    emojiPackState,
    networkPackEnabled,
    setChannelPolicy
} from '@/libs/EmojiPackStore';

describe('Emoji pack channel settings', () => {
    let state;
    let network;
    let buffer;

    beforeEach(() => {
        state = getState();
        state.resetState();
        state.setting('remoteEmojiPacks', true);
        Object.keys(emojiPackState.server).forEach((key) => {
            delete emojiPackState.server[key];
        });
        Object.keys(emojiPackState.channels).forEach((key) => {
            delete emojiPackState.channels[key];
        });
        emojiPackState.prompt = null;
        network = state.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.net',
        });
        buffer = state.addBuffer(network.id, '#test');
        buffer.metadata['draft/emoji'] = 'https://emoji.example/test.json';
        setChannelPolicy(network, '#away', 'never');
    });

    afterEach(() => {
        state.resetState();
    });

    test('lists joined metadata channels and unjoined policy channels', () => {
        const rows = EmojiPacks.computed.channels.call({ network });

        expect(rows).toEqual([
            { name: '#away', joined: false },
            { name: '#test', joined: true },
        ]);
    });

    test('shows a network pack row when draft/EMOJI is supported', () => {
        expect(EmojiPacks.computed.networkPackSupported.call({ network })).toBe(false);

        network.isupport['DRAFT/EMOJI'] = 'https://emoji.example/network.json';
        expect(EmojiPacks.computed.networkPackSupported.call({ network })).toBe(true);
    });

    test('lists loaded network packs separately from channel packs', () => {
        emojiPackState.server[network.id] = {
            url: 'https://emoji.example/network.json',
            status: 'loaded',
            error: '',
            packs: [{ id: 'network-pack', name: 'Network Pack' }],
        };
        const context = { network };

        expect(EmojiPacks.computed.networkPackState.call(context).packs).toHaveLength(1);
        expect(EmojiPacks.computed.networkPackState.call(context).packs[0].name)
            .toBe('Network Pack');
    });

    test('applies Default/Always/Never to network and channel packs', () => {
        state.setting('remoteEmojiPacks', false);
        expect(networkPackEnabled(network)).toBe(false);
        expect(channelPackEnabled(network, '#test')).toBe(false);

        network.setting('emojiNetworkPolicy', 'always');
        setChannelPolicy(network, '#test', 'always');
        expect(networkPackEnabled(network)).toBe(true);
        expect(channelPackEnabled(network, '#test')).toBe(true);

        network.setting('emojiNetworkPolicy', 'never');
        setChannelPolicy(network, '#test', 'never');
        expect(networkPackEnabled(network)).toBe(false);
        expect(channelPackEnabled(network, '#test')).toBe(false);
    });

    test('keeps channel rows visible while global remote emoji is disabled', () => {
        state.setting('remoteEmojiPacks', false);

        expect(EmojiPacks.computed.channels.call({ network })).toEqual([
            { name: '#away', joined: false },
            { name: '#test', joined: true },
        ]);
    });

    test('reads and updates a channel policy', () => {
        const context = { network };

        expect(EmojiPacks.methods.policyOf.call(context, '#away')).toBe('never');
        EmojiPacks.methods.changePolicy.call(context, '#away', 'always');
        expect(channelPolicy(network, '#away')).toBe('always');
    });
});
