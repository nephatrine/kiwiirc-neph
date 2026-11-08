import {
    APP_FRAME_SOURCE,
    addAppFrameAncestor,
    allowAppFrameAncestor
} from '../../desktop/electron/twitch-embed-policy';

describe('Desktop Twitch CSP', () => {
    it('allows the app scheme in Twitch frame-ancestors', () => {
        const csp = 'frame-ancestors http://localhost:* https://localhost:*';

        expect(allowAppFrameAncestor(csp))
            .toBe('frame-ancestors http://localhost:* https://localhost:* ' + APP_FRAME_SOURCE);
    });

    it('preserves unrelated directives', () => {
        const csp = "default-src 'self'; frame-ancestors https://example.com; " +
            "script-src 'self'";

        expect(allowAppFrameAncestor(csp)).toBe(
            "default-src 'self'; frame-ancestors https://example.com app:; " +
                "script-src 'self'"
        );
    });

    it('does not duplicate the app scheme', () => {
        const csp = 'frame-ancestors http://localhost:* app:';

        expect(allowAppFrameAncestor(csp)).toBe(csp);
    });

    it('leaves a policy without frame-ancestors unchanged', () => {
        const csp = "default-src 'self'; script-src 'self'";

        expect(allowAppFrameAncestor(csp)).toBe(csp);
    });

    it('updates only the CSP header and preserves its casing', () => {
        const headers = {
            'Content-Type': 'text/html',
            'content-security-policy': [
                'frame-ancestors https://localhost:*',
            ],
        };
        const result = addAppFrameAncestor(headers);

        expect(result['Content-Type']).toBe('text/html');
        expect(result['content-security-policy']).toEqual([
            'frame-ancestors https://localhost:* app:',
        ]);
    });

    it('handles a string CSP header', () => {
        const result = addAppFrameAncestor({
            'Content-Security-Policy': 'frame-ancestors https://localhost:*',
        });

        expect(result['Content-Security-Policy'])
            .toBe('frame-ancestors https://localhost:* app:');
    });
});
