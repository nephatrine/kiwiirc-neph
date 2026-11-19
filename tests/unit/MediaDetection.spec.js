import * as Misc from '@/helpers/Misc';
import { getMediaEmbed } from '@/libs/MediaEmbeds';

describe('Media Detection', () => {
    it('detects native media and preview eligibility', () => {
        expect(Misc.canPreviewUrl('https://example.com/article')).toBe(false);
        expect(Misc.canPreviewUrl('https://example.com/image.jpg')).toBe(true);
        expect(Misc.canPreviewUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
        expect(Misc.canPreviewUrl('')).toBe(false);

        const images = [
            'https://example.com/image.jpg',
            'https://example.com/image.PNG',
            'https://example.com/image.webp?size=large',
            'https://example.com/image.svg#icon',
            'https://example.com/myimage.webp?q=4&u=3',
            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrHGR5kMimgReb0G5AZo4pzZ49iqfda9oYkoCB2_diVw&s',
            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTEepwRvSjAG61VqIb1WAtRTgDM5xZOxVzMLTBtp9wX_g&s=10',
            'https://forme.science/cdn/shop/files/Ergo_Short_-_Obsidian-1_828b38a7-800e-434d-901a-788cad67db6a.webp?v=1770771521',
        ];
        images.forEach((url) => {
            expect(Misc.getMediaInfo(url).type).toBe('image');
        });

        const audio = [
            'https://example.com/music.mp3',
            'https://example.com/podcast.ogg',
            'https://example.com/audio.m4a?dl=1',
            'https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg?utm_source=en.wikipedia.org&utm_campaign=index&utm_content=original',
            'https://stream.rekt.network/rekt.ogg',
        ];
        audio.forEach((url) => {
            expect(Misc.getMediaInfo(url).type).toBe('audio');
        });

        expect(Misc.getMediaInfo('https://example.com/video.mp4').type).toBe('video');
        expect(Misc.getMediaInfo('https://example.com/movie.webm').type).toBe('video');

        const unknown = [
            'https://example.com/page.html',
            'https://example.com/',
            'https://en.wikipedia.org/wiki/File:Example.ogg',
        ];
        unknown.forEach((url) => {
            expect(Misc.getMediaInfo(url).type).toBe('');
        });
    });

    it('detects Reddit and X media previews', () => {
        const post = 'https://share.redd.it/preview/post/1xn1uka?share=iN_gJn8na5a_cY2DpfKId';
        expect(Misc.getMediaInfo(post).type).toBe('image');
        expect(Misc.canPreviewUrl(post)).toBe(true);
        expect(Misc.getMediaInfo('https://share.redd.it/preview/comment/1xn1uka').type)
            .toBe('image');
        expect(Misc.getMediaInfo('https://SHARE.REDD.IT/preview/post/1xn1uka').type)
            .toBe('image');
        expect(Misc.getMediaInfo('https://share.redd.it/preview/post/not-an-id').type)
            .toBe('');
        expect(Misc.getMediaInfo('https://share.redd.it.evil.com/preview/post/1xn1uka').type)
            .toBe('');
        expect(Misc.getMediaInfo('https://share.redd.it/preview/other/1xn1uka').type)
            .toBe('');

        const preview = 'https://jf.x.com/images/media-preview/2115941753798692948';
        expect(Misc.getMediaInfo(preview).type).toBe('image');
        expect(Misc.getMediaInfo(preview + '?format=jpg').type).toBe('image');
        expect(Misc.getMediaInfo('https://JF.X.COM/images/media-preview/2115941753798692948').type)
            .toBe('image');
        expect(Misc.getMediaInfo('https://x.com/images/media-preview/2115941753798692948').type)
            .toBe('image');
        expect(Misc.getMediaInfo(preview + '/').type).toBe('');
        expect(Misc.getMediaInfo('https://jf.x.com/images/media-preview/notanumber').type)
            .toBe('');
        expect(Misc.getMediaInfo('https://notx.com/images/media-preview/2115941753798692948').type)
            .toBe('');
        expect(Misc.getMediaInfo('https://x.com.evil.com/images/media-preview/2115941753798692948').type)
            .toBe('');
    });

    it('detects video, social, and game providers', () => {
        const yt1 = Misc.getMediaInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        expect(yt1.type).toBe('youtube');
        expect(yt1.id).toBe('dQw4w9WgXcQ');

        const yt2 = Misc.getMediaInfo('https://youtu.be/dQw4w9WgXcQ');
        expect(yt2.type).toBe('youtube');
        expect(yt2.id).toBe('dQw4w9WgXcQ');

        const yt3 = Misc.getMediaInfo('https://www.youtube.com/shorts/dQw4w9WgXcQ');
        expect(yt3.type).toBe('youtube-shorts');
        expect(yt3.id).toBe('dQw4w9WgXcQ');

        const playlist = Misc.getMediaInfo(
            'https://www.youtube.com/playlist?list=PL1234567890abcdef'
        );
        expect(playlist.type).toBe('youtube-playlist');
        expect(playlist.id).toBe('PL1234567890abcdef');

        const clip = Misc.getMediaInfo(
            'https://clips.twitch.tv/ObeseUnusualSnakeEagleEye-i9me5X1TK9hA9Y_D'
        );
        expect(clip.type).toBe('twitch-clip');
        expect(clip.id).toBe('ObeseUnusualSnakeEagleEye-i9me5X1TK9hA9Y_D');

        const channel = Misc.getMediaInfo('https://www.twitch.tv/twitchdev');
        expect(channel.type).toBe('twitch-channel');
        expect(channel.id).toBe('twitchdev');

        const vod = Misc.getMediaInfo('https://www.twitch.tv/videos/123456789');
        expect(vod.type).toBe('twitch-video');
        expect(vod.id).toBe('123456789');
        expect(Misc.getMediaInfo('https://www.twitch.tv/directory').type).toBe('');

        expect(Misc.getMediaInfo('https://mastodon.social/@Mastodon/110915610817025827').type)
            .toBe('fediverse');
        expect(Misc.getMediaInfo('https://example.com/users/user/statuses/12345').type)
            .toBe('fediverse');

        const giphy1 = Misc.getMediaInfo('https://giphy.com/gifs/funny-cat-3o7TKMGVp6n_s');
        expect(giphy1.type).toBe('giphy');
        expect(giphy1.id).toBe('3o7TKMGVp6n_s');
        const giphy2 = Misc.getMediaInfo('https://giphy.com/gifs/3o7TKMGVp6n_s');
        expect(giphy2.type).toBe('giphy');
        expect(giphy2.id).toBe('3o7TKMGVp6n_s');

        const streamable1 = Misc.getMediaInfo('https://streamable.com/moo');
        expect(streamable1.type).toBe('streamable');
        expect(streamable1.id).toBe('moo');
        const streamable2 = Misc.getMediaInfo('https://streamable.com/s/a0vpwa');
        expect(streamable2.type).toBe('streamable');
        expect(streamable2.id).toBe('a0vpwa');

        const redgifs = Misc.getMediaInfo('https://www.redgifs.com/watch/id');
        expect(redgifs.type).toBe('redgifs');
        expect(redgifs.id).toBe('id');

        const steam = Misc.getMediaInfo('https://store.steampowered.com/app/220/Half-Life_2/');
        expect(steam.type).toBe('steam');
        expect(steam.id).toBe('220');
    });

    it('detects Imgur, Spotify, and SoundCloud', () => {
        const imgur1 = Misc.getMediaInfo('https://imgur.com/gallery/idabcde');
        expect(imgur1.type).toBe('imgur');
        expect(imgur1.id).toBe('idabcde');
        const imgur2 = Misc.getMediaInfo('https://imgur.com/a/idabcde');
        expect(imgur2.type).toBe('imgur');
        expect(imgur2.id).toBe('idabcde');
        const imgur3 = Misc.getMediaInfo('https://imgur.com/idabcde');
        expect(imgur3.type).toBe('image');
        expect(imgur3.url).toBe('https://i.imgur.com/idabcde.png');
        const imgur4 = Misc.getMediaInfo(
            'https://imgur.com/gallery/happy-national-columbo-day-yall-oh-wait-ChiTNd2#Bda2imW'
        );
        expect(imgur4.type).toBe('image');
        expect(imgur4.url).toBe('https://i.imgur.com/Bda2imW.png');
        const imgur5 = Misc.getMediaInfo(
            'https://imgur.com/gallery/happy-national-columbo-day-yall-oh-wait-ChiTNd2'
        );
        expect(imgur5.type).toBe('imgur');
        expect(imgur5.id).toBe('ChiTNd2');
        expect(Misc.getMediaInfo('https://imgur.com/about').type).toBe('');

        const sp1 = Misc.getMediaInfo(
            'https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDw0G?si=abc123'
        );
        expect(sp1.type).toBe('spotify');
        expect(sp1.id).toBe('track/6rqhFgbbKwnb9MLmUQDw0G');
        const sp2 = Misc.getMediaInfo('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
        expect(sp2.type).toBe('spotify');
        expect(sp2.id).toBe('playlist/37i9dQZF1DXcBWIGoYBM5M');
        const sp3 = Misc.getMediaInfo('https://open.spotify.com/intl-de/album/599xhK1ZXXm3ovMQLY9YaU');
        expect(sp3.type).toBe('spotify');
        expect(sp3.id).toBe('album/599xhK1ZXXm3ovMQLY9YaU');
        const sp4 = Misc.getMediaInfo('https://open.spotify.com/episode/5XtQJkCq3PqK4nF8vL2mNp');
        expect(sp4.type).toBe('spotify');
        expect(sp4.id).toBe('episode/5XtQJkCq3PqK4nF8vL2mNp');
        expect(Misc.getMediaInfo('https://open.spotify.com/search/results?query=foo').type)
            .toBe('');
        expect(Misc.getMediaInfo('https://spotify.link/abcXYZ').type).toBe('');

        const sc1 = Misc.getMediaInfo(
            'https://soundcloud.com/lofi-girl/lofi-hip-hop-radio-beats-to-relaxstudy-to'
        );
        expect(sc1.type).toBe('soundcloud');
        expect(sc1.id).toBe('lofi-girl/lofi-hip-hop-radio-beats-to-relaxstudy-to');
        const sc2 = Misc.getMediaInfo('https://soundcloud.com/artist/sets/album-name?si=abc');
        expect(sc2.type).toBe('soundcloud');
        expect(sc2.id).toBe('artist/sets/album-name');
        expect(Misc.getMediaInfo('https://soundcloud.com/artist-name').type).toBe('');
        expect(Misc.getMediaInfo('https://soundcloud.com/artist-name/likes').type).toBe('');
        expect(Misc.getMediaInfo('https://on.soundcloud.com/abcXYZ123').type).toBe('');
    });
});

describe('curated media embeds', () => {
    it('builds embeds for supported providers', () => {
        let embed = getMediaEmbed('https://www.ted.com/talks/a_talk?language=en');
        expect(embed).toMatchObject({
            type: 'embed',
            provider: 'ted',
            id: 'a_talk',
            src: 'https://embed.ted.com/talks/a_talk',
            aspectRatio: '16 / 9',
        });
        expect(getMediaEmbed('https://www.ted.com/dubbing/a_talk').src)
            .toBe('https://embed.ted.com/talks/a_talk');

        const mixcloudUrl = 'https://www.mixcloud.com/sohoradio/dub-on-air-with-dennis-bovell/';
        embed = getMediaEmbed(mixcloudUrl);
        expect(embed).toMatchObject({
            type: 'embed',
            provider: 'mixcloud',
            id: 'sohoradio/dub-on-air-with-dennis-bovell',
            height: '120px',
        });
        expect(embed.src).toContain('https://www.mixcloud.com/widget/iframe/');
        expect(embed.src).toContain(encodeURIComponent(mixcloudUrl));

        expect(getMediaEmbed('https://appsumo.wistia.com/medias/fudkgyoejs')).toMatchObject({
            provider: 'wistia',
            id: 'fudkgyoejs',
            src: 'https://fast.wistia.net/embed/iframe/fudkgyoejs',
        });
        expect(getMediaEmbed('https://fast.wistia.net/embed/iframe/fudkgyoejs').src)
            .toBe('https://fast.wistia.net/embed/iframe/fudkgyoejs');

        expect(getMediaEmbed('https://www.loom.com/share/0808e55f94a24992b2de488ac56d3815'))
            .toMatchObject({
                provider: 'loom',
                id: '0808e55f94a24992b2de488ac56d3815',
                src: 'https://www.loom.com/embed/0808e55f94a24992b2de488ac56d3815',
            });

        expect(getMediaEmbed('https://art19.com/shows/intercom-on-product-management'))
            .toMatchObject({
                provider: 'art19',
                src: 'https://art19.com/shows/intercom-on-product-management/embed',
                height: '180px',
            });
        expect(getMediaEmbed(
            'https://art19.com/shows/intercom-on-product-management/' +
            'episodes/5801ff9e-51ba-4e15-a284-5069751c6bed'
        )).toMatchObject({
            src: 'https://art19.com/shows/intercom-on-product-management/' +
                'episodes/5801ff9e-51ba-4e15-a284-5069751c6bed/embed',
        });

        expect(getMediaEmbed('https://www.pinterest.com/pin/123456789012345678/'))
            .toMatchObject({
                provider: 'pinterest',
                id: '123456789012345678',
                src: 'https://assets.pinterest.com/ext/embed.html?id=123456789012345678',
                maxWidth: '450px',
            });

        expect(getMediaEmbed('https://www.tiktok.com/@scout2015/video/6718335390845095173'))
            .toMatchObject({
                provider: 'tiktok',
                id: '6718335390845095173',
                src: 'https://www.tiktok.com/player/v1/6718335390845095173',
                aspectRatio: '9 / 16',
                maxWidth: '360px',
            });
        expect(Misc.getMediaInfo(
            'https://www.tiktok.com/@scout2015/photo/6718335390845095173'
        ).type).toBe('embed');

        expect(getMediaEmbed('https://prezi.com/abc123def456/some-prezi/')).toMatchObject({
            provider: 'prezi',
            id: 'abc123def456',
            src: 'https://prezi.com/embed/abc123def456/',
        });

        embed = getMediaEmbed('https://www.openstreetmap.org/#map=12/50.2598/28.6695');
        expect(embed).toMatchObject({
            provider: 'openstreetmap',
            id: '50.2598,28.6695',
        });
        expect(embed.src).toContain('https://www.openstreetmap.org/export/embed.html');
        expect(embed.src).toContain('marker=50.2598,28.6695');

        expect(getMediaEmbed('https://yandex.com/maps/?ll=37.624027%2C55.753512&z=14'))
            .toMatchObject({
                provider: 'yandex-maps',
                id: '55.753512,37.624027',
                src: 'https://yandex.com/map-widget/v1/?ll=37.624027%2C55.753512&z=14',
            });
    });

    it('leaves unsupported or invalid providers alone', () => {
        expect(getMediaEmbed('https://www.mixcloud.com/discover/')).toBeNull();
        expect(getMediaEmbed('https://www.openstreetmap.org/')).toBeNull();
        expect(getMediaEmbed('https://www.openstreetmap.org/node/123')).toBeNull();
        expect(getMediaEmbed('https://example.com/video/123')).toBeNull();
        expect(getMediaEmbed('https://vm.tiktok.com/ZM123456/')).toBeNull();
    });
});
