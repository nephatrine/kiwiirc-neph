import * as Misc from '@/helpers/Misc';

describe('Media Detection', () => {
    it('should detect images', () => {
        expect(Misc.getMediaInfo('https://example.com/image.jpg').type).toBe('image');
        expect(Misc.getMediaInfo('https://example.com/image.PNG').type).toBe('image');
        expect(Misc.getMediaInfo('https://example.com/image.webp?size=large').type).toBe('image');
        expect(Misc.getMediaInfo('https://example.com/image.svg#icon').type).toBe('image');
        expect(Misc.getMediaInfo('https://example.com/myimage.webp?q=4&u=3').type).toBe('image');
        const googleThumb = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrHGR5kMimgReb0G5AZo4pzZ49iqfda9oYkoCB2_diVw&s';
        expect(Misc.getMediaInfo(googleThumb).type).toBe('image');
        const googleThumb2 = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTEepwRvSjAG61VqIb1WAtRTgDM5xZOxVzMLTBtp9wX_g&s=10';
        expect(Misc.getMediaInfo(googleThumb2).type).toBe('image');
        const formeScience = 'https://forme.science/cdn/shop/files/Ergo_Short_-_Obsidian-1_828b38a7-800e-434d-901a-788cad67db6a.webp?v=1770771521';
        expect(Misc.getMediaInfo(formeScience).type).toBe('image');
    });

    it('should detect audio', () => {
        expect(Misc.getMediaInfo('https://example.com/music.mp3').type).toBe('audio');
        expect(Misc.getMediaInfo('https://example.com/podcast.ogg').type).toBe('audio');
        expect(Misc.getMediaInfo('https://example.com/audio.m4a?dl=1').type).toBe('audio');
        expect(Misc.getMediaInfo('https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg?utm_source=en.wikipedia.org&utm_campaign=index&utm_content=original').type).toBe('audio');
        expect(Misc.getMediaInfo('https://stream.rekt.network/rekt.ogg').type).toBe('audio');
    });

    it('should detect video', () => {
        expect(Misc.getMediaInfo('https://example.com/video.mp4').type).toBe('video');
        expect(Misc.getMediaInfo('https://example.com/movie.webm').type).toBe('video');
    });

    it('should detect YouTube videos', () => {
        const yt1 = Misc.getMediaInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        expect(yt1.type).toBe('youtube');
        expect(yt1.id).toBe('dQw4w9WgXcQ');

        const yt2 = Misc.getMediaInfo('https://youtu.be/dQw4w9WgXcQ');
        expect(yt2.type).toBe('youtube');
        expect(yt2.id).toBe('dQw4w9WgXcQ');

        const yt3 = Misc.getMediaInfo('https://www.youtube.com/shorts/dQw4w9WgXcQ');
        expect(yt3.type).toBe('youtube-shorts');
        expect(yt3.id).toBe('dQw4w9WgXcQ');
    });

    it('should detect Twitch clips and channels', () => {
        const clip1 = Misc.getMediaInfo('https://clips.twitch.tv/ObeseUnusualSnakeEagleEye-i9me5X1TK9hA9Y_D');
        expect(clip1.type).toBe('twitch-clip');
        expect(clip1.id).toBe('ObeseUnusualSnakeEagleEye-i9me5X1TK9hA9Y_D');

        const channel1 = Misc.getMediaInfo('https://www.twitch.tv/twitchdev');
        expect(channel1.type).toBe('twitch-channel');
        expect(channel1.id).toBe('twitchdev');

        // Should not match directory etc.
        expect(Misc.getMediaInfo('https://www.twitch.tv/directory').type).toBe('');
    });

    it('should detect Fediverse posts', () => {
        expect(Misc.getMediaInfo('https://mastodon.social/@Mastodon/110915610817025827').type).toBe('fediverse');
        expect(Misc.getMediaInfo('https://example.com/users/user/statuses/12345').type).toBe('fediverse');
    });

    it('should detect Giphy', () => {
        const giphy1 = Misc.getMediaInfo('https://giphy.com/gifs/funny-cat-3o7TKMGVp6n_s');
        expect(giphy1.type).toBe('giphy');
        expect(giphy1.id).toBe('3o7TKMGVp6n_s');

        const giphy2 = Misc.getMediaInfo('https://giphy.com/gifs/3o7TKMGVp6n_s');
        expect(giphy2.type).toBe('giphy');
        expect(giphy2.id).toBe('3o7TKMGVp6n_s');
    });

    it('should detect Streamable', () => {
        const streamable1 = Misc.getMediaInfo('https://streamable.com/moo');
        expect(streamable1.type).toBe('streamable');
        expect(streamable1.id).toBe('moo');

        const streamable2 = Misc.getMediaInfo('https://streamable.com/s/a0vpwa');
        expect(streamable2.type).toBe('streamable');
        expect(streamable2.id).toBe('a0vpwa');
    });

    it('should detect RedGifs', () => {
        const redgifs = Misc.getMediaInfo('https://www.redgifs.com/watch/id');
        expect(redgifs.type).toBe('redgifs');
        expect(redgifs.id).toBe('id');
    });

    it('should detect Steam Store', () => {
        const steam = Misc.getMediaInfo('https://store.steampowered.com/app/220/Half-Life_2/');
        expect(steam.type).toBe('steam');
        expect(steam.id).toBe('220');
    });

    it('should detect Imgur', () => {
        const imgur1 = Misc.getMediaInfo('https://imgur.com/gallery/idabcde');
        expect(imgur1.type).toBe('');

        const imgur2 = Misc.getMediaInfo('https://imgur.com/a/idabcde');
        expect(imgur2.type).toBe('');

        const imgur3 = Misc.getMediaInfo('https://imgur.com/idabcde');
        expect(imgur3.type).toBe('image');
        expect(imgur3.url).toBe('https://i.imgur.com/idabcde.png');

        const imgur4 = Misc.getMediaInfo('https://imgur.com/gallery/happy-national-columbo-day-yall-oh-wait-ChiTNd2#Bda2imW');
        expect(imgur4.type).toBe('image');
        expect(imgur4.url).toBe('https://i.imgur.com/Bda2imW.png');

        const imgur5 = Misc.getMediaInfo('https://imgur.com/gallery/happy-national-columbo-day-yall-oh-wait-ChiTNd2');
        expect(imgur5.type).toBe('');

        // Should not match excluded
        expect(Misc.getMediaInfo('https://imgur.com/about').type).toBe('');
    });

    it('should return empty for unknown URLs', () => {
        expect(Misc.getMediaInfo('https://example.com/page.html').type).toBe('');
        expect(Misc.getMediaInfo('https://example.com/').type).toBe('');
        expect(Misc.getMediaInfo('https://en.wikipedia.org/wiki/File:Example.ogg').type).toBe('');
    });
});
