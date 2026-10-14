import {
    fetchNowPlaying,
    nowPlayingEnabled,
    nowPlayingUrl,
    statusUrlFor,
    titleFromStatus
} from '@/libs/radio/nowPlaying';

const status = {
    icestats: {
        source: [
            { listenurl: 'http://lissen.to:8000/rekt.ogg', title: '-' },
            { listenurl: 'http://lissen.to:8000/rekt.mp3', title: 'Artist - Track' },
            { listenurl: 'http://localhost:8000/ogg', title: '' },
            { listenurl: 'http://localhost:8000/mp3', title: 'Plaza Song' },
            { listenurl: 'http://stream.example:8040/live', title: 'Live Artist - Live Track' },
        ],
    },
};

describe('radio now playing', () => {
    test('builds an icecast status url from the stream host', () => {
        expect(statusUrlFor('https://stream.nightride.fm/rekt.ogg?x=1')).toBe(
            'https://stream.nightride.fm/status-json.xsl'
        );
        expect(statusUrlFor('https://mediaserv38.live-streams.nl:18040/live')).toBe(
            'https://mediaserv38.live-streams.nl:18040/status-json.xsl'
        );
    });

    test('uses a sibling mp3 title when the ogg title is empty', () => {
        expect(titleFromStatus(status, 'https://stream.nightride.fm/rekt.ogg')).toBe(
            'Artist - Track'
        );
        expect(titleFromStatus(status, 'https://radio.plaza.one/ogg')).toBe('Plaza Song');
        expect(titleFromStatus(status, 'https://mediaserv38.live-streams.nl:18040/live')).toBe(
            'Live Artist - Live Track'
        );
    });

    test('disables polling when a station opts out', () => {
        expect(nowPlayingEnabled({ nowPlaying: false })).toBe(false);
        expect(nowPlayingEnabled({ nowPlaying: 'https://np.example/now' })).toBe(true);
        expect(nowPlayingEnabled({})).toBe(true);
        expect(nowPlayingUrl({ source: 'https://x.example/s.ogg', nowPlaying: false })).toBe('');
        expect(
            nowPlayingUrl({ source: 'https://x.example/s.ogg', nowPlaying: 'https://np.example/now' })
        ).toBe('https://np.example/now');
        expect(nowPlayingUrl({ source: 'https://x.example/s.ogg' })).toBe(
            'https://x.example/status-json.xsl'
        );
    });

    test('returns null when the status endpoint answers with an http error', async() => {
        let station = { source: 'https://x.example/s.ogg', nowPlaying: '' };
        let fetchImpl = async() => ({ ok: false });
        expect(await fetchNowPlaying(station, fetchImpl)).toBe(null);
    });

    test('propagates network errors so the player can ignore them', async() => {
        let station = { source: 'https://x.example/s.ogg', nowPlaying: '' };
        let fetchImpl = async() => {
            throw new Error('offline');
        };
        await expect(fetchNowPlaying(station, fetchImpl)).rejects.toThrow('offline');
    });

    test('reads a title from a custom now playing url', async() => {
        let station = { source: 'https://x.example/s.ogg', nowPlaying: 'https://np.example/now' };
        let fetchImpl = async() => ({ ok: true, json: async() => ({ title: 'Custom - Track' }) });
        expect(await fetchNowPlaying(station, fetchImpl)).toBe('Custom - Track');
    });
});
