import Fish from '../../static/plugins/fish/crypto';
import vectors from '../fixtures/fish/vectors.json';

/* Blowfish test vectors are expressed as 32 bit words, so this suite needs the
   same bit twiddling the cipher itself uses. */
/* eslint-disable no-bitwise */

function hexToBytes(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out;
}

function bytesToHex(bytes) {
    return Array.from(bytes)
        .map((byte) => (byte < 16 ? '0' : '') + byte.toString(16))
        .join('');
}

function bytesToBigInt(bytes) {
    let value = BigInt(0);
    for (let i = 0; i < bytes.length; i++) {
        value = (value << BigInt(8)) | BigInt(bytes[i]);
    }
    return value;
}

function bigIntToBytes(value) {
    let hex = value.toString(16);
    if (hex.length % 2) {
        hex = '0' + hex;
    }
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out;
}

function encryptBlock(key, plainHex) {
    const cipher = new Fish.Blowfish(Fish.utf8Encode(key));
    const left = parseInt(plainHex.slice(0, 8), 16) >>> 0;
    const right = parseInt(plainHex.slice(8), 16) >>> 0;
    const out = cipher.encryptWords(left, right);
    const hex = (value) => (value >>> 0).toString(16).padStart(8, '0');
    return hex(out[0]) + hex(out[1]);
}

// A key whose bytes vary, so that the key length actually changes the schedule.
const KEY_PATTERN = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$';

function patternedKey(length) {
    let out = '';
    while (out.length < length) {
        out += KEY_PATTERN;
    }
    return out.slice(0, length);
}

describe('FiSH Blowfish', () => {
    // Eric Young's published Blowfish test vectors, as raw key bytes.
    const known = [
        ['0000000000000000', '0000000000000000', '4ef997456198dd78'],
        ['ffffffffffffffff', 'ffffffffffffffff', '51866fd5b85ecb8a'],
        ['0123456789abcdef', '1111111111111111', '61f9c3802281b096'],
        ['fedcba9876543210', '0123456789abcdef', '0aceab0fc6a0a28d'],
        ['7ca110454a1a6e57', '01a1d6d039776742', '59c68245eb05282b'],
    ];

    known.forEach(([keyHex, plainHex, expected]) => {
        it(`encrypts and decrypts the block for key ${keyHex}`, () => {
            const cipher = new Fish.Blowfish(hexToBytes(keyHex));
            const left = parseInt(plainHex.slice(0, 8), 16) >>> 0;
            const right = parseInt(plainHex.slice(8), 16) >>> 0;

            const words = cipher.encryptWords(left, right);
            const hex = (value) => (value >>> 0).toString(16).padStart(8, '0');
            expect(hex(words[0]) + hex(words[1])).toBe(expected);

            const back = cipher.decryptWords(words[0], words[1]);
            expect(hex(back[0]) + hex(back[1])).toBe(plainHex);
        });
    });

    it('rejects an empty key', () => {
        expect(() => new Fish.Blowfish(new Uint8Array(0))).toThrow();
    });
});

describe('FiSH key schedule', () => {
    // Golden values from OpenSSL's BF_set_key, the schedule mIRC FiSH 10 and
    // ZNC use: encrypt one zero block and compare. Values beyond 72 bytes are
    // identical to 72 because the key is truncated there.
    const zeroBlock = [
        [55, 'd62d2670a7bc01e3'],
        [56, 'fc31c6f6d810c94f'],
        [57, '18ce02d8b9fb6d87'],
        [60, '284172ade9e20e02'],
        [72, '42685c7c365d42df'],
        [73, '42685c7c365d42df'],
        [200, '42685c7c365d42df'],
    ];

    zeroBlock.forEach(([length, expected]) => {
        it(`matches OpenSSL for a ${length} byte key`, () => {
            const key = patternedKey(length);
            expect(encryptBlock(key, '0000000000000000')).toBe(expected);
        });
    });

    it('documents the 56 and 72 byte limits', () => {
        expect(Fish.SPEC_MAX_KEY_BYTES).toBe(56);
        expect(Fish.MAX_KEY_BYTES).toBe(72);
    });
});

describe('FiSH helpers', () => {
    it('hashes with SHA-256', () => {
        expect(bytesToHex(Fish.sha256(Fish.utf8Encode('')))).toBe(
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        );
        expect(bytesToHex(Fish.sha256(Fish.utf8Encode('abc')))).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        );
    });

    it('round trips UTF-8, including astral characters', () => {
        ['hello', '⚷ fish', 'ünïcode', '日本語', '😀 emoji'].forEach((value) => {
            expect(Fish.utf8Decode(Fish.utf8Encode(value))).toBe(value);
        });
    });

    it('encodes and decodes standard base64', () => {
        ['', 'a', 'ab', 'abc', 'hello world'].forEach((value) => {
            const encoded = Fish.stdBase64Encode(Fish.utf8Encode(value));
            expect(encoded).toBe(Buffer.from(value).toString('base64'));
            expect(Fish.utf8Decode(Fish.stdBase64Decode(encoded))).toBe(value);
        });
    });

    it('accepts padded and unpadded base64', () => {
        const plain = Fish.utf8Encode('abcdefgh');
        const encoded = Fish.stdBase64Encode(plain);

        expect(bytesToHex(Fish.stdBase64Decode(encoded))).toBe(bytesToHex(plain));
        expect(bytesToHex(Fish.stdBase64Decode(encoded.replace(/=+$/, ''))))
            .toBe(bytesToHex(plain));
        expect(bytesToHex(Fish.stdBase64Decode(' ' + encoded + ' ')))
            .toBe(bytesToHex(plain));
    });

    it('round trips FiSH base64 in eight byte groups', () => {
        const encoded = Fish.fishBase64Encode(Fish.utf8Encode('qwertyui'));
        // Twelve characters per eight bytes: the right 32-bit word first, then
        // the left one, each emitting its low six bits first.
        expect(encoded).toHaveLength(12);
        expect(encoded).toBe('DjlsO/MjQrL/');
        expect(bytesToHex(Fish.fishBase64Decode(encoded))).toBe(
            bytesToHex(Fish.utf8Encode('qwertyui'))
        );
    });
});

describe('FiSH wire prefixes', () => {
    const ecbPayload = 'A'.repeat(12);
    const cbcPayload = 'A'.repeat(24);

    it('parses the documented prefixes', () => {
        expect(Fish.parsePayload('+OK ' + ecbPayload))
            .toEqual({ mode: 'ecb', payload: ecbPayload });
        expect(Fish.parsePayload('mcps ' + ecbPayload))
            .toEqual({ mode: 'ecb', payload: ecbPayload });
        expect(Fish.parsePayload('+OK *' + cbcPayload))
            .toEqual({ mode: 'cbc', payload: cbcPayload });
        expect(Fish.parsePayload('mcps *' + cbcPayload))
            .toEqual({ mode: 'cbc', payload: cbcPayload });
    });

    it('rejects text that is not encrypted', () => {
        expect(Fish.parsePayload('hello')).toBeNull();
        expect(Fish.parsePayload('+OKAY')).toBeNull();
        expect(Fish.parsePayload('')).toBeNull();
        expect(Fish.parsePayload('mspc abc')).toBeNull();
        expect(Fish.isEncryptedText('hello')).toBe(false);
        expect(Fish.isEncryptedText('+OK ' + ecbPayload)).toBe(true);

        // Too short to be a cipher block: plain chat that happens to start
        // with a prefix must stay visible.
        ['+OK thanks', '+OK ok', '+OK *', '+OK * abc', 'mcps * abc']
            .forEach((value) => {
                expect(Fish.parsePayload(value)).toBeNull();
                expect(Fish.isEncryptedText(value)).toBe(false);
            });
    });

    it('marks whitespace after the CBC marker as malformed', () => {
        const longPayload = 'A'.repeat(24);
        [
            '+OK * ' + longPayload,
            'mcps * ' + longPayload,
            '+OK *' + 'A'.repeat(12) + ' ' + 'A'.repeat(12),
        ].forEach((value) => {
            const parsed = Fish.parsePayload(value);
            expect(parsed).not.toBeNull();
            expect(parsed.invalid).toBe(true);
            expect(parsed.payload).toBe('');
            expect(Fish.isEncryptedText(value)).toBe(true);
        });
    });

    it('rejects a payload that cannot be base64', () => {
        expect(Fish.parsePayload('+OK ' + '!'.repeat(12)).invalid).toBe(true);
        expect(Fish.parsePayload('+OK 123456789012').invalid).toBeUndefined();
    });
});

describe('FiSH payload vectors', () => {
    // The reference implementations agree byte-for-byte; these are also the
    // regression guard for the custom base64 word order.
    it('matches the reference ECB vectors', () => {
        const supported = vectors.blowfish.ecb.filter((item) => item.wire);
        expect(supported.length).toBeGreaterThanOrEqual(5);

        supported.forEach((item) => {
            expect(Fish.encryptECB(item.key, item.plain)).toBe(item.wire);
            const parsed = Fish.parsePayload(item.wire);
            expect(parsed.mode).toBe('ecb');
            expect(Fish.decryptECB(item.key, parsed.payload)).toBe(item.plain);
        });
    });

    it('decrypts the reference CBC vectors', () => {
        const supported = vectors.blowfish.cbc.filter((item) => item.wire);
        expect(supported.length).toBeGreaterThanOrEqual(2);

        supported.forEach((item) => {
            expect(item.wire.indexOf('+OK *')).toBe(0);
            const parsed = Fish.parsePayload(item.wire);
            expect(parsed.mode).toBe('cbc');
            expect(Fish.decryptCBC(item.key, parsed.payload)).toBe(item.plain);
        });
    });

    it('records that the reference cannot express a 60 byte key', () => {
        // WeeChat truncates at 72 and then hands the key to pycryptodome, which
        // enforces the 448-bit definition. We accept up to 72 to stay readable
        // by mIRC FiSH 10, which is OpenSSL based.
        const entries = vectors.blowfish.ecb.filter((item) => item.key.length > 56);
        expect(entries.length).toBeGreaterThan(0);
        entries.forEach((item) => {
            expect(item.error).toMatch(/Blowfish key length/);
            expect(item.wire).toBeUndefined();
        });
    });
});

describe('FiSH ECB payloads', () => {
    it('pads only to the block boundary', () => {
        // 7 bytes gets one zero byte, 8 bytes gets no extra block, 9 bytes
        // spills into a second block.
        const lengths = [
            [7, 1],
            [8, 1],
            [9, 2],
            [16, 2],
            [17, 3],
        ];

        lengths.forEach(([textLength, blocks]) => {
            const text = 'a'.repeat(textLength);
            const wire = Fish.encryptECB('blowfish', text);
            const payload = Fish.parsePayload(wire).payload;
            expect(payload).toHaveLength(blocks * 12);
            expect(Fish.decryptECB('blowfish', payload)).toBe(text);
        });
    });

    it('preserves multi-byte characters at the end of a message', () => {
        ['⚷', '⚷⚷', 'tail 😀', '日本語', 'x'.repeat(7) + '⚷', 'x'.repeat(8) + '⚷']
            .forEach((text) => {
                const wire = Fish.encryptECB('blowfish', text);
                expect(Fish.decryptECB('blowfish', Fish.parsePayload(wire).payload))
                    .toBe(text);
            });
    });

    it('round trips long keys and truncates past 72 bytes', () => {
        const text = 'long key message';
        [56, 60, 72].forEach((length) => {
            const key = patternedKey(length);
            const wire = Fish.encryptECB(key, text);
            expect(Fish.decryptECB(key, Fish.parsePayload(wire).payload)).toBe(text);
        });

        // Bytes past 72 never reach the schedule.
        expect(Fish.encryptECB(patternedKey(72), text))
            .toBe(Fish.encryptECB(patternedKey(72) + 'ignored-suffix', text));
    });
});

describe('FiSH CBC payloads', () => {
    it('uses standard base64 with the mode marker glued on', () => {
        ['hello', 'a longer message', '⚷ unicode ok', 'x'.repeat(70)].forEach((text) => {
            const wire = Fish.encryptCBC('blowfish', text);
            expect(wire).toMatch(/^\+OK \*[A-Za-z0-9+/]+={0,2}$/);
            const parsed = Fish.parsePayload(wire);
            expect(parsed.mode).toBe('cbc');
            expect(Fish.decryptCBC('blowfish', parsed.payload)).toBe(text);
        });
    });

    it('randomises the first block for the same plaintext', () => {
        const first = Fish.encryptCBC('blowfish', 'same message');
        const second = Fish.encryptCBC('blowfish', 'same message');

        expect(first).not.toBe(second);
        expect(Fish.parsePayload(first).payload)
            .not.toBe(Fish.parsePayload(second).payload);
        expect(Fish.decryptCBC('blowfish', Fish.parsePayload(first).payload))
            .toBe('same message');
        expect(Fish.decryptCBC('blowfish', Fish.parsePayload(second).payload))
            .toBe('same message');
    });

    it('carries eight bytes of prefix plus the padded message', () => {
        [3, 8, 9, 16].forEach((textLength) => {
            const wire = Fish.encryptCBC('blowfish', 'a'.repeat(textLength));
            const payload = Fish.parsePayload(wire).payload;
            const bytes = Fish.stdBase64Decode(payload);

            // Eight prefix bytes plus whole blocks, never a second padding block.
            expect(bytes.length).toBe(8 + 8 * Math.ceil(textLength / 8));
            expect(bytes.length % 8).toBe(0);
        });
    });

    it('rejects payloads that are not whole blocks', () => {
        expect(() => Fish.decryptCBC('blowfish', 'abc')).toThrow();
        expect(() => Fish.decryptCBC('blowfish', '')).toThrow();
    });

    it('decrypts a payload whose first block is a clear IV', () => {
        // WeeChat and Mircryption put a clear IV in front; Mircryption-compatible
        // implementations encrypt a random block under a zero IV. Both decrypt
        // to the same plaintext, so a peer's payload must always work.
        const referenceWire = '+OK *o2BNTv01lAIXRSFP+Efw/w==';
        expect(Fish.decryptCBC('blowfish', Fish.parsePayload(referenceWire).payload))
            .toBe('qwertyui');
    });
});

describe('FiSH DH1080', () => {
    const PRIME = BigInt('0x' + Fish.DH_PRIME_HEX);

    it('uses the reference prime', () => {
        expect(PRIME.toString(2)).toHaveLength(1080);
        expect(Fish.DH_PRIME_HEX.length).toBe(270);
        expect(vectors.dh.primeBitLength).toBe(1080);
        expect(vectors.dh.primeHex).toBe(Fish.DH_PRIME_HEX.toUpperCase());
    });

    it('derives the same key on both sides', () => {
        const alice = Fish.dhGenerate();
        const bob = Fish.dhGenerate();

        expect(Fish.dhSharedKey(alice.privateKey, bob.publicKey))
            .toBe(Fish.dhSharedKey(bob.privateKey, alice.publicKey));

        const key = Fish.dhSharedKey(alice.privateKey, bob.publicKey);
        expect(key).toHaveLength(43);
        expect(key).toMatch(/^[A-Za-z0-9+/]+$/);
        expect(key).not.toContain('=');
    });

    it('matches the reference exchange vectors', () => {
        vectors.dh.exchanges.forEach((item) => {
            const privateKey = bytesToBigInt(
                Fish.stdBase64Decode(item.alicePrivate)
            );

            expect(Fish.dhSharedKey(privateKey, item.bobPublic)).toBe(item.key);

            const bobPrivate = bytesToBigInt(
                Fish.stdBase64Decode(item.bobPrivate)
            );
            expect(Fish.dhSharedKey(bobPrivate, item.alicePublic)).toBe(item.key);
        });
    });

    it('encodes public keys exactly like the reference', () => {
        vectors.dh.exchanges.forEach((item) => {
            const publicKey = bytesToBigInt(
                Fish.stdBase64Decode(item.alicePublic)
            );
            const bytes = bigIntToBytes(publicKey);
            const expected = Fish.stdBase64Encode(bytes).replace(/=+$/, '');

            // A 135 byte key is a multiple of three, so the reference appends a
            // zero-value character. Ours must be byte identical.
            const encoded = Fish.dhPublicKey(
                bytesToBigInt(Fish.stdBase64Decode(item.alicePrivate))
            );
            expect(bigIntToBytes(encoded)).toEqual(bytes);
            expect(item.alicePublic.startsWith(expected)).toBe(true);
            expect(item.alicePublic.length).toBe(expected.length + 1);
            expect(item.alicePublic.endsWith('A')).toBe(true);
            expect(item.alicePublic.length).toBe(vectors.dh.publicKeyLength);
        });

        expect(vectors.dh.publicKeyLength).toBe(181);
    });

    it('hashes the shared secret at its minimal length', () => {
        // About one exchange in 256 produces a secret with a zero top byte.
        // Both references hash the stripped integer, so padding it back to 135
        // bytes would break exactly those exchanges.
        const shortSecret = BigInt('0x' + vectors.dh.shortSecret.secretHex);
        expect(vectors.dh.shortSecret.byteLength).toBe(134);
        expect(shortSecret.toString(16).length).toBeLessThanOrEqual(268);
        expect(Fish.dhKeyFromSecret(shortSecret))
            .toBe(vectors.dh.shortSecret.key);

        const padded = Fish.dhKeyFromSecret(
            BigInt('0x00' + vectors.dh.shortSecret.secretHex)
        );
        expect(padded).toBe(vectors.dh.shortSecret.key);

        // A full width secret still hashes over 135 bytes.
        const wideSecret = BigInt('0x' + vectors.dh.wideSecret.secretHex);
        expect(vectors.dh.wideSecret.byteLength).toBe(135);
        expect(Fish.dhKeyFromSecret(wideSecret)).toBe(vectors.dh.wideSecret.key);
    });

    it('encodes the digest with the standard alphabet', () => {
        // The reference's own output for a known secret is the expected digest
        // encoding; the FiSH custom alphabet would produce something else.
        const secret = BigInt('0x' + vectors.dh.shortSecret.secretHex);
        const digest = Fish.sha256(bigIntToBytes(secret));
        const key = Fish.dhKeyFromSecret(secret);

        expect(key).toBe(vectors.dh.shortSecret.key);
        expect(key).toHaveLength(43);
        expect(Fish.stdBase64Encode(digest).replace(/=+$/, '')).toBe(key);

        // This digest contains characters that only the standard alphabet has.
        expect(key).toMatch(/[+/]/);
        expect(Fish.fishBase64Encode(digest)).not.toBe(key);
    });

    it('rejects an out of range public key', () => {
        const alice = Fish.dhGenerate();
        const bad = Fish.stdBase64Encode(new Uint8Array([0, 0]));
        expect(() => Fish.dhSharedKey(alice.privateKey, bad)).toThrow();

        const tooBig = Fish.stdBase64Encode(new Uint8Array(135).fill(0xff));
        expect(() => Fish.dhSharedKey(alice.privateKey, tooBig)).toThrow();
    });

    it('produces a key usable by Blowfish', () => {
        const alice = Fish.dhGenerate();
        const bob = Fish.dhGenerate();
        const key = Fish.dhSharedKey(alice.privateKey, bob.publicKey);

        const wire = Fish.encryptCBC(key, 'dh encrypted');
        expect(Fish.decryptCBC(key, Fish.parsePayload(wire).payload))
            .toBe('dh encrypted');
    });
});

describe('FiSH plaintext escape', () => {
    it('unwraps plaintext inside encrypted framing', () => {
        ['+OK +p hello', '+OK *+p hello', 'mcps +p hello']
            .forEach((wire) => {
                const parsed = Fish.parsePayload(wire);
                expect(parsed.plaintext).toBe(true);
                expect(parsed.payload).toBe('hello');
            });
    });

    it('keeps the mode of the framing prefix', () => {
        expect(Fish.parsePayload('+OK +p hello').mode).toBe('ecb');
        expect(Fish.parsePayload('+OK *+p hello').mode).toBe('cbc');
    });

    it('does not treat a bare escape as plaintext', () => {
        ['+OK +p', '+OK *+p', '+OK +p '].forEach((wire) => {
            const parsed = Fish.parsePayload(wire);
            expect(parsed && parsed.plaintext).toBeFalsy();
        });
    });

    it('does not collide with ciphertext', () => {
        // Real payloads never contain a space, so the escape is unambiguous.
        const payload = Fish.parsePayload(Fish.encryptECB('key', 'hello'));
        expect(payload.plaintext).toBeUndefined();
        expect(payload.payload).not.toContain(' ');
    });
});

describe('FiSH strict plaintext validation', () => {
    const key = 'strict-key';
    const strict = { strict: true };

    function decryptStrict(mode, payload) {
        return Fish.decrypt(key, mode, payload, strict);
    }

    it('accepts ordinary text and mIRC formatting', () => {
        ['hello', 'with ⚷ unicode', '\x02bold\x02 \x0304red\x03', 'multi\nline']
            .forEach((text) => {
                const wire = Fish.encrypt(key, Fish.MODE_CBC, text);
                expect(decryptStrict(Fish.MODE_CBC, Fish.parsePayload(wire).payload))
                    .toBe(text);
            });
    });

    it('rejects a decryption that yields control bytes', () => {
        const wire = Fish.encrypt(key, Fish.MODE_ECB, 'bad\x07bell\x00nul');
        expect(() => decryptStrict(Fish.MODE_ECB, Fish.parsePayload(wire).payload))
            .toThrow('Invalid plaintext');
    });

    it('rejects a wrong key instead of returning mojibake', () => {
        const wire = Fish.encrypt(key, Fish.MODE_CBC, 'a message long enough to matter');
        const payload = Fish.parsePayload(wire).payload;

        // Lenient mode still produces something; strict mode refuses it.
        expect(typeof Fish.decrypt('other-key', Fish.MODE_CBC, payload)).toBe('string');
        expect(() => Fish.decrypt('other-key', Fish.MODE_CBC, payload, strict))
            .toThrow('Invalid plaintext');
    });

    it('rejects a mode mismatch', () => {
        const cbc = Fish.parsePayload(Fish.encrypt(key, Fish.MODE_CBC, 'cbc payload'));
        const ecb = Fish.parsePayload(Fish.encrypt(key, Fish.MODE_ECB, 'ecb payload'));

        expect(() => decryptStrict(Fish.MODE_ECB, cbc.payload))
            .toThrow('Invalid plaintext');
        expect(() => decryptStrict(Fish.MODE_CBC, ecb.payload))
            .toThrow();
    });

    it('rejects an empty decryption', () => {
        // A CBC payload of exactly one block decrypts to nothing after the
        // random prefix block is dropped.
        const block = Fish.parsePayload(Fish.encryptECB(key, '12345678')).payload;
        const oneBlock = Fish.stdBase64Encode(Fish.fishBase64Decode(block));

        expect(() => decryptStrict(Fish.MODE_CBC, oneBlock))
            .toThrow('Invalid plaintext');
    });

    it('returns null for invalid UTF-8 in strict mode only', () => {
        const invalid = new Uint8Array([0xff, 0xfe, 0xc0, 0x80]);

        expect(Fish.utf8Decode(invalid, true)).toBeNull();
        expect(Fish.utf8Decode(invalid)).toContain('\ufffd');
    });

    it('rejects overlong encodings and surrogate halves in strict mode', () => {
        // 0xC0 0x80 is an overlong NUL; 0xED 0xA0 0x80 is a surrogate.
        expect(Fish.utf8Decode(new Uint8Array([0xc0, 0x80]), true)).toBeNull();
        expect(Fish.utf8Decode(new Uint8Array([0xed, 0xa0, 0x80]), true)).toBeNull();
    });

    it('rejects an oversized payload without decoding it', () => {
        const parsed = Fish.parsePayload('+OK ' + 'A'.repeat(20000));
        expect(parsed.invalid).toBe(true);
    });

    it('rejects an oversized DH public key', () => {
        const alice = Fish.dhGenerate();
        const huge = 'A'.repeat(1000);

        expect(() => Fish.dhSharedKey(alice.privateKey, huge)).toThrow();
    });
});
