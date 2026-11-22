/* FiSH crypto helpers for the Kiwi IRC FiSH plugin.
 *
 * Everything here is self contained so that it works identically in the web
 * client, the Electron renderer and Jest:
 *
 *   - Blowfish with a zero IV CBC mode
 *   - the FiSH custom Base64 alphabet used by ECB payloads
 *   - the DH1080 Diffie-Hellman key exchange
 *   - SHA-256 and UTF-8 helpers
 *
 * UMD-wrapped: browsers get window.KiwiFishCrypto, Jest can require() it.
 *
 * FiSH is not authenticated encryption. Blowfish ECB in particular leaks
 * structure in the plaintext, and neither mode detects tampering.
 */

/* Block ciphers are bit twiddling by definition; this file is the one place
   where the project's no-bitwise rule cannot apply. The UMD wrapper needs a
   real function expression because it reads the top level `this`. */
/* eslint-disable no-bitwise, prefer-arrow-callback */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.KiwiFishCrypto = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    /* ------------------------------------------------------------------ *
     * Blowfish
     * ------------------------------------------------------------------ */

    // Standard Blowfish initial P-array and S-boxes: the hexadecimal digits of
    // pi. Vendored from https://github.com/jtordgeman/raptor-blowfish
    // Copyright (c) 2021 Johnny Tordgeman, MIT licensed.
    let INITIAL_P = [
        0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344, 0xa4093822, 0x299f31d0,
        0x082efa98, 0xec4e6c89, 0x452821e6, 0x38d01377, 0xbe5466cf, 0x34e90c6c,
        0xc0ac29b7, 0xc97c50dd, 0x3f84d5b5, 0xb5470917, 0x9216d5d9, 0x8979fb1b,
    ];

    let INITIAL_S = [
        [
            0xd1310ba6, 0x98dfb5ac, 0x2ffd72db, 0xd01adfb7, 0xb8e1afed, 0x6a267e96,
            0xba7c9045, 0xf12c7f99, 0x24a19947, 0xb3916cf7, 0x0801f2e2, 0x858efc16,
            0x636920d8, 0x71574e69, 0xa458fea3, 0xf4933d7e, 0x0d95748f, 0x728eb658,
            0x718bcd58, 0x82154aee, 0x7b54a41d, 0xc25a59b5, 0x9c30d539, 0x2af26013,
            0xc5d1b023, 0x286085f0, 0xca417918, 0xb8db38ef, 0x8e79dcb0, 0x603a180e,
            0x6c9e0e8b, 0xb01e8a3e, 0xd71577c1, 0xbd314b27, 0x78af2fda, 0x55605c60,
            0xe65525f3, 0xaa55ab94, 0x57489862, 0x63e81440, 0x55ca396a, 0x2aab10b6,
            0xb4cc5c34, 0x1141e8ce, 0xa15486af, 0x7c72e993, 0xb3ee1411, 0x636fbc2a,
            0x2ba9c55d, 0x741831f6, 0xce5c3e16, 0x9b87931e, 0xafd6ba33, 0x6c24cf5c,
            0x7a325381, 0x28958677, 0x3b8f4898, 0x6b4bb9af, 0xc4bfe81b, 0x66282193,
            0x61d809cc, 0xfb21a991, 0x487cac60, 0x5dec8032, 0xef845d5d, 0xe98575b1,
            0xdc262302, 0xeb651b88, 0x23893e81, 0xd396acc5, 0x0f6d6ff3, 0x83f44239,
            0x2e0b4482, 0xa4842004, 0x69c8f04a, 0x9e1f9b5e, 0x21c66842, 0xf6e96c9a,
            0x670c9c61, 0xabd388f0, 0x6a51a0d2, 0xd8542f68, 0x960fa728, 0xab5133a3,
            0x6eef0b6c, 0x137a3be4, 0xba3bf050, 0x7efb2a98, 0xa1f1651d, 0x39af0176,
            0x66ca593e, 0x82430e88, 0x8cee8619, 0x456f9fb4, 0x7d84a5c3, 0x3b8b5ebe,
            0xe06f75d8, 0x85c12073, 0x401a449f, 0x56c16aa6, 0x4ed3aa62, 0x363f7706,
            0x1bfedf72, 0x429b023d, 0x37d0d724, 0xd00a1248, 0xdb0fead3, 0x49f1c09b,
            0x075372c9, 0x80991b7b, 0x25d479d8, 0xf6e8def7, 0xe3fe501a, 0xb6794c3b,
            0x976ce0bd, 0x04c006ba, 0xc1a94fb6, 0x409f60c4, 0x5e5c9ec2, 0x196a2463,
            0x68fb6faf, 0x3e6c53b5, 0x1339b2eb, 0x3b52ec6f, 0x6dfc511f, 0x9b30952c,
            0xcc814544, 0xaf5ebd09, 0xbee3d004, 0xde334afd, 0x660f2807, 0x192e4bb3,
            0xc0cba857, 0x45c8740f, 0xd20b5f39, 0xb9d3fbdb, 0x5579c0bd, 0x1a60320a,
            0xd6a100c6, 0x402c7279, 0x679f25fe, 0xfb1fa3cc, 0x8ea5e9f8, 0xdb3222f8,
            0x3c7516df, 0xfd616b15, 0x2f501ec8, 0xad0552ab, 0x323db5fa, 0xfd238760,
            0x53317b48, 0x3e00df82, 0x9e5c57bb, 0xca6f8ca0, 0x1a87562e, 0xdf1769db,
            0xd542a8f6, 0x287effc3, 0xac6732c6, 0x8c4f5573, 0x695b27b0, 0xbbca58c8,
            0xe1ffa35d, 0xb8f011a0, 0x10fa3d98, 0xfd2183b8, 0x4afcb56c, 0x2dd1d35b,
            0x9a53e479, 0xb6f84565, 0xd28e49bc, 0x4bfb9790, 0xe1ddf2da, 0xa4cb7e33,
            0x62fb1341, 0xcee4c6e8, 0xef20cada, 0x36774c01, 0xd07e9efe, 0x2bf11fb4,
            0x95dbda4d, 0xae909198, 0xeaad8e71, 0x6b93d5a0, 0xd08ed1d0, 0xafc725e0,
            0x8e3c5b2f, 0x8e7594b7, 0x8ff6e2fb, 0xf2122b64, 0x8888b812, 0x900df01c,
            0x4fad5ea0, 0x688fc31c, 0xd1cff191, 0xb3a8c1ad, 0x2f2f2218, 0xbe0e1777,
            0xea752dfe, 0x8b021fa1, 0xe5a0cc0f, 0xb56f74e8, 0x18acf3d6, 0xce89e299,
            0xb4a84fe0, 0xfd13e0b7, 0x7cc43b81, 0xd2ada8d9, 0x165fa266, 0x80957705,
            0x93cc7314, 0x211a1477, 0xe6ad2065, 0x77b5fa86, 0xc75442f5, 0xfb9d35cf,
            0xebcdaf0c, 0x7b3e89a0, 0xd6411bd3, 0xae1e7e49, 0x00250e2d, 0x2071b35e,
            0x226800bb, 0x57b8e0af, 0x2464369b, 0xf009b91e, 0x5563911d, 0x59dfa6aa,
            0x78c14389, 0xd95a537f, 0x207d5ba2, 0x02e5b9c5, 0x83260376, 0x6295cfa9,
            0x11c81968, 0x4e734a41, 0xb3472dca, 0x7b14a94a, 0x1b510052, 0x9a532915,
            0xd60f573f, 0xbc9bc6e4, 0x2b60a476, 0x81e67400, 0x08ba6fb5, 0x571be91f,
            0xf296ec6b, 0x2a0dd915, 0xb6636521, 0xe7b9f9b6, 0xff34052e, 0xc5855664,
            0x53b02d5d, 0xa99f8fa1, 0x08ba4799, 0x6e85076a,
        ],
        [
            0x4b7a70e9, 0xb5b32944, 0xdb75092e, 0xc4192623, 0xad6ea6b0, 0x49a7df7d,
            0x9cee60b8, 0x8fedb266, 0xecaa8c71, 0x699a17ff, 0x5664526c, 0xc2b19ee1,
            0x193602a5, 0x75094c29, 0xa0591340, 0xe4183a3e, 0x3f54989a, 0x5b429d65,
            0x6b8fe4d6, 0x99f73fd6, 0xa1d29c07, 0xefe830f5, 0x4d2d38e6, 0xf0255dc1,
            0x4cdd2086, 0x8470eb26, 0x6382e9c6, 0x021ecc5e, 0x09686b3f, 0x3ebaefc9,
            0x3c971814, 0x6b6a70a1, 0x687f3584, 0x52a0e286, 0xb79c5305, 0xaa500737,
            0x3e07841c, 0x7fdeae5c, 0x8e7d44ec, 0x5716f2b8, 0xb03ada37, 0xf0500c0d,
            0xf01c1f04, 0x0200b3ff, 0xae0cf51a, 0x3cb574b2, 0x25837a58, 0xdc0921bd,
            0xd19113f9, 0x7ca92ff6, 0x94324773, 0x22f54701, 0x3ae5e581, 0x37c2dadc,
            0xc8b57634, 0x9af3dda7, 0xa9446146, 0x0fd0030e, 0xecc8c73e, 0xa4751e41,
            0xe238cd99, 0x3bea0e2f, 0x3280bba1, 0x183eb331, 0x4e548b38, 0x4f6db908,
            0x6f420d03, 0xf60a04bf, 0x2cb81290, 0x24977c79, 0x5679b072, 0xbcaf89af,
            0xde9a771f, 0xd9930810, 0xb38bae12, 0xdccf3f2e, 0x5512721f, 0x2e6b7124,
            0x501adde6, 0x9f84cd87, 0x7a584718, 0x7408da17, 0xbc9f9abc, 0xe94b7d8c,
            0xec7aec3a, 0xdb851dfa, 0x63094366, 0xc464c3d2, 0xef1c1847, 0x3215d908,
            0xdd433b37, 0x24c2ba16, 0x12a14d43, 0x2a65c451, 0x50940002, 0x133ae4dd,
            0x71dff89e, 0x10314e55, 0x81ac77d6, 0x5f11199b, 0x043556f1, 0xd7a3c76b,
            0x3c11183b, 0x5924a509, 0xf28fe6ed, 0x97f1fbfa, 0x9ebabf2c, 0x1e153c6e,
            0x86e34570, 0xeae96fb1, 0x860e5e0a, 0x5a3e2ab3, 0x771fe71c, 0x4e3d06fa,
            0x2965dcb9, 0x99e71d0f, 0x803e89d6, 0x5266c825, 0x2e4cc978, 0x9c10b36a,
            0xc6150eba, 0x94e2ea78, 0xa5fc3c53, 0x1e0a2df4, 0xf2f74ea7, 0x361d2b3d,
            0x1939260f, 0x19c27960, 0x5223a708, 0xf71312b6, 0xebadfe6e, 0xeac31f66,
            0xe3bc4595, 0xa67bc883, 0xb17f37d1, 0x018cff28, 0xc332ddef, 0xbe6c5aa5,
            0x65582185, 0x68ab9802, 0xeecea50f, 0xdb2f953b, 0x2aef7dad, 0x5b6e2f84,
            0x1521b628, 0x29076170, 0xecdd4775, 0x619f1510, 0x13cca830, 0xeb61bd96,
            0x0334fe1e, 0xaa0363cf, 0xb5735c90, 0x4c70a239, 0xd59e9e0b, 0xcbaade14,
            0xeecc86bc, 0x60622ca7, 0x9cab5cab, 0xb2f3846e, 0x648b1eaf, 0x19bdf0ca,
            0xa02369b9, 0x655abb50, 0x40685a32, 0x3c2ab4b3, 0x319ee9d5, 0xc021b8f7,
            0x9b540b19, 0x875fa099, 0x95f7997e, 0x623d7da8, 0xf837889a, 0x97e32d77,
            0x11ed935f, 0x16681281, 0x0e358829, 0xc7e61fd6, 0x96dedfa1, 0x7858ba99,
            0x57f584a5, 0x1b227263, 0x9b83c3ff, 0x1ac24696, 0xcdb30aeb, 0x532e3054,
            0x8fd948e4, 0x6dbc3128, 0x58ebf2ef, 0x34c6ffea, 0xfe28ed61, 0xee7c3c73,
            0x5d4a14d9, 0xe864b7e3, 0x42105d14, 0x203e13e0, 0x45eee2b6, 0xa3aaabea,
            0xdb6c4f15, 0xfacb4fd0, 0xc742f442, 0xef6abbb5, 0x654f3b1d, 0x41cd2105,
            0xd81e799e, 0x86854dc7, 0xe44b476a, 0x3d816250, 0xcf62a1f2, 0x5b8d2646,
            0xfc8883a0, 0xc1c7b6a3, 0x7f1524c3, 0x69cb7492, 0x47848a0b, 0x5692b285,
            0x095bbf00, 0xad19489d, 0x1462b174, 0x23820e00, 0x58428d2a, 0x0c55f5ea,
            0x1dadf43e, 0x233f7061, 0x3372f092, 0x8d937e41, 0xd65fecf1, 0x6c223bdb,
            0x7cde3759, 0xcbee7460, 0x4085f2a7, 0xce77326e, 0xa6078084, 0x19f8509e,
            0xe8efd855, 0x61d99735, 0xa969a7aa, 0xc50c06c2, 0x5a04abfc, 0x800bcadc,
            0x9e447a2e, 0xc3453484, 0xfdd56705, 0x0e1e9ec9, 0xdb73dbd3, 0x105588cd,
            0x675fda79, 0xe3674340, 0xc5c43465, 0x713e38d8, 0x3d28f89e, 0xf16dff20,
            0x153e21e7, 0x8fb03d4a, 0xe6e39f2b, 0xdb83adf7,
        ],
        [
            0xe93d5a68, 0x948140f7, 0xf64c261c, 0x94692934, 0x411520f7, 0x7602d4f7,
            0xbcf46b2e, 0xd4a20068, 0xd4082471, 0x3320f46a, 0x43b7d4b7, 0x500061af,
            0x1e39f62e, 0x97244546, 0x14214f74, 0xbf8b8840, 0x4d95fc1d, 0x96b591af,
            0x70f4ddd3, 0x66a02f45, 0xbfbc09ec, 0x03bd9785, 0x7fac6dd0, 0x31cb8504,
            0x96eb27b3, 0x55fd3941, 0xda2547e6, 0xabca0a9a, 0x28507825, 0x530429f4,
            0x0a2c86da, 0xe9b66dfb, 0x68dc1462, 0xd7486900, 0x680ec0a4, 0x27a18dee,
            0x4f3ffea2, 0xe887ad8c, 0xb58ce006, 0x7af4d6b6, 0xaace1e7c, 0xd3375fec,
            0xce78a399, 0x406b2a42, 0x20fe9e35, 0xd9f385b9, 0xee39d7ab, 0x3b124e8b,
            0x1dc9faf7, 0x4b6d1856, 0x26a36631, 0xeae397b2, 0x3a6efa74, 0xdd5b4332,
            0x6841e7f7, 0xca7820fb, 0xfb0af54e, 0xd8feb397, 0x454056ac, 0xba489527,
            0x55533a3a, 0x20838d87, 0xfe6ba9b7, 0xd096954b, 0x55a867bc, 0xa1159a58,
            0xcca92963, 0x99e1db33, 0xa62a4a56, 0x3f3125f9, 0x5ef47e1c, 0x9029317c,
            0xfdf8e802, 0x04272f70, 0x80bb155c, 0x05282ce3, 0x95c11548, 0xe4c66d22,
            0x48c1133f, 0xc70f86dc, 0x07f9c9ee, 0x41041f0f, 0x404779a4, 0x5d886e17,
            0x325f51eb, 0xd59bc0d1, 0xf2bcc18f, 0x41113564, 0x257b7834, 0x602a9c60,
            0xdff8e8a3, 0x1f636c1b, 0x0e12b4c2, 0x02e1329e, 0xaf664fd1, 0xcad18115,
            0x6b2395e0, 0x333e92e1, 0x3b240b62, 0xeebeb922, 0x85b2a20e, 0xe6ba0d99,
            0xde720c8c, 0x2da2f728, 0xd0127845, 0x95b794fd, 0x647d0862, 0xe7ccf5f0,
            0x5449a36f, 0x877d48fa, 0xc39dfd27, 0xf33e8d1e, 0x0a476341, 0x992eff74,
            0x3a6f6eab, 0xf4f8fd37, 0xa812dc60, 0xa1ebddf8, 0x991be14c, 0xdb6e6b0d,
            0xc67b5510, 0x6d672c37, 0x2765d43b, 0xdcd0e804, 0xf1290dc7, 0xcc00ffa3,
            0xb5390f92, 0x690fed0b, 0x667b9ffb, 0xcedb7d9c, 0xa091cf0b, 0xd9155ea3,
            0xbb132f88, 0x515bad24, 0x7b9479bf, 0x763bd6eb, 0x37392eb3, 0xcc115979,
            0x8026e297, 0xf42e312d, 0x6842ada7, 0xc66a2b3b, 0x12754ccc, 0x782ef11c,
            0x6a124237, 0xb79251e7, 0x06a1bbe6, 0x4bfb6350, 0x1a6b1018, 0x11caedfa,
            0x3d25bdd8, 0xe2e1c3c9, 0x44421659, 0x0a121386, 0xd90cec6e, 0xd5abea2a,
            0x64af674e, 0xda86a85f, 0xbebfe988, 0x64e4c3fe, 0x9dbc8057, 0xf0f7c086,
            0x60787bf8, 0x6003604d, 0xd1fd8346, 0xf6381fb0, 0x7745ae04, 0xd736fccc,
            0x83426b33, 0xf01eab71, 0xb0804187, 0x3c005e5f, 0x77a057be, 0xbde8ae24,
            0x55464299, 0xbf582e61, 0x4e58f48f, 0xf2ddfda2, 0xf474ef38, 0x8789bdc2,
            0x5366f9c3, 0xc8b38e74, 0xb475f255, 0x46fcd9b9, 0x7aeb2661, 0x8b1ddf84,
            0x846a0e79, 0x915f95e2, 0x466e598e, 0x20b45770, 0x8cd55591, 0xc902de4c,
            0xb90bace1, 0xbb8205d0, 0x11a86248, 0x7574a99e, 0xb77f19b6, 0xe0a9dc09,
            0x662d09a1, 0xc4324633, 0xe85a1f02, 0x09f0be8c, 0x4a99a025, 0x1d6efe10,
            0x1ab93d1d, 0x0ba5a4df, 0xa186f20f, 0x2868f169, 0xdcb7da83, 0x573906fe,
            0xa1e2ce9b, 0x4fcd7f52, 0x50115e01, 0xa70683fa, 0xa002b5c4, 0x0de6d027,
            0x9af88c27, 0x773f8641, 0xc3604c06, 0x61a806b5, 0xf0177a28, 0xc0f586e0,
            0x006058aa, 0x30dc7d62, 0x11e69ed7, 0x2338ea63, 0x53c2dd94, 0xc2c21634,
            0xbbcbee56, 0x90bcb6de, 0xebfc7da1, 0xce591d76, 0x6f05e409, 0x4b7c0188,
            0x39720a3d, 0x7c927c24, 0x86e3725f, 0x724d9db9, 0x1ac15bb4, 0xd39eb8fc,
            0xed545578, 0x08fca5b5, 0xd83d7cd3, 0x4dad0fc4, 0x1e50ef5e, 0xb161e6f8,
            0xa28514d9, 0x6c51133c, 0x6fd5c7e7, 0x56e14ec4, 0x362abfce, 0xddc6c837,
            0xd79a3234, 0x92638212, 0x670efa8e, 0x406000e0,
        ],
        [
            0x3a39ce37, 0xd3faf5cf, 0xabc27737, 0x5ac52d1b, 0x5cb0679e, 0x4fa33742,
            0xd3822740, 0x99bc9bbe, 0xd5118e9d, 0xbf0f7315, 0xd62d1c7e, 0xc700c47b,
            0xb78c1b6b, 0x21a19045, 0xb26eb1be, 0x6a366eb4, 0x5748ab2f, 0xbc946e79,
            0xc6a376d2, 0x6549c2c8, 0x530ff8ee, 0x468dde7d, 0xd5730a1d, 0x4cd04dc6,
            0x2939bbdb, 0xa9ba4650, 0xac9526e8, 0xbe5ee304, 0xa1fad5f0, 0x6a2d519a,
            0x63ef8ce2, 0x9a86ee22, 0xc089c2b8, 0x43242ef6, 0xa51e03aa, 0x9cf2d0a4,
            0x83c061ba, 0x9be96a4d, 0x8fe51550, 0xba645bd6, 0x2826a2f9, 0xa73a3ae1,
            0x4ba99586, 0xef5562e9, 0xc72fefd3, 0xf752f7da, 0x3f046f69, 0x77fa0a59,
            0x80e4a915, 0x87b08601, 0x9b09e6ad, 0x3b3ee593, 0xe990fd5a, 0x9e34d797,
            0x2cf0b7d9, 0x022b8b51, 0x96d5ac3a, 0x017da67d, 0xd1cf3ed6, 0x7c7d2d28,
            0x1f9f25cf, 0xadf2b89b, 0x5ad6b472, 0x5a88f54c, 0xe029ac71, 0xe019a5e6,
            0x47b0acfd, 0xed93fa9b, 0xe8d3c48d, 0x283b57cc, 0xf8d56629, 0x79132e28,
            0x785f0191, 0xed756055, 0xf7960e44, 0xe3d35e8c, 0x15056dd4, 0x88f46dba,
            0x03a16125, 0x0564f0bd, 0xc3eb9e15, 0x3c9057a2, 0x97271aec, 0xa93a072a,
            0x1b3f6d9b, 0x1e6321f5, 0xf59c66fb, 0x26dcf319, 0x7533d928, 0xb155fdf5,
            0x03563482, 0x8aba3cbb, 0x28517711, 0xc20ad9f8, 0xabcc5167, 0xccad925f,
            0x4de81751, 0x3830dc8e, 0x379d5862, 0x9320f991, 0xea7a90c2, 0xfb3e7bce,
            0x5121ce64, 0x774fbe32, 0xa8b6e37e, 0xc3293d46, 0x48de5369, 0x6413e680,
            0xa2ae0810, 0xdd6db224, 0x69852dfd, 0x09072166, 0xb39a460a, 0x6445c0dd,
            0x586cdecf, 0x1c20c8ae, 0x5bbef7dd, 0x1b588d40, 0xccd2017f, 0x6bb4e3bb,
            0xdda26a7e, 0x3a59ff45, 0x3e350a44, 0xbcb4cdd5, 0x72eacea8, 0xfa6484bb,
            0x8d6612ae, 0xbf3c6f47, 0xd29be463, 0x542f5d9e, 0xaec2771b, 0xf64e6370,
            0x740e0d8d, 0xe75b1357, 0xf8721671, 0xaf537d5d, 0x4040cb08, 0x4eb4e2cc,
            0x34d2466a, 0x0115af84, 0xe1b00428, 0x95983a1d, 0x06b89fb4, 0xce6ea048,
            0x6f3f3b82, 0x3520ab82, 0x011a1d4b, 0x277227f8, 0x611560b1, 0xe7933fdc,
            0xbb3a792b, 0x344525bd, 0xa08839e1, 0x51ce794b, 0x2f32c9b7, 0xa01fbac9,
            0xe01cc87e, 0xbcc7d1f6, 0xcf0111c3, 0xa1e8aac7, 0x1a908749, 0xd44fbd9a,
            0xd0dadecb, 0xd50ada38, 0x0339c32a, 0xc6913667, 0x8df9317c, 0xe0b12b4f,
            0xf79e59b7, 0x43f5bb3a, 0xf2d519ff, 0x27d9459c, 0xbf97222c, 0x15e6fc2a,
            0x0f91fc71, 0x9b941525, 0xfae59361, 0xceb69ceb, 0xc2a86459, 0x12baa8d1,
            0xb6c1075e, 0xe3056a0c, 0x10d25065, 0xcb03a442, 0xe0ec6e0e, 0x1698db3b,
            0x4c98a0be, 0x3278e964, 0x9f1f9532, 0xe0d392df, 0xd3a0342b, 0x8971f21e,
            0x1b0a7441, 0x4ba3348c, 0xc5be7120, 0xc37632d8, 0xdf359f8d, 0x9b992f2e,
            0xe60b6f47, 0x0fe3f11d, 0xe54cda54, 0x1edad891, 0xce6279cf, 0xcd3e7e6f,
            0x1618b166, 0xfd2c1d05, 0x848fd2c5, 0xf6fb2299, 0xf523f357, 0xa6327623,
            0x93a83531, 0x56cccd02, 0xacf08162, 0x5a75ebb5, 0x6e163697, 0x88d273cc,
            0xde966292, 0x81b949d0, 0x4c50901b, 0x71c65614, 0xe6c6c7bd, 0x327a140a,
            0x45e1d006, 0xc3f27b9a, 0xc9aa53fd, 0x62a80f00, 0xbb25bfe2, 0x35bdd2f6,
            0x71126905, 0xb2040222, 0xb6cbcf7c, 0xcd769c2b, 0x53113ec0, 0x1640e3d3,
            0x38abbd60, 0x2547adf0, 0xba38209c, 0xf746ce76, 0x77afa1c5, 0x20756060,
            0x85cbfe4e, 0x8ae88dd8, 0x7aaaf9b0, 0x4cf9aa7e, 0x1948c25c, 0x02fb8a8c,
            0x01c36ae4, 0xd6ebe1f9, 0x90d4f869, 0xa65cdea0, 0x3f09252d, 0xc208e69f,
            0xb74e6132, 0xce77e25b, 0x578fdfe3, 0x3ac372e6,
        ],
    ];

    let BLOCK_SIZE = 8;
    // Blowfish is defined for 448-bit (56-byte) keys, but the implementations
    // FiSH interoperates with (mIRC FiSH 10, ZNC, OpenSSL's BF_set_key) consume
    // up to 72 bytes and silently ignore anything beyond that. Matching them
    // keeps long passphrases decryptable by the peers that can express them.
    let MAX_KEY_BYTES = 72;
    let SPEC_MAX_KEY_BYTES = 56;

    function Blowfish(keyBytes) {
        let key = keyBytes.slice(0, MAX_KEY_BYTES);
        if (!key.length) {
            throw new Error('Blowfish requires a non-empty key');
        }

        let i;
        let j;
        this.P = new Uint32Array(INITIAL_P);
        this.S = [
            new Uint32Array(INITIAL_S[0]),
            new Uint32Array(INITIAL_S[1]),
            new Uint32Array(INITIAL_S[2]),
            new Uint32Array(INITIAL_S[3]),
        ];

        let offset = 0;
        for (i = 0; i < 18; i++) {
            let data = 0;
            for (j = 0; j < 4; j++) {
                data = ((data << 8) | key[offset % key.length]) >>> 0;
                offset += 1;
            }
            this.P[i] = (this.P[i] ^ data) >>> 0;
        }

        let block = [0, 0];
        for (i = 0; i < 18; i += 2) {
            block = this.encryptWords(block[0], block[1]);
            this.P[i] = block[0];
            this.P[i + 1] = block[1];
        }

        for (let box = 0; box < 4; box++) {
            for (i = 0; i < 256; i += 2) {
                block = this.encryptWords(block[0], block[1]);
                this.S[box][i] = block[0];
                this.S[box][i + 1] = block[1];
            }
        }
    }

    Blowfish.prototype.f = function(x) {
        let S = this.S;
        let a = (x >>> 24) & 0xff;
        let b = (x >>> 16) & 0xff;
        let c = (x >>> 8) & 0xff;
        let d = x & 0xff;
        let t = (((S[0][a] + S[1][b]) >>> 0) ^ S[2][c]) >>> 0;
        return (t + S[3][d]) >>> 0;
    };

    Blowfish.prototype.encryptWords = function(left, right) {
        let l = left >>> 0;
        let r = right >>> 0;
        let tmp;

        for (let i = 0; i < 16; i++) {
            l = (l ^ this.P[i]) >>> 0;
            r = (r ^ this.f(l)) >>> 0;
            tmp = l;
            l = r;
            r = tmp;
        }

        tmp = l;
        l = r;
        r = tmp;

        r = (r ^ this.P[16]) >>> 0;
        l = (l ^ this.P[17]) >>> 0;
        return [l, r];
    };

    Blowfish.prototype.decryptWords = function(left, right) {
        let l = left >>> 0;
        let r = right >>> 0;
        let tmp;

        for (let i = 17; i > 1; i--) {
            l = (l ^ this.P[i]) >>> 0;
            r = (r ^ this.f(l)) >>> 0;
            tmp = l;
            l = r;
            r = tmp;
        }

        tmp = l;
        l = r;
        r = tmp;

        r = (r ^ this.P[1]) >>> 0;
        l = (l ^ this.P[0]) >>> 0;
        return [l, r];
    };

    function readBlock(bytes, offset) {
        let l = ((bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3]) >>> 0;
        let r = ((bytes[offset + 4] << 24) |
            (bytes[offset + 5] << 16) |
            (bytes[offset + 6] << 8) |
            bytes[offset + 7]) >>> 0;
        return [l, r];
    }

    function writeBlock(out, offset, pair) {
        out[offset] = (pair[0] >>> 24) & 0xff;
        out[offset + 1] = (pair[0] >>> 16) & 0xff;
        out[offset + 2] = (pair[0] >>> 8) & 0xff;
        out[offset + 3] = pair[0] & 0xff;
        out[offset + 4] = (pair[1] >>> 24) & 0xff;
        out[offset + 5] = (pair[1] >>> 16) & 0xff;
        out[offset + 6] = (pair[1] >>> 8) & 0xff;
        out[offset + 7] = pair[1] & 0xff;
    }

    function ecbEncrypt(cipher, input) {
        let out = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i += BLOCK_SIZE) {
            let words = readBlock(input, i);
            writeBlock(out, i, cipher.encryptWords(words[0], words[1]));
        }
        return out;
    }

    function ecbDecrypt(cipher, input) {
        let out = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i += BLOCK_SIZE) {
            let words = readBlock(input, i);
            writeBlock(out, i, cipher.decryptWords(words[0], words[1]));
        }
        return out;
    }

    function cbcEncrypt(cipher, input, iv) {
        let out = new Uint8Array(input.length);
        let previous = iv.slice();
        for (let i = 0; i < input.length; i += BLOCK_SIZE) {
            let block = new Uint8Array(BLOCK_SIZE);
            for (let j = 0; j < BLOCK_SIZE; j++) {
                block[j] = input[i + j] ^ previous[j];
            }
            let words = readBlock(block, 0);
            let encrypted = cipher.encryptWords(words[0], words[1]);
            writeBlock(out, i, encrypted);
            previous = out.slice(i, i + BLOCK_SIZE);
        }
        return out;
    }

    function cbcDecrypt(cipher, input, iv) {
        let out = new Uint8Array(input.length);
        let previous = iv.slice();
        for (let i = 0; i < input.length; i += BLOCK_SIZE) {
            let current = input.slice(i, i + BLOCK_SIZE);
            let words = readBlock(current, 0);
            let decrypted = cipher.decryptWords(words[0], words[1]);
            let block = new Uint8Array(BLOCK_SIZE);
            writeBlock(block, 0, decrypted);
            for (let j = 0; j < BLOCK_SIZE; j++) {
                out[i + j] = block[j] ^ previous[j];
            }
            previous = current;
        }
        return out;
    }

    /* ------------------------------------------------------------------ *
     * Byte helpers
     * ------------------------------------------------------------------ */

    function utf8Encode(text) {
        let str = String(text);
        let bytes = [];
        for (let i = 0; i < str.length; i++) {
            let code = str.charCodeAt(i);
            if (code < 0x80) {
                bytes.push(code);
            } else if (code < 0x800) {
                bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
            } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
                let next = str.charCodeAt(i + 1);
                if (next >= 0xdc00 && next <= 0xdfff) {
                    let point = 0x10000 +
                        ((code - 0xd800) << 10) +
                        (next - 0xdc00);
                    bytes.push(
                        0xf0 | (point >> 18),
                        0x80 | ((point >> 12) & 0x3f),
                        0x80 | ((point >> 6) & 0x3f),
                        0x80 | (point & 0x3f)
                    );
                    i += 1;
                } else {
                    bytes.push(0xef, 0xbf, 0xbd);
                }
            } else if (code >= 0xd800 && code <= 0xdfff) {
                bytes.push(0xef, 0xbf, 0xbd);
            } else {
                bytes.push(
                    0xe0 | (code >> 12),
                    0x80 | ((code >> 6) & 0x3f),
                    0x80 | (code & 0x3f)
                );
            }
        }
        return new Uint8Array(bytes);
    }

    /**
     * Decode UTF-8 bytes.
     *
     * Lenient by default: invalid sequences become U+FFFD so display code never
     * throws. Strict mode returns null instead, which is how a decryption is
     * judged implausible (random bytes are almost never valid UTF-8).
     * @param {Uint8Array} bytes Input bytes
     * @param {Boolean} strict Reject invalid input instead of substituting
     * @returns {String|null}
     */
    function utf8Decode(bytes, strict) {
        let out = '';
        let i = 0;

        const fail = () => (strict ? null : '\ufffd');

        while (i < bytes.length) {
            let byte = bytes[i];
            let code = 0;
            let size = 0;
            let minimum = 0;

            if (byte < 0x80) {
                code = byte;
                size = 1;
            } else if (byte >= 0xc0 && byte < 0xe0) {
                code = byte & 0x1f;
                size = 2;
                minimum = 0x80;
            } else if (byte >= 0xe0 && byte < 0xf0) {
                code = byte & 0x0f;
                size = 3;
                minimum = 0x800;
            } else if (byte >= 0xf0 && byte < 0xf8) {
                code = byte & 0x07;
                size = 4;
                minimum = 0x10000;
            } else {
                let replacement = fail();
                if (replacement === null) {
                    return null;
                }
                out += replacement;
                i += 1;
                continue;
            }

            if (i + size > bytes.length) {
                let replacement = fail();
                if (replacement === null) {
                    return null;
                }
                out += replacement;
                break;
            }

            let valid = true;
            for (let j = 1; j < size; j++) {
                let next = bytes[i + j];
                if ((next & 0xc0) !== 0x80) {
                    valid = false;
                    break;
                }
                code = (code << 6) | (next & 0x3f);
            }

            // Reject overlong encodings, surrogate halves and out-of-range code
            // points, all of which are invalid UTF-8.
            if (valid && (code < minimum ||
                (code >= 0xd800 && code <= 0xdfff) ||
                code > 0x10ffff)
            ) {
                valid = false;
            }

            if (!valid) {
                let replacement = fail();
                if (replacement === null) {
                    return null;
                }
                out += replacement;
                i += 1;
            } else if (code > 0xffff) {
                code -= 0x10000;
                out += String.fromCharCode(
                    0xd800 + (code >> 10),
                    0xdc00 + (code & 0x3ff)
                );
                i += size;
            } else {
                out += String.fromCharCode(code);
                i += size;
            }
        }
        return out;
    }

    // Control bytes a real message may contain: tab/newline plus the mIRC
    // formatting set. Anything else means the plaintext is not plausible.
    let ALLOWED_CONTROLS = [
        0x09, 0x0a, 0x0d,
        0x02, 0x03, 0x0f, 0x11, 0x16, 0x1d, 0x1e, 0x1f,
    ];

    function hasImplausibleControls(text) {
        for (let i = 0; i < text.length; i++) {
            let code = text.charCodeAt(i);
            if (code >= 0x20 && code !== 0x7f) {
                continue;
            }
            if (ALLOWED_CONTROLS.indexOf(code) === -1) {
                return true;
            }
        }
        return false;
    }

    function padTo(bytes, size) {
        if (!bytes.length || bytes.length % size === 0) {
            return bytes;
        }
        let padded = new Uint8Array(bytes.length + (size - (bytes.length % size)));
        padded.set(bytes);
        return padded;
    }

    function trimTrailingZeros(bytes) {
        let end = bytes.length;
        while (end > 0 && bytes[end - 1] === 0) {
            end -= 1;
        }
        return bytes.slice(0, end);
    }

    function concatBytes(a, b) {
        let out = new Uint8Array(a.length + b.length);
        out.set(a, 0);
        out.set(b, a.length);
        return out;
    }

    /* ------------------------------------------------------------------ *
     * Base64
     * ------------------------------------------------------------------ */

    let STD_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let STD_B64_LOOKUP = (function() {
        let table = {};
        for (let i = 0; i < STD_B64.length; i++) {
            table[STD_B64.charAt(i)] = i;
        }
        return table;
    }());

    function stdBase64Encode(bytes) {
        let out = '';
        let i;
        for (i = 0; i + 2 < bytes.length; i += 3) {
            let triple = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
            out += STD_B64.charAt((triple >> 18) & 0x3f);
            out += STD_B64.charAt((triple >> 12) & 0x3f);
            out += STD_B64.charAt((triple >> 6) & 0x3f);
            out += STD_B64.charAt(triple & 0x3f);
        }

        let remaining = bytes.length - i;
        if (remaining === 1) {
            let one = bytes[i] << 16;
            out += STD_B64.charAt((one >> 18) & 0x3f);
            out += STD_B64.charAt((one >> 12) & 0x3f);
            out += '==';
        } else if (remaining === 2) {
            let two = (bytes[i] << 16) | (bytes[i + 1] << 8);
            out += STD_B64.charAt((two >> 18) & 0x3f);
            out += STD_B64.charAt((two >> 12) & 0x3f);
            out += STD_B64.charAt((two >> 6) & 0x3f);
            out += '=';
        }

        return out;
    }

    function stdBase64Decode(text) {
        let value = String(text || '').replace(/[^A-Za-z0-9+/]/g, '');
        let out = [];
        let buffer = 0;
        let bits = 0;

        for (let i = 0; i < value.length; i++) {
            let index = STD_B64_LOOKUP[value.charAt(i)];
            if (typeof index === 'undefined') {
                continue;
            }
            buffer = (buffer << 6) | index;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out.push((buffer >> bits) & 0xff);
            }
        }

        return new Uint8Array(out);
    }

    // FiSH ECB payloads use this alphabet and an 8-byte grouped bit order.
    let FISH_B64 = './0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    function fishBase64Encode(bytes) {
        let source = padTo(bytes, BLOCK_SIZE);
        let out = '';
        for (let i = 0; i < source.length; i += BLOCK_SIZE) {
            let left = ((source[i] << 24) |
                (source[i + 1] << 16) |
                (source[i + 2] << 8) |
                source[i + 3]) >>> 0;
            let right = ((source[i + 4] << 24) |
                (source[i + 5] << 16) |
                (source[i + 6] << 8) |
                source[i + 7]) >>> 0;

            let j;
            for (j = 0; j < 6; j++) {
                out += FISH_B64.charAt(right & 0x3f);
                right >>>= 6;
            }
            for (j = 0; j < 6; j++) {
                out += FISH_B64.charAt(left & 0x3f);
                left >>>= 6;
            }
        }
        return out;
    }

    function fishBase64Decode(text) {
        let source = String(text || '');
        while (source.length % 12 !== 0) {
            source += '.';
        }

        let out = new Uint8Array((source.length / 12) * BLOCK_SIZE);
        let position = 0;
        for (let i = 0; i < source.length; i += 12) {
            let left = 0;
            let right = 0;
            let j;
            for (j = 0; j < 6; j++) {
                right = (right | (decodeFishChar(source.charAt(i + j)) << (6 * j))) >>> 0;
            }
            for (j = 0; j < 6; j++) {
                left = (left | (decodeFishChar(source.charAt(i + 6 + j)) << (6 * j))) >>> 0;
            }

            out[position] = (left >>> 24) & 0xff;
            out[position + 1] = (left >>> 16) & 0xff;
            out[position + 2] = (left >>> 8) & 0xff;
            out[position + 3] = left & 0xff;
            out[position + 4] = (right >>> 24) & 0xff;
            out[position + 5] = (right >>> 16) & 0xff;
            out[position + 6] = (right >>> 8) & 0xff;
            out[position + 7] = right & 0xff;
            position += BLOCK_SIZE;
        }
        return out;
    }

    function decodeFishChar(chr) {
        let index = FISH_B64.indexOf(chr);
        return index === -1 ? 0 : index;
    }

    /* ------------------------------------------------------------------ *
     * Randomness
     * ------------------------------------------------------------------ */

    function randomBytes(count) {
        let out = new Uint8Array(count);
        let source = typeof crypto !== 'undefined' ? crypto : null;

        if (source && typeof source.getRandomValues === 'function') {
            source.getRandomValues(out);
            return out;
        }

        // Fall back to Math.random rather than throwing. FiSH is not a
        // high-assurance cipher and this path only runs in odd environments.
        for (let i = 0; i < count; i++) {
            out[i] = Math.floor(Math.random() * 256);
        }
        return out;
    }

    /* ------------------------------------------------------------------ *
     * SHA-256
     * ------------------------------------------------------------------ */

    let SHA256_K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
        0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
        0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
        0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
        0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    function rotr(value, count) {
        return (value >>> count) | (value << (32 - count));
    }

    function sha256(bytes) {
        let bitLength = bytes.length * 8;

        // Message padding: 0x80, zeros, then the 64-bit big endian length.
        let paddedLength = ((bytes.length + 9 + 63) >> 6) << 6;
        let message = new Uint8Array(paddedLength);
        message.set(bytes);
        message[bytes.length] = 0x80;

        let hi = Math.floor(bitLength / 0x100000000);
        let lo = bitLength >>> 0;
        message[paddedLength - 8] = (hi >>> 24) & 0xff;
        message[paddedLength - 7] = (hi >>> 16) & 0xff;
        message[paddedLength - 6] = (hi >>> 8) & 0xff;
        message[paddedLength - 5] = hi & 0xff;
        message[paddedLength - 4] = (lo >>> 24) & 0xff;
        message[paddedLength - 3] = (lo >>> 16) & 0xff;
        message[paddedLength - 2] = (lo >>> 8) & 0xff;
        message[paddedLength - 1] = lo & 0xff;

        let hash = [
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
        ];
        let w = new Uint32Array(64);
        let i;

        for (let offset = 0; offset < message.length; offset += 64) {
            for (i = 0; i < 16; i++) {
                let base = offset + (i * 4);
                w[i] = ((message[base] << 24) |
                    (message[base + 1] << 16) |
                    (message[base + 2] << 8) |
                    message[base + 3]) >>> 0;
            }
            for (i = 16; i < 64; i++) {
                let s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
                let s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
            }

            let a = hash[0];
            let b = hash[1];
            let c = hash[2];
            let d = hash[3];
            let e = hash[4];
            let f = hash[5];
            let g = hash[6];
            let h = hash[7];

            for (i = 0; i < 64; i++) {
                let sum1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
                let choice = ((e & f) ^ (~e & g)) >>> 0;
                let temp1 = (h + sum1 + choice + SHA256_K[i] + w[i]) >>> 0;
                let sum0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
                let majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
                let temp2 = (sum0 + majority) >>> 0;

                h = g;
                g = f;
                f = e;
                e = (d + temp1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) >>> 0;
            }

            hash[0] = (hash[0] + a) >>> 0;
            hash[1] = (hash[1] + b) >>> 0;
            hash[2] = (hash[2] + c) >>> 0;
            hash[3] = (hash[3] + d) >>> 0;
            hash[4] = (hash[4] + e) >>> 0;
            hash[5] = (hash[5] + f) >>> 0;
            hash[6] = (hash[6] + g) >>> 0;
            hash[7] = (hash[7] + h) >>> 0;
        }

        let out = new Uint8Array(32);
        for (i = 0; i < 8; i++) {
            out[i * 4] = (hash[i] >>> 24) & 0xff;
            out[i * 4 + 1] = (hash[i] >>> 16) & 0xff;
            out[i * 4 + 2] = (hash[i] >>> 8) & 0xff;
            out[i * 4 + 3] = hash[i] & 0xff;
        }
        return out;
    }

    /* ------------------------------------------------------------------ *
     * FiSH payloads
     * ------------------------------------------------------------------ */

    let MODE_ECB = 'ecb';
    let MODE_CBC = 'cbc';
    let PREFIX = '+OK ';

    // Documented wire prefixes. FiSH and blowcrypt use "+OK", Mircryption uses
    // "mcps"; CBC marks itself with a "*" glued directly onto the payload.
    //   +OK <fish-base64>     +OK *<base64>
    //   mcps <fish-base64>    mcps *<base64>
    // No client has ever emitted whitespace after the "*", and mIRC FiSH 10
    // feeds the remainder straight into OpenSSL's base64 decoder, which rejects
    // a space. Anything with whitespace there is malformed, not alternate.
    let PREFIXES = [
        { prefix: '+OK *', mode: MODE_CBC, minLength: 22 },
        { prefix: 'mcps *', mode: MODE_CBC, minLength: 22 },
        { prefix: '+OK ', mode: MODE_ECB, minLength: 12 },
        { prefix: 'mcps ', mode: MODE_ECB, minLength: 12 },
    ];

    // Covers both alphabets: FiSH's custom "./0-9a-zA-Z" and standard Base64.
    let BASE64_PAYLOAD = /^[A-Za-z0-9+/.]+={0,2}$/;

    // Escapes an encrypted payload: "+OK +p text" carries plaintext, not
    // ciphertext.
    let PLAINTEXT_ESCAPE = '+p ';

    // Defensive bound on wire payloads. IRC lines are far smaller; this only
    // stops a bouncer or crafted line from handing us an enormous buffer.
    let MAX_PAYLOAD_CHARS = 16384;

    // DH1080 public keys are at most 181 characters; anything far larger would
    // only cost a large BigInt allocation.
    let MAX_DH_KEY_CHARS = 256;

    /**
     * Split an encrypted wire string into its mode and payload.
     *
     * Returns null when the text is not encrypted at all, and an entry with
     * `invalid: true` when it carries a recognised prefix but a payload that
     * could not be valid base64 (for example `+OK * <payload>`). Callers show a
     * placeholder for invalid payloads instead of trying to decrypt them.
     *
     * A payload shorter than one cipher block is treated as plain chat rather
     * than encryption, so a message that merely starts with "+OK " is not
     * hidden behind a placeholder.
     * @param {String} text Wire text
     * @returns {Object|null}
     */
    function parsePayload(text) {
        let value = String(text || '');

        for (let i = 0; i < PREFIXES.length; i++) {
            let entry = PREFIXES[i];
            if (value.indexOf(entry.prefix) !== 0) {
                continue;
            }

            let payload = value.slice(entry.prefix.length);

            // Plaintext escape: "+OK +p text" / "+OK *+p text" means the sender
            // deliberately sent plaintext inside FiSH framing. A space cannot
            // appear in a real payload, so this never collides with ciphertext.
            if (payload.indexOf(PLAINTEXT_ESCAPE) === 0 &&
                payload.length > PLAINTEXT_ESCAPE.length
            ) {
                return {
                    mode: entry.mode,
                    plaintext: true,
                    payload: payload.slice(PLAINTEXT_ESCAPE.length),
                };
            }

            if (payload.length > MAX_PAYLOAD_CHARS) {
                return { mode: entry.mode, payload: '', invalid: true };
            }

            if (payload.length < entry.minLength) {
                return null;
            }

            if (!BASE64_PAYLOAD.test(payload)) {
                return { mode: entry.mode, payload: '', invalid: true };
            }

            return { mode: entry.mode, payload: payload };
        }

        return null;
    }

    function isEncryptedText(text) {
        return !!parsePayload(text);
    }

    function encryptECB(key, text) {
        let cipher = new Blowfish(utf8Encode(key));
        let input = padTo(utf8Encode(text), BLOCK_SIZE);
        return PREFIX + fishBase64Encode(ecbEncrypt(cipher, input));
    }

    function encryptCBC(key, text) {
        let cipher = new Blowfish(utf8Encode(key));
        let input = padTo(utf8Encode(text), BLOCK_SIZE);
        // Mircryption prepends eight random bytes before CBC encrypting.
        let withIv = concatBytes(randomBytes(BLOCK_SIZE), input);
        let encrypted = cbcEncrypt(cipher, withIv, new Uint8Array(BLOCK_SIZE));
        // The mode marker is glued to the payload: "+OK *<base64>".
        return PREFIX + '*' + stdBase64Encode(encrypted);
    }

    function encrypt(key, mode, text) {
        return mode === MODE_CBC ?
            encryptCBC(key, text) :
            encryptECB(key, text);
    }

    function decryptECBBytes(key, payload) {
        let cipher = new Blowfish(utf8Encode(key));
        let input = padTo(fishBase64Decode(payload), BLOCK_SIZE);
        return trimTrailingZeros(ecbDecrypt(cipher, input));
    }

    function decryptECB(key, payload) {
        return utf8Decode(decryptECBBytes(key, payload));
    }

    function decryptCBCBytes(key, payload) {
        let cipher = new Blowfish(utf8Encode(key));
        let input = stdBase64Decode(payload);
        if (!input.length || input.length % BLOCK_SIZE !== 0) {
            throw new Error('Invalid CBC payload');
        }

        let decrypted = cbcDecrypt(cipher, input, new Uint8Array(BLOCK_SIZE));
        return trimTrailingZeros(decrypted.slice(BLOCK_SIZE));
    }

    function decryptCBC(key, payload) {
        return utf8Decode(decryptCBCBytes(key, payload));
    }

    /**
     * Decrypt a payload to text.
     *
     * Strict mode refuses output that cannot plausibly be a chat message:
     * invalid UTF-8, control bytes outside the formatting set, or nothing at
     * all. FiSH has no MAC, so this is a plausibility check rather than
     * authentication, but random bytes from a wrong key or a mismatched mode
     * are essentially never valid UTF-8.
     * @param {String} key Key text
     * @param {String} mode `ecb` or `cbc`
     * @param {String} payload Encoded ciphertext
     * @param {Object} options `{ strict: true }` to validate the plaintext
     * @returns {String}
     */
    function decrypt(key, mode, payload, options) {
        let bytes = mode === MODE_CBC ?
            decryptCBCBytes(key, payload) :
            decryptECBBytes(key, payload);

        if (!options || !options.strict) {
            return utf8Decode(bytes);
        }

        if (!bytes.length) {
            throw new Error('Invalid plaintext');
        }

        let text = utf8Decode(bytes, true);
        if (text === null || hasImplausibleControls(text)) {
            throw new Error('Invalid plaintext');
        }

        return text;
    }

    /* ------------------------------------------------------------------ *
     * DH1080
     * ------------------------------------------------------------------ */

    let DH_PRIME_HEX = 'FBE1022E23D213E8ACFA9AE8B9DFADA3EA6B7AC7A7B7E95AB5EB2DF858921FEADE95E6AC7BE7DE6ADBAB8A783E7AF7A7FA6A2B7BEB1E72EAE2B72F9FA2BFB2A2EFBEFAC868BADB3E828FA8BADFADA3E4CC1BE7E8AFE85E9698A783EB68FA07A77AB6AD7BEB618ACF9CA2897EB28A6189EFA07AB99A8A7FA9AE299EFA7BA66DEAFEFBEFBF0B7D8B';

    let DH_PRIME = BigInt('0x' + DH_PRIME_HEX);
    let DH_GENERATOR = BigInt(2);
    let DH_PRIVATE_BITS = 520;

    function bytesToBigInt(bytes) {
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
        }
        return hex ? BigInt('0x' + hex) : BigInt(0);
    }

    function bigIntToBytes(value) {
        let hex = value.toString(16);
        if (hex.length % 2) {
            hex = '0' + hex;
        }
        let out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) {
            out[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return out;
    }

    function modPow(base, exponent, modulus) {
        let result = BigInt(1);
        let b = base % modulus;
        let e = exponent;

        while (e > BigInt(0)) {
            if (e & BigInt(1)) {
                result = (result * b) % modulus;
            }
            b = (b * b) % modulus;
            e >>= BigInt(1);
        }
        return result;
    }

    // DH1080 keys use standard Base64 without padding, with one FiSH quirk:
    // when the byte length is a multiple of three the reference encoders
    // (WeeChat, ZNC) emit an extra zero-value character. Matching it keeps our
    // keys byte-identical to every peer's own output.
    function dhBase64Encode(bytes) {
        let encoded = stdBase64Encode(bytes).replace(/=+$/, '');
        if (bytes.length > 0 && bytes.length % 3 === 0) {
            encoded += 'A';
        }
        return encoded;
    }

    function encodeDhKey(value) {
        return dhBase64Encode(bigIntToBytes(value));
    }

    function decodeDhKey(text) {
        let value = String(text || '');
        if (value.length > MAX_DH_KEY_CHARS) {
            throw new Error('Invalid DH1080 public key');
        }
        return bytesToBigInt(stdBase64Decode(value));
    }

    function dhGeneratePrivate() {
        let bytes = randomBytes(Math.ceil(DH_PRIVATE_BITS / 8));
        let value = bytesToBigInt(bytes) % (DH_PRIME - BigInt(3));
        return value + BigInt(2);
    }

    function dhPublicKey(privateKey) {
        return modPow(DH_GENERATOR, privateKey, DH_PRIME);
    }

    function dhGenerate() {
        let privateKey = dhGeneratePrivate();
        return {
            privateKey: privateKey,
            publicKey: encodeDhKey(dhPublicKey(privateKey)),
        };
    }

    /**
     * Derive the shared Blowfish key from a DH1080 exchange.
     *
     * The shared secret is hashed with SHA-256 and encoded as unpadded standard
     * Base64, which is what FiSH peers expect as the Blowfish key.
     *
     * S is hashed as a *minimal* big-endian integer. When its most significant
     * byte happens to be zero (about one exchange in 256) that makes the hashed
     * input 134 bytes instead of 135; both WeeChat and ZNC hash the stripped
     * form, so padding it back to 135 would break those exchanges.
     * @param {BigInt|String} privateKey Our private key, or its Base64 form
     * @param {String} theirPublicKey The peer's Base64 public key
     * @returns {String} Blowfish key
     */
    function dhSharedKey(privateKey, theirPublicKey) {
        let priv = typeof privateKey === 'string' ?
            decodeDhKey(privateKey) :
            privateKey;
        let pub = decodeDhKey(theirPublicKey);

        if (pub <= BigInt(1) || pub >= (DH_PRIME - BigInt(1))) {
            throw new Error('Invalid DH1080 public key');
        }

        return dhKeyFromSecret(modPow(pub, priv, DH_PRIME));
    }

    /**
     * Turn a shared secret integer into the Base64 Blowfish key.
     * @param {BigInt} secret Shared secret, Y^x mod p
     * @returns {String} Blowfish key
     */
    function dhKeyFromSecret(secret) {
        if (typeof secret !== 'bigint' || secret <= BigInt(0)) {
            throw new Error('Invalid DH1080 shared secret');
        }

        return dhBase64Encode(sha256(bigIntToBytes(secret)));
    }

    return {
        MODE_ECB: MODE_ECB,
        MODE_CBC: MODE_CBC,
        PREFIX: PREFIX,
        DH_PRIME_HEX: DH_PRIME_HEX,
        Blowfish: Blowfish,
        sha256: sha256,
        utf8Encode: utf8Encode,
        utf8Decode: utf8Decode,
        stdBase64Encode: stdBase64Encode,
        stdBase64Decode: stdBase64Decode,
        fishBase64Encode: fishBase64Encode,
        fishBase64Decode: fishBase64Decode,
        parsePayload: parsePayload,
        isEncryptedText: isEncryptedText,
        PLAINTEXT_ESCAPE: PLAINTEXT_ESCAPE,
        encrypt: encrypt,
        decrypt: decrypt,
        encryptECB: encryptECB,
        decryptECB: decryptECB,
        encryptCBC: encryptCBC,
        decryptCBC: decryptCBC,
        dhGenerate: dhGenerate,
        dhPublicKey: dhPublicKey,
        dhSharedKey: dhSharedKey,
        dhKeyFromSecret: dhKeyFromSecret,
        MAX_KEY_BYTES: MAX_KEY_BYTES,
        SPEC_MAX_KEY_BYTES: SPEC_MAX_KEY_BYTES,
        randomBytes: randomBytes,
    };
}));
