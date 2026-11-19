import {
    APP_FRAME_SOURCE,
    addAppFrameAncestor,
    allowAppFrameAncestor
} from '../../desktop/electron/twitch-embed-policy';

describe('Desktop Twitch CSP', () => {
    it('allows the app scheme without duplicating or touching other policies', () => {
        let csp = 'frame-ancestors http://localhost:* https://localhost:*';

        expect(allowAppFrameAncestor(csp))
            .toBe('frame-ancestors http://localhost:* https://localhost:* ' + APP_FRAME_SOURCE);

        csp = "default-src 'self'; frame-ancestors https://example.com; " +
            "script-src 'self'";

        expect(allowAppFrameAncestor(csp)).toBe(
            "default-src 'self'; frame-ancestors https://example.com app:; " +
                "script-src 'self'"
        );

        csp = 'frame-ancestors http://localhost:* app:';
        expect(allowAppFrameAncestor(csp)).toBe(csp);

        csp = "default-src 'self'; script-src 'self'";
        expect(allowAppFrameAncestor(csp)).toBe(csp);
    });

    it('updates only the CSP header for arrays and strings', () => {
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

        const stringResult = addAppFrameAncestor({
            'Content-Security-Policy': 'frame-ancestors https://localhost:*',
        });

        expect(stringResult['Content-Security-Policy'])
            .toBe('frame-ancestors https://localhost:* app:');
    });
});
