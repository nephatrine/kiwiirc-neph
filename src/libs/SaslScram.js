'kiwi public';

/**
 * SASL SCRAM-SHA-256 implementation using Web Crypto API.
 * Ref: https://tools.ietf.org/html/rfc7677
 */

export default class SaslScram {
    constructor(username, password) {
        this.username = username.replace(/=/g, '=3D').replace(/,/g, '=2C');
        this.password = password;
        this.nonce = this.generateNonce();
        this.clientFirstMessageBare = `n=${this.username},r=${this.nonce}`;
        this.gs2Header = 'n,,';
        this.state = 'INITIAL';

        this.serverFirstMessage = '';
        this.clientFinalMessageWithoutProof = '';
        this.saltedPassword = null;
    }

    generateNonce() {
        const array = new Uint8Array(16);
        (window.crypto || crypto).getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    getClientFirstMessage() {
        this.state = 'FIRST_SENT';
        return this.gs2Header + this.clientFirstMessageBare;
    }

    async handleServerFirst(serverFirstMessage) {
        this.serverFirstMessage = serverFirstMessage;
        const params = this.parseMessage(serverFirstMessage);
        const serverNonce = params.r;
        const salt = params.s;
        const iterations = parseInt(params.i, 10);

        if (!serverNonce || !serverNonce.startsWith(this.nonce)) {
            throw new Error('Invalid server nonce');
        }

        const saltUint8 = this.base64ToUint8(salt);
        this.saltedPassword = await this.deriveSaltedPassword(this.password, saltUint8, iterations);

        this.clientFinalMessageWithoutProof = `c=${btoa(this.gs2Header)},r=${serverNonce}`;
        const authMessage = `${this.clientFirstMessageBare},${this.serverFirstMessage},` +
            `${this.clientFinalMessageWithoutProof}`;

        const clientProof = await this.computeClientProof(this.saltedPassword, authMessage);
        this.state = 'FINAL_SENT';

        return `${this.clientFinalMessageWithoutProof},p=${clientProof}`;
    }

    async handleServerFinal(serverFinalMessage) {
        const params = this.parseMessage(serverFinalMessage);
        const serverSignature = params.v;

        const authMessage = `${this.clientFirstMessageBare},${this.serverFirstMessage},` +
            `${this.clientFinalMessageWithoutProof}`;
        const expectedServerSignature = await this.computeServerSignature(
            this.saltedPassword,
            authMessage
        );

        if (serverSignature !== expectedServerSignature) {
            throw new Error('Invalid server signature');
        }

        this.state = 'COMPLETED';
    }

    parseMessage(msg) {
        const params = {};
        msg.split(',').forEach((part) => {
            const [key, ...value] = part.split('=');
            params[key] = value.join('=');
        });
        return params;
    }

    async deriveSaltedPassword(password, salt, iterations) {
        const encoder = new TextEncoder();
        const passwordKey = await (window.crypto || crypto).subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );

        const saltedPasswordBits = await window.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt,
                iterations,
                hash: 'SHA-256',
            },
            passwordKey,
            256
        );

        return new Uint8Array(saltedPasswordBits);
    }

    async computeClientProof(saltedPassword, authMessage) {
        const clientKey = await this.hmac(saltedPassword, 'Client Key');
        const storedKey = await this.hash(clientKey);
        const clientSignature = await this.hmac(storedKey, authMessage);

        const clientProof = new Uint8Array(clientKey.length);
        for (let i = 0; i < clientKey.length; i++) {
            /* eslint-disable no-bitwise */
            clientProof[i] = clientKey[i] ^ clientSignature[i];
            /* eslint-enable no-bitwise */
        }

        return this.uint8ToBase64(clientProof);
    }

    async computeServerSignature(saltedPassword, authMessage) {
        const serverKey = await this.hmac(saltedPassword, 'Server Key');
        const serverSignature = await this.hmac(serverKey, authMessage);
        return this.uint8ToBase64(serverSignature);
    }

    async hmac(key, data) {
        const encoder = new TextEncoder();
        const cryptoKey = await window.crypto.subtle.importKey(
            'raw',
            key,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signature = await window.crypto.subtle.sign(
            'HMAC',
            cryptoKey,
            typeof data === 'string' ? encoder.encode(data) : data
        );
        return new Uint8Array(signature);
    }

    async hash(data) {
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(digest);
    }

    base64ToUint8(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    uint8ToBase64(uint8) {
        let binary = '';
        const len = uint8.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        return btoa(binary);
    }
}
