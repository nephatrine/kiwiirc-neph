import { getEmojiAutocompleteItems } from '@/helpers/Emoji';
import getState from '@/libs/state';
import { setLocalEmojiPacks } from '@/libs/LocalEmojiPacks';
import {
    answerEmojiPackPrompt,
    channelPackState,
    channelPackStateByName,
    channelPolicy,
    emojiPackState,
    ensureChannelMetadata,
    ensureChannelPack,
    ensureServerPack,
    getChannelPolicyEntries,
    getCustomEmojiPickerItems,
    noteChannelMetadata,
    noteChannelPack,
    resolveCustomEmoji,
    setChannelPolicy,
    toggleChannelPack
} from '@/libs/EmojiPackStore';

const serverPackUrl = 'https://emoji.example/server.json';
const channelPackUrl = 'https://emoji.example/channel.json';

function mockPackDocument(packs) {
    global.fetch = jest.fn((url) => Promise.resolve({
        ok: true,
        url,
        text: () => Promise.resolve(JSON.stringify(packs)),
    }));
}

describe('Emoji pack store', () => {
    let state;
    let network;
    let buffer;

    beforeEach(() => {
        state = getState();
        state.resetState();
        state.setting('remoteEmojiPacks', true);
        state.setting('emojiPackPreference', 'local');
        state.setting('customEmojis', {});
        setLocalEmojiPacks([]);
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
    });

    afterEach(() => {
        setLocalEmojiPacks([]);
        state.resetState();
        jest.restoreAllMocks();
        delete global.fetch;
    });

    function loadServerPack() {
        network.isupport['DRAFT/EMOJI'] = serverPackUrl;
        mockPackDocument([{
            id: 'server',
            name: 'Server Pack',
            emoji: {
                wave: {
                    url: 'https://emoji.example/wave.png',
                    alt: 'waving hand',
                },
            },
        }]);
        return ensureServerPack(network, true);
    }

    function loadChannelPack() {
        buffer.metadata['draft/emoji'] = channelPackUrl;
        noteChannelPack(network, buffer);
        mockPackDocument([{
            id: '#test',
            name: '#test Pack',
            emoji: {
                wave: {
                    url: 'https://emoji.example/channel-wave.png',
                    alt: 'channel wave',
                },
            },
        }]);
        return ensureChannelPack(network, buffer, true);
    }

    function loadChannelPackFor(target, url, packs) {
        target.metadata['draft/emoji'] = url;
        noteChannelPack(network, target);
        mockPackDocument(packs);
        return ensureChannelPack(network, target, true);
    }

    function installLocalPack(token, url, packId = 'local-pack') {
        setLocalEmojiPacks([{
            id: 'local-package',
            name: 'Local Package',
            installedAt: 1,
            packs: [{
                id: packId,
                name: 'Local Pack',
                supported: true,
                emoji: {
                    [token]: {
                        url,
                        alt: 'local emoji',
                    },
                },
            }],
        }]);
    }

    function mockMetadataMethods() {
        // Access the getter first: creating the client installs middleware
        // methods on the network, replacing any earlier test stubs.
        const client = network.ircClient;
        expect(client).toBeTruthy();
        network.metadataCap = () => true;
        network.getMetadata = jest.fn();
        return network.getMetadata;
    }

    test('loads server packs automatically and resolves them', async() => {
        await loadServerPack();

        expect(resolveCustomEmoji('wave', buffer)).toMatchObject({
            url: 'https://emoji.example/wave.png',
            alt: 'waving hand',
            source: 'server',
        });
    });

    test('prefers selected channel packs and requires an explicit selection', async() => {
        await loadServerPack();
        await loadChannelPack();

        expect(resolveCustomEmoji('wave', buffer, '#test')).toBeNull();

        toggleChannelPack(network, buffer, '#test', true);
        expect(resolveCustomEmoji('wave', buffer)).toMatchObject({
            url: 'https://emoji.example/channel-wave.png',
            source: 'channel',
        });
        expect(resolveCustomEmoji('wave', buffer, '#test')).toMatchObject({
            url: 'https://emoji.example/channel-wave.png',
            source: 'channel',
            packId: '#test',
            packName: '#test Pack',
        });
    });

    test('local preference uses custom emoji then installed packs then remote packs', async() => {
        await loadServerPack();
        installLocalPack(
            'wave',
            'kiwi-emoji://local-package/images/local-wave.png'
        );
        state.setting('customEmojis', {
            wave: 'https://local.example/wave.png',
        });

        expect(resolveCustomEmoji('wave', buffer)).toMatchObject({
            url: 'https://local.example/wave.png',
            source: 'local',
        });

        state.setting('customEmojis', {});
        expect(resolveCustomEmoji('wave', buffer)).toMatchObject({
            url: 'kiwi-emoji://local-package/images/local-wave.png',
            source: 'local',
            packId: 'local-pack',
        });
    });

    test('remote preference uses remote packs then installed packs then custom emoji', async() => {
        await loadServerPack();
        installLocalPack(
            'wave',
            'kiwi-emoji://local-package/images/local-wave.png'
        );
        state.setting('customEmojis', {
            wave: 'https://local.example/wave.png',
        });
        state.setting('emojiPackPreference', 'remote');

        expect(resolveCustomEmoji('wave', buffer)).toMatchObject({
            url: 'https://emoji.example/wave.png',
            source: 'server',
        });

        state.setting('remoteEmojiPacks', false);
        expect(resolveCustomEmoji('wave', buffer)).toMatchObject({
            url: 'kiwi-emoji://local-package/images/local-wave.png',
            source: 'local',
        });

        setLocalEmojiPacks([]);
        expect(resolveCustomEmoji('wave', buffer)).toMatchObject({
            url: 'https://local.example/wave.png',
            source: 'local',
        });
    });

    test('resolves installed packs with an explicit pack id', async() => {
        installLocalPack(
            'wave',
            'kiwi-emoji://local-package/images/local-wave.png'
        );

        expect(resolveCustomEmoji('wave', buffer, 'local-pack')).toMatchObject({
            url: 'kiwi-emoji://local-package/images/local-wave.png',
            packId: 'local-pack',
            source: 'local',
        });
        expect(resolveCustomEmoji('wave', buffer, 'missing')).toBeNull();
    });

    test('uses the newest installed package when pack ids collide', () => {
        setLocalEmojiPacks([
            {
                id: 'older-package',
                name: 'Older Package',
                installedAt: 1,
                packs: [{
                    id: 'local-pack',
                    name: 'Older Pack',
                    supported: true,
                    emoji: {
                        wave: { url: 'kiwi-emoji://older-package/wave.png' },
                    },
                }],
            },
            {
                id: 'newer-package',
                name: 'Newer Package',
                installedAt: 2,
                packs: [{
                    id: 'local-pack',
                    name: 'Newer Pack',
                    supported: true,
                    emoji: {
                        wave: { url: 'kiwi-emoji://newer-package/wave.png' },
                    },
                }],
            },
        ]);

        expect(resolveCustomEmoji('wave', buffer)).toMatchObject({
            url: 'kiwi-emoji://newer-package/wave.png',
            packId: 'local-pack',
            packName: 'Newer Pack',
        });
    });

    test('picker insert text follows the pack preference', async() => {
        await loadServerPack();
        installLocalPack(
            'wave',
            'kiwi-emoji://local-package/images/local-wave.png'
        );

        const local = getCustomEmojiPickerItems(buffer)
            .find((item) => item.packId === 'local-pack');
        expect(local.insertText).toBe(':wave:');

        state.setting('emojiPackPreference', 'remote');
        const remote = getCustomEmojiPickerItems(buffer)
            .find((item) => item.sourceType === 'server');
        const explicitLocal = getCustomEmojiPickerItems(buffer)
            .find((item) => item.packId === 'local-pack');

        expect(remote.insertText).toBe(':wave:');
        expect(explicitLocal.insertText).toBe(':wave/local-pack:');
    });

    test('does not load or use packs when remote packs are disabled', async() => {
        await loadServerPack();
        state.setting('remoteEmojiPacks', false);

        expect(resolveCustomEmoji('wave', buffer)).toBeNull();
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('skips packs with unsupported required extensions', async() => {
        network.isupport['DRAFT/EMOJI'] = serverPackUrl;
        mockPackDocument([{
            id: 'required',
            name: 'Required Pack',
            required: ['example.com/animated'],
            emoji: {
                wave: {
                    url: 'https://emoji.example/required-wave.png',
                },
            },
        }]);

        await ensureServerPack(network, true);

        expect(resolveCustomEmoji('wave', buffer)).toBeNull();
    });

    test('uses the final duplicate shortcode in a document', async() => {
        network.isupport['DRAFT/EMOJI'] = serverPackUrl;
        mockPackDocument([
            {
                id: 'first',
                name: 'First',
                emoji: {
                    wave: { url: 'https://emoji.example/first-wave.png' },
                },
            },
            {
                id: 'second',
                name: 'Second',
                emoji: {
                    wave: { url: 'https://emoji.example/second-wave.png' },
                },
            },
        ]);

        await ensureServerPack(network, true);

        expect(resolveCustomEmoji('wave', buffer).url)
            .toBe('https://emoji.example/second-wave.png');
    });

    test('uses the final duplicate pack id in a document', async() => {
        network.isupport['DRAFT/EMOJI'] = serverPackUrl;
        mockPackDocument([
            {
                id: 'duplicate',
                name: 'First Duplicate',
                emoji: {
                    wave: { url: 'https://emoji.example/first-duplicate.png' },
                },
            },
            {
                id: 'duplicate',
                name: 'Second Duplicate',
                emoji: {
                    wave: { url: 'https://emoji.example/second-duplicate.png' },
                },
            },
        ]);

        await ensureServerPack(network, true);

        const items = getCustomEmojiPickerItems(buffer)
            .filter((item) => item.packId === 'duplicate');

        expect(items).toHaveLength(1);
        expect(items[0].packName).toBe('Second Duplicate');
        expect(resolveCustomEmoji('wave', buffer).url)
            .toBe('https://emoji.example/second-duplicate.png');
    });

    test('marks channel pack sources as detected without fetching them', () => {
        global.fetch = jest.fn();
        buffer.metadata['draft/emoji'] = channelPackUrl + '?detect';
        noteChannelPack(network, buffer);

        expect(channelPackState(network, buffer).status).toBe('detected');
        expect(global.fetch).not.toHaveBeenCalled();
    });
    test('builds picker items from local and server sources', async() => {
        state.setting('customEmojis', {
            local: 'https://local.example/local.png',
        });
        await loadServerPack();

        const items = getCustomEmojiPickerItems(buffer);
        const local = items.find((item) => item.shortcode === 'local');
        const server = items.find((item) => item.shortcode === 'wave');

        expect(local).toMatchObject({
            insertText: ':local:',
            packId: '',
            source: 'local',
        });
        expect(server).toMatchObject({
            insertText: ':wave:',
            packId: 'server',
            source: 'server',
        });
    });

    test('uses selected channel packs in picker items', async() => {
        await loadServerPack();
        await loadChannelPack();
        toggleChannelPack(network, buffer, '#test', true);

        const items = getCustomEmojiPickerItems(buffer)
            .filter((item) => item.shortcode === 'wave');
        const current = items.find((item) => item.packId === '#test');
        const server = items.find((item) => item.packId === 'server');

        expect(current).toMatchObject({
            insertText: ':wave:',
            packId: '#test',
            source: 'channel',
        });
        expect(server).toMatchObject({
            insertText: ':wave/server:',
            packId: 'server',
            source: 'server',
        });
    });

    test('keeps local and pack variants with distinct insertion text', async() => {
        await loadServerPack();
        state.setting('customEmojis', {
            wave: 'https://local.example/wave.png',
        });

        const items = getCustomEmojiPickerItems(buffer);
        const matches = items.filter((item) => item.shortcode === 'wave');

        expect(matches).toHaveLength(2);
        expect(matches[0]).toMatchObject({
            insertText: ':wave:',
            source: 'local',
        });
        expect(matches[1]).toMatchObject({
            insertText: ':wave/server:',
            source: 'server',
        });
    });
    test('builds autocomplete items with short ids when unambiguous', async() => {
        await loadServerPack();
        await loadChannelPack();
        toggleChannelPack(network, buffer, '#test', true);

        const items = getEmojiAutocompleteItems(':wav', buffer)
            .filter((item) => item.token === 'wave');
        const current = items.find((item) => item.packId === '#test');
        const server = items.find((item) => item.packId === 'server');

        expect(current).toMatchObject({
            text: ':wave:',
            filterText: ':wave/#test:',
            insertText: ':wave:',
            name: ':wave:',
            type: 'emoji',
            sourceType: 'channel',
            packId: '#test',
            packName: '#test Pack',
        });
        expect(server).toMatchObject({
            text: ':wave/server:',
            filterText: ':wave/server:',
            insertText: ':wave/server:',
            sourceType: 'server',
            packId: 'server',
        });
    });

    test('matches autocomplete items by explicit pack id', async() => {
        await loadServerPack();
        await loadChannelPack();
        toggleChannelPack(network, buffer, '#test', true);

        const items = getEmojiAutocompleteItems(':wave/#test', buffer)
            .filter((item) => item.packId === '#test');

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            text: ':wave:',
            filterText: ':wave/#test:',
        });
    });

    test('shows emoji from every selected channel pack on the network', async() => {
        const other = state.addBuffer(network.id, '#other');
        await loadChannelPack();
        toggleChannelPack(network, buffer, '#test', true);

        await loadChannelPackFor(other, 'https://emoji.example/other.json', [{
            id: '#other',
            name: 'Other Pack',
            emoji: {
                party: {
                    url: 'https://emoji.example/party.png',
                    alt: 'party popper',
                },
                wave: {
                    url: 'https://emoji.example/other-wave.png',
                },
            },
        }]);
        toggleChannelPack(network, other, '#other', true);

        const items = getCustomEmojiPickerItems(buffer);
        const waves = items.filter((item) => item.shortcode === 'wave');
        const party = items.find((item) => item.shortcode === 'party');

        expect(waves).toHaveLength(2);
        expect(waves).toEqual(expect.arrayContaining([
            expect.objectContaining({
                packId: '#test',
                packName: '#test Pack',
            }),
            expect.objectContaining({
                packId: '#other',
                packName: 'Other Pack',
                channelName: '#other',
            }),
        ]));
        expect(party).toMatchObject({
            insertText: ':party/#other:',
            packId: '#other',
            packName: 'Other Pack',
            source: 'channel',
        });

        const autocomplete = getEmojiAutocompleteItems(':wave', buffer)
            .filter((item) => item.type === 'emoji' && item.token === 'wave');
        expect(autocomplete.map((item) => item.text).sort()).toEqual([
            ':wave/#other:',
            ':wave:',
        ]);
        expect(autocomplete.map((item) => item.filterText).sort()).toEqual([
            ':wave/#other:',
            ':wave/#test:',
        ]);
    });

    test('uses the pack id only when a pack comes from another channel', async() => {
        const other = state.addBuffer(network.id, '#other');
        await loadChannelPackFor(other, 'https://emoji.example/other.json', [{
            id: '#other',
            name: 'Other Pack',
            emoji: {
                wave: { url: 'https://emoji.example/other-wave.png' },
            },
        }]);
        toggleChannelPack(network, other, '#other', true);

        const fromCurrent = getCustomEmojiPickerItems(buffer)
            .find((item) => item.shortcode === 'wave');
        const fromOther = getCustomEmojiPickerItems(other)
            .find((item) => item.shortcode === 'wave');

        expect(fromCurrent).toMatchObject({
            insertText: ':wave/#other:',
            packId: '#other',
            channelName: '#other',
        });
        expect(fromOther).toMatchObject({
            insertText: ':wave:',
            packId: '#other',
            channelName: '#other',
        });
    });

    test('shows every distinct pack with the same shortcode', async() => {
        network.isupport['DRAFT/EMOJI'] = serverPackUrl;
        mockPackDocument([
            {
                id: 'first',
                name: 'First Pack',
                emoji: {
                    wave: { url: 'https://emoji.example/first-wave.png' },
                },
            },
            {
                id: 'second',
                name: 'Second Pack',
                emoji: {
                    wave: { url: 'https://emoji.example/second-wave.png' },
                },
            },
        ]);

        await ensureServerPack(network, true);

        const items = getCustomEmojiPickerItems(buffer)
            .filter((item) => item.shortcode === 'wave');
        const first = items.find((item) => item.packId === 'first');
        const second = items.find((item) => item.packId === 'second');

        expect(items.map((item) => item.packId)).toEqual(['first', 'second']);
        expect(first.insertText).toBe(':wave/first:');
        expect(second.insertText).toBe(':wave:');
        expect(resolveCustomEmoji('wave', buffer).url)
            .toBe('https://emoji.example/second-wave.png');
        expect(resolveCustomEmoji('wave', buffer, 'first').url)
            .toBe('https://emoji.example/first-wave.png');
        expect(resolveCustomEmoji('wave', buffer, 'second').url)
            .toBe('https://emoji.example/second-wave.png');
    });

    test('uses the current channel version when a server and channel share a pack id', async() => {
        network.isupport['DRAFT/EMOJI'] = serverPackUrl;
        mockPackDocument([{
            id: 'shared',
            name: 'Server Shared',
            emoji: {
                wave: { url: 'https://emoji.example/server-shared.png' },
            },
        }]);
        await ensureServerPack(network, true);

        await loadChannelPackFor(buffer, channelPackUrl, [{
            id: 'shared',
            name: 'Channel Shared',
            emoji: {
                wave: { url: 'https://emoji.example/channel-shared.png' },
            },
        }]);
        toggleChannelPack(network, buffer, 'shared', true);

        const items = getCustomEmojiPickerItems(buffer)
            .filter((item) => item.shortcode === 'wave');

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            insertText: ':wave:',
            packId: 'shared',
            packName: 'Channel Shared',
            source: 'channel',
        });
        expect(resolveCustomEmoji('wave', buffer)).toMatchObject({
            url: 'https://emoji.example/channel-shared.png',
            source: 'channel',
            packName: 'Channel Shared',
        });
        expect(resolveCustomEmoji('wave', buffer, 'shared')).toMatchObject({
            url: 'https://emoji.example/channel-shared.png',
            source: 'channel',
        });
    });

    test('keeps server emoji not overridden by a duplicate channel pack id', async() => {
        network.isupport['DRAFT/EMOJI'] = serverPackUrl;
        mockPackDocument([{
            id: 'shared',
            name: 'Server Shared',
            emoji: {
                party: { url: 'https://emoji.example/server-party.png' },
                wave: { url: 'https://emoji.example/server-shared.png' },
            },
        }]);
        await ensureServerPack(network, true);

        await loadChannelPackFor(buffer, channelPackUrl, [{
            id: 'shared',
            name: 'Channel Shared',
            emoji: {
                wave: { url: 'https://emoji.example/channel-shared.png' },
            },
        }]);
        toggleChannelPack(network, buffer, 'shared', true);

        const items = getCustomEmojiPickerItems(buffer);
        const wave = items.find((item) => item.shortcode === 'wave');
        const party = items.find((item) => item.shortcode === 'party');

        expect(wave).toMatchObject({
            insertText: ':wave:',
            packId: 'shared',
            packName: 'Channel Shared',
            source: 'channel',
        });
        expect(party).toMatchObject({
            insertText: ':party:',
            packId: 'shared',
            packName: 'Server Shared',
            source: 'server',
        });
        expect(resolveCustomEmoji('wave', buffer).url)
            .toBe('https://emoji.example/channel-shared.png');
        expect(resolveCustomEmoji('party', buffer).url)
            .toBe('https://emoji.example/server-party.png');
        expect(resolveCustomEmoji('party', buffer, 'shared')).toMatchObject({
            url: 'https://emoji.example/server-party.png',
            source: 'server',
        });
    });

    test('resolves explicit pack ids from another selected channel', async() => {
        const other = state.addBuffer(network.id, '#other');
        await loadChannelPackFor(other, 'https://emoji.example/other.json', [{
            id: 'other-pack',
            name: 'Other Pack',
            emoji: {
                wave: { url: 'https://emoji.example/other-wave.png' },
            },
        }]);
        toggleChannelPack(network, other, 'other-pack', true);

        expect(resolveCustomEmoji('wave', buffer)).toMatchObject({
            url: 'https://emoji.example/other-wave.png',
            source: 'channel',
            channelName: '#other',
            packName: 'Other Pack',
        });
        expect(resolveCustomEmoji('wave', buffer, 'other-pack')).toMatchObject({
            url: 'https://emoji.example/other-wave.png',
            source: 'channel',
            channelName: '#other',
        });
    });

    test('does not suggest ambiguous pack ids from other channels', async() => {
        const alpha = state.addBuffer(network.id, '#alpha');
        const beta = state.addBuffer(network.id, '#beta');

        await loadChannelPackFor(alpha, 'https://emoji.example/alpha.json', [{
            id: 'shared',
            name: 'Alpha Shared',
            emoji: {
                wave: { url: 'https://emoji.example/alpha-wave.png' },
            },
        }]);
        toggleChannelPack(network, alpha, 'shared', true);

        await loadChannelPackFor(beta, 'https://emoji.example/beta.json', [{
            id: 'shared',
            name: 'Beta Shared',
            emoji: {
                wave: { url: 'https://emoji.example/beta-wave.png' },
            },
        }]);
        toggleChannelPack(network, beta, 'shared', true);

        expect(resolveCustomEmoji('wave', buffer, 'shared')).toBeNull();
        expect(getCustomEmojiPickerItems(buffer)
            .filter((item) => item.packId === 'shared')).toHaveLength(0);
        expect(getEmojiAutocompleteItems(':wave', buffer)
            .filter((item) => item.packId === 'shared')).toHaveLength(0);
    });

    test('treats identical pack content at different urls as one pack', async() => {
        const alpha = state.addBuffer(network.id, '#alpha');
        const beta = state.addBuffer(network.id, '#beta');
        const sharedEmoji = {
            wave: { url: 'https://emoji.example/shared-wave.png' },
        };

        await loadChannelPackFor(alpha, 'https://emoji.example/alpha.json', [{
            id: 'shared',
            name: 'Alpha Shared',
            emoji: sharedEmoji,
        }]);
        toggleChannelPack(network, alpha, 'shared', true);

        await loadChannelPackFor(beta, 'https://emoji.example/beta.json', [{
            id: 'shared',
            name: 'Beta Shared',
            emoji: sharedEmoji,
        }]);
        toggleChannelPack(network, beta, 'shared', true);

        expect(resolveCustomEmoji('wave', buffer, 'shared')).toMatchObject({
            url: 'https://emoji.example/shared-wave.png',
        });
        expect(getCustomEmojiPickerItems(buffer)
            .filter((item) => item.packId === 'shared')).toHaveLength(1);
    });

    test('keeps channel pack selections separate between networks', async() => {
        const networkTwo = state.addNetwork('OtherNetwork', 'OtherNick', {
            server: 'irc.other.example',
        });
        const bufferTwo = state.addBuffer(networkTwo.id, '#test');

        await loadChannelPack();
        toggleChannelPack(network, buffer, '#test', true);

        bufferTwo.metadata['draft/emoji'] = 'https://emoji.example/network-two.json';
        noteChannelPack(networkTwo, bufferTwo);
        mockPackDocument([{
            id: '#test',
            name: 'Network Two Pack',
            emoji: {
                wave: { url: 'https://emoji.example/network-two-wave.png' },
            },
        }]);
        await ensureChannelPack(networkTwo, bufferTwo, true);
        toggleChannelPack(networkTwo, bufferTwo, '#test', true);

        expect(getCustomEmojiPickerItems(buffer)
            .some((item) => item.packName === 'Network Two Pack')).toBe(false);
        expect(getCustomEmojiPickerItems(bufferTwo)
            .some((item) => item.packName === 'Network Two Pack')).toBe(true);
        expect(resolveCustomEmoji('wave', buffer).packName).toBe('#test Pack');
        expect(resolveCustomEmoji('wave', bufferTwo).packName).toBe('Network Two Pack');
    });

    test('uses pack document order for channel defaults regardless of selection order', async() => {
        await loadChannelPackFor(buffer, channelPackUrl, [
            {
                id: 'first',
                name: 'First Pack',
                emoji: {
                    wave: { url: 'https://emoji.example/first-wave.png' },
                },
            },
            {
                id: 'second',
                name: 'Second Pack',
                emoji: {
                    wave: { url: 'https://emoji.example/second-wave.png' },
                },
            },
        ]);

        toggleChannelPack(network, buffer, 'second', true);
        toggleChannelPack(network, buffer, 'first', true);

        const items = getCustomEmojiPickerItems(buffer)
            .filter((item) => item.shortcode === 'wave');
        const first = items.find((item) => item.packId === 'first');
        const second = items.find((item) => item.packId === 'second');

        expect(first.insertText).toBe(':wave/first:');
        expect(second.insertText).toBe(':wave:');
        expect(resolveCustomEmoji('wave', buffer).url)
            .toBe('https://emoji.example/second-wave.png');
        expect(resolveCustomEmoji('wave', buffer, 'first').url)
            .toBe('https://emoji.example/first-wave.png');
        expect(resolveCustomEmoji('wave', buffer, 'second').url)
            .toBe('https://emoji.example/second-wave.png');
    });

    test('always policy loads and selects every channel pack', async() => {
        const url = channelPackUrl + '?policy-always';
        buffer.metadata['draft/emoji'] = url;
        mockPackDocument([{
            id: '#test',
            name: '#test Pack',
            emoji: {
                wave: { url: 'https://emoji.example/channel-wave.png' },
            },
        }]);

        setChannelPolicy(network, buffer.name, 'always');
        await ensureChannelMetadata(network, buffer.name);

        expect(channelPolicy(network, buffer.name)).toBe('always');
        expect(resolveCustomEmoji('wave', buffer, '#test')).toMatchObject({
            url: 'https://emoji.example/channel-wave.png',
            source: 'channel',
        });
        expect(getChannelPolicyEntries(network)).toEqual([
            expect.objectContaining({
                name: '#test',
                policy: 'always',
            }),
        ]);
    });

    test('never policy clears selections and does not fetch or prompt', async() => {
        buffer.metadata['draft/emoji'] = channelPackUrl;
        noteChannelPack(network, buffer);
        setChannelPolicy(network, buffer.name, 'never');

        await ensureChannelMetadata(network, buffer.name);

        expect(channelPolicy(network, buffer.name)).toBe('never');
        expect(resolveCustomEmoji('wave', buffer, '#test')).toBeNull();
        expect(emojiPackState.prompt).toBeNull();
        expect(global.fetch).toBeUndefined();
    });

    test('prompts for unknown channel pack prefixes and loads after approval', async() => {
        const getMetadata = mockMetadataMethods();

        expect(resolveCustomEmoji('wave', buffer, '#outside')).toBeNull();
        expect(emojiPackState.prompt).toMatchObject({
            channelName: '#outside',
            packId: '#outside',
            shortcode: 'wave',
        });

        answerEmojiPackPrompt(true);

        expect(channelPolicy(network, '#outside')).toBe('always');
        expect(getMetadata).toHaveBeenCalledWith(
            '#outside',
            ['draft/emoji']
        );
        expect(emojiPackState.prompt).toBeNull();

        mockPackDocument([{
            id: '#outside',
            name: 'Outside Pack',
            emoji: {
                wave: { url: 'https://emoji.example/outside-wave.png' },
            },
        }]);
        noteChannelMetadata(
            network,
            '#outside',
            'https://emoji.example/outside.json'
        );
        await ensureChannelMetadata(network, '#outside');

        expect(resolveCustomEmoji('wave', buffer, '#outside')).toMatchObject({
            url: 'https://emoji.example/outside-wave.png',
            channelName: '#outside',
        });
    });

    test('declining a prompt remembers never for that channel', async() => {
        const getMetadata = mockMetadataMethods();

        expect(resolveCustomEmoji('wave', buffer, '#refuse')).toBeNull();
        answerEmojiPackPrompt(false);

        expect(channelPolicy(network, '#refuse')).toBe('never');
        expect(getMetadata).not.toHaveBeenCalled();
        expect(resolveCustomEmoji('wave', buffer, '#refuse')).toBeNull();
        expect(emojiPackState.prompt).toBeNull();
    });

    test('setting prompt clears the remembered answer and allows prompting again', () => {
        mockMetadataMethods();

        setChannelPolicy(network, '#reset', 'never');
        setChannelPolicy(network, '#reset', 'prompt');

        expect(channelPolicy(network, '#reset')).toBe('prompt');
        expect(getChannelPolicyEntries(network)
            .some((entry) => entry.name === '#reset')).toBe(false);

        expect(resolveCustomEmoji('wave', buffer, '#reset')).toBeNull();
        expect(emojiPackState.prompt).toMatchObject({
            channelName: '#reset',
        });
        answerEmojiPackPrompt(false);
    });

    test('stores metadata and loads always policy for unjoined channels', async() => {
        const getMetadata = mockMetadataMethods();

        setChannelPolicy(network, '#remote', 'always');
        expect(getMetadata).toHaveBeenCalledWith(
            '#remote',
            ['draft/emoji']
        );

        mockPackDocument([{
            id: '#remote',
            name: 'Remote Pack',
            emoji: {
                wave: { url: 'https://emoji.example/remote-wave.png' },
            },
        }]);
        noteChannelMetadata(
            network,
            '#remote',
            'https://emoji.example/remote.json'
        );
        await ensureChannelMetadata(network, '#remote');

        expect(channelPackStateByName(network, '#remote')).toMatchObject({
            bufferName: '#remote',
            url: 'https://emoji.example/remote.json',
            status: 'loaded',
        });
        expect(resolveCustomEmoji('wave', buffer, '#remote')).toMatchObject({
            url: 'https://emoji.example/remote-wave.png',
            channelName: '#remote',
        });
    });

    test('migrates legacy pack selections to always policies', () => {
        network.setting('emojiPackSelections', {
            '#legacy': ['legacy-pack'],
        });

        expect(channelPolicy(network, '#legacy')).toBe('always');
        expect(network.setting('emojiPackSelections')).toEqual({});
        expect(getChannelPolicyEntries(network)).toEqual([
            expect.objectContaining({
                name: '#legacy',
                policy: 'always',
            }),
        ]);
    });
});
