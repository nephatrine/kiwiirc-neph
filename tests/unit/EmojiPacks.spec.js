import getState from '@/libs/state';
import EmojiPacks from '@/components/EmojiPacks.vue';
import {
    channelPolicy,
    emojiPackState,
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

    test('reads and updates a channel policy', () => {
        const context = { network };

        expect(EmojiPacks.methods.policyOf.call(context, '#away')).toBe('never');
        EmojiPacks.methods.changePolicy.call(context, '#away', 'always');
        expect(channelPolicy(network, '#away')).toBe('always');
    });
});
