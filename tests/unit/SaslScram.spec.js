import SaslScram from '@/libs/SaslScram';

// Mock Web Crypto API for Node environment.
// jsdom already defines a crypto object without the subtle API, so it has to
// be replaced with a property definition rather than assigned to.
const { webcrypto } = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

Object.defineProperty(window, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
});

window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('SaslScram', () => {
    it('generates client-first and client-final messages', async() => {
        const scram = new SaslScram('user', 'password');
        const firstMsg = scram.getClientFirstMessage();
        expect(firstMsg).toMatch(/^n,,n=user,r=[a-zA-Z0-9+/=_-]+$/);

        const clientNonce = scram.nonce;
        const serverNonce = '3rfcNHYJY1ZVvWVs7j';
        const salt = 'QSXCR+Q6sek8bf92';
        const iterations = 4096;
        const serverFirst = `r=${clientNonce}${serverNonce},s=${salt},i=${iterations}`;

        const clientFinal = await scram.handleServerFirst(serverFirst);

        expect(clientFinal).toContain(`c=${btoa('n,,')}`);
        expect(clientFinal).toContain(`r=${clientNonce}${serverNonce}`);
        expect(clientFinal).toMatch(/,p=[a-zA-Z0-9+/=]+$/);
    });

    it('should verify server-final-message', async() => {
        const scram = new SaslScram('user', 'password');
        const clientNonce = scram.nonce;

        const serverNonce = '3rfcNHYJY1ZVvWVs7j';
        const salt = 'QSXCR+Q6sek8bf92';
        const iterations = 4096;
        const serverFirst = `r=${clientNonce}${serverNonce},s=${salt},i=${iterations}`;

        await scram.handleServerFirst(serverFirst);

        // Compute expected server signature to mock it
        const authMessage = `${scram.clientFirstMessageBare},${scram.serverFirstMessage},` +
            `${scram.clientFinalMessageWithoutProof}`;
        const serverSignature = await scram.computeServerSignature(
            scram.saltedPassword,
            authMessage
        );

        const serverFinal = `v=${serverSignature}`;
        await expect(scram.handleServerFinal(serverFinal)).resolves.not.toThrow();
        expect(scram.state).toBe('COMPLETED');
    });

    it('rejects an invalid nonce or server signature', async() => {
        let scram = new SaslScram('user', 'password');
        await expect(scram.handleServerFirst(
            'r=invalid_nonce,s=QSXCR+Q6sek8bf92,i=4096'
        )).rejects.toThrow('Invalid server nonce');

        scram = new SaslScram('user', 'password');
        const clientNonce = scram.nonce;
        await scram.handleServerFirst(
            `r=${clientNonce}nonce,s=QSXCR+Q6sek8bf92,i=4096`
        );

        await expect(scram.handleServerFinal('v=invalid_signature'))
            .rejects.toThrow('Invalid server signature');
    });
});
