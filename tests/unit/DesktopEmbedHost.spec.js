import {
    DESKTOP_EMBED_HOST,
    embedParentHostname
} from '@/libs/desktop/Embed';

describe('Desktop embed hostname', () => {
    afterEach(() => {
        delete window.kiwiDesktop;
    });

    it('uses the web hostname without the desktop bridge', () => {
        expect(embedParentHostname()).toBe(window.location.hostname);
    });

    it('uses the canonical host inside the desktop shell', () => {
        window.kiwiDesktop = { version: 'test' };
        expect(embedParentHostname()).toBe(DESKTOP_EMBED_HOST);
        expect(DESKTOP_EMBED_HOST).toBe('localhost');
    });
});
