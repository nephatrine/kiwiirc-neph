import SaslScram from '@/libs/SaslScram';

// Mock Web Crypto API for Node environment
const { webcrypto } = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

global.crypto = webcrypto;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('SaslScram', () => {
    it('should generate a valid client-first-message', () => {
        const scram = new SaslScram('user', 'password');
        const firstMsg = scram.getClientFirstMessage();
        expect(firstMsg).toMatch(/^n,,n=user,r=[a-zA-Z0-9+/=_-]+$/);
    });

    it('should handle server-first-message and generate client-final-message', async() => {
        const scram = new SaslScram('user', 'password');
        const clientNonce = scram.nonce;

        // Mock server response
        // r=clientNonce + serverNonce, s=salt, i=iterations
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

    it('should fail on invalid server nonce', async() => {
        const scram = new SaslScram('user', 'password');
        const serverFirst = 'r=invalid_nonce,s=QSXCR+Q6sek8bf92,i=4096';
        await expect(scram.handleServerFirst(serverFirst)).rejects.toThrow('Invalid server nonce');
    });

    it('should fail on invalid server signature', async() => {
        const scram = new SaslScram('user', 'password');
        const clientNonce = scram.nonce;
        const serverFirst = `r=${clientNonce}nonce,s=QSXCR+Q6sek8bf92,i=4096`;
        await scram.handleServerFirst(serverFirst);

        const serverFinal = 'v=invalid_signature';
        await expect(scram.handleServerFinal(serverFinal)).rejects.toThrow('Invalid server signature');
    });
});
