# FiSH Encryption

FiSH ("Fish Is Secure Helper") encrypts IRC private messages, channels, notices,
actions, and channel topics with Blowfish. Kiwi IRC implements it as a bundled
plugin so that no encryption code lives in the core client.

> FiSH is a weak, unauthenticated cipher. Blowfish ECB leaks patterns in the
> plaintext, and neither mode detects tampering. Anyone holding the key can read
> everything, and nobody can tell whether a message was modified. Use it for
> lightweight privacy, not for anything that actually needs to stay secret.

## Wire format

| Case         | Wire text                                                  |
| ------------ | ---------------------------------------------------------- |
| ECB          | `+OK <fish-base64>`                                        |
| CBC          | `+OK *<base64>`                                            |
| Action       | `\x01ACTION +OK <cipher>\x01`                              |
| Key exchange | `NOTICE <nick> :DH1080_INIT\|DH1080_FINISH <base64> [CBC]` |

Mircryption's `mcps` prefix is accepted on incoming messages (`mcps <payload>`
and `mcps *<payload>`); Kiwi IRC always sends `+OK`.

The mode marker is glued directly onto the payload. No implementation puts
whitespace there, and mIRC FiSH 10 feeds the remainder straight into OpenSSL's
Base64 decoder, which rejects a space, so `+OK * <payload>` is malformed. A
payload that long is shown as an encrypted placeholder rather than being
decoded; a short look-alike such as `+OK thanks` is treated as ordinary chat so
it is not hidden and still reaches local logs.

ECB payloads use FiSH's custom Base64 alphabet
(`./0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`) in 8-byte
groups. CBC payloads use standard padded Base64 with a zero IV and eight random
bytes prepended, exactly as Mircryption does.

Keys are ordinary Blowfish keys: DH1080 derives a 43-character unpadded Base64
string from the SHA-256 of the shared secret, and channel keys are whatever
passphrase the user chooses.

## Commands

| Command                            | Behaviour                                              |
| ---------------------------------- | ------------------------------------------------------ |
| `/key [target] [mode:]key`         | Set a key. `mode` is `ecb:` (default) or `cbc:`.       |
| `/key [target] del:`               | Delete a key.                                          |
| `/key [target]`                    | Show the stored key locally.                           |
| `/keyx [-cbc\|-ecb] [nick]`        | Start a DH1080 exchange, default `-cbc`.               |
| `/topic+ <topic>`                  | Set an encrypted channel topic.                        |
| `/action+ <destination> <message>` | Send an encrypted ACTION.                              |
| `/me+ <message>`                   | Default alias for `/action+ $destination`, like `/me`. |
| `/notice+ [target] <message>`      | Send an encrypted NOTICE.                              |
| `/fish -set <passphrase>`          | Protect stored keys with a passphrase.                 |
| `/fish -del`                       | Remove passphrase protection.                          |
| `/fish <passphrase>`               | Unlock the stored keys.                                |

A single argument to `/key` is treated as a target when it is a channel name or
already has a key; otherwise it is the key for the current buffer. Key output is
always local: keys are never sent to a channel or echoed over IRC.

Every plugin command appears in the `/` autocomplete list with a localized
description. `/me+` is a user alias in the default config, not a plugin command,
so it is not listed there.

Only `ecb:`, `cbc:` and `del:` are valid mode prefixes. Anything else that looks
like one (`ccb:secret`) is rejected rather than stored as a key, so a typo
cannot leave an unusable key behind. A key that genuinely contains a colon has
to state its mode: `ecb:my:key` stores `my:key`. Unknown `/keyx` and `/fish`
options are rejected the same way instead of being read as a nickname or
passphrase.

## Settings UI

Channel Settings has an **Encryption** tab. It sets the key for the current
channel:

- **Encryption Type** is None, Blowfish ECB or Blowfish CBC. Selecting None
  deletes the channel key.
- The key field is a password input with a reveal toggle, so the value stays
  masked by default, and it includes the same password-strength meter as the
  account forms.
- ECB and CBC each show a short warning: ECB leaks repeated 8-byte plaintext
  blocks, and CBC uses a fixed IV with no MAC so tampering is undetected.
- Saving goes through the same key store as `/key`, including the 56-byte
  warning and the passphrase lock.

The user information sidebar in a query has the same section. It also has **Key
Exchange**, which starts a DH1080 exchange and fills in the derived key. The
button always negotiates CBC; `/keyx -ecb` is still available for a manual ECB
exchange.

When the keys are protected by a passphrase and locked, the controls are
disabled until the keys are unlocked in General settings.

Local FiSH status lines use the core system-message path, so they render like
mode notices in every layout and are not affected by the mode-change visibility
setting.

## Automatic key exchange

**Automatic Key Exchange** (General settings, default off) starts a DH1080
exchange when a private message has no key. The message is held until the
exchange completes and is then encrypted and sent. If the exchange fails or
times out after 30 seconds, nothing is sent and an error repeats the draft so it
is not lost. Plaintext is never used as a fallback for a conversation that is
supposed to be encrypted.

Channels are never auto-exchanged; set their keys manually.

Service nicks advertised by the server (`RPL_ISUPPORT` services) are skipped.

## Missing keys and placeholders

A message that cannot be decrypted shows a clickable `[ENCRYPTED with FiSH ECB]`
or `[ENCRYPTED with FiSH CBC]` placeholder. Clicking retries decryption with the
keys that are loaded. Existing placeholders are never rewritten automatically;
**Decrypt Encrypted Messages** in the network settings retries every placeholder
at once.

Decryption is validated before display. FiSH has no MAC, so this is a
plausibility check rather than authentication: output that is not valid UTF-8,
that contains control bytes outside tab/newline and the mIRC formatting set, or
that is empty counts as a failed decryption and shows the placeholder with a
"this key did not decrypt the message" hint. That covers a wrong key, a CBC/ECB
mode mismatch and crafted payloads, none of which render as mojibake any more. A
payload that happens to decode to plausible text still displays, which is
unavoidable without authenticated encryption. Wire payloads over 16 KB and
DH1080 public keys over 256 characters are rejected outright.

Encrypted messages, including decrypted ones, are excluded from local chat logs.

Local notifications show the decrypted text; web push never does. The service
worker replaces any encrypted payload, including CTCP actions, with
`[Encrypted Message]`.

## Plaintext escape

Prefix a message with `+p ` to send it unencrypted even where FiSH would
otherwise encrypt, without removing the key. `/msg`, `/action` and `/notice` all
honour it; `/action+` and `/notice+` always encrypt. The prefix requires a
trailing space and something after it, and only applies where a key is set or a
query would trigger automatic exchange — a literal `+p` in a keyless channel is
sent as typed. It also works while keys are locked, since typing it is explicit
consent to plaintext.

Incoming `+OK +p <text>`, `+OK *+p <text>` and `mcps +p <text>` carry plaintext
inside the framing: the prefixes are stripped, the text is not decrypted, and it
is treated as a normal message (logged, no marker pill). It needs no key. Web
push shows that escaped text rather than `[Encrypted Message]`.

## Multiline messages

One FiSH payload is one IRC line. Before encryption, outgoing text is split at
logical newlines and then at the payload byte limit, so every chunk becomes its
own `+OK` line. Empty lines are not sent, matching the client's plaintext
behaviour.

At the 350-byte content budget the exact plaintext limits are:

| Mode | Payload   | Wire |
| ---- | --------- | ---- |
| CBC  | 248 bytes | 349  |
| ECB  | 224 bytes | 340  |

CBC carries an 8-byte IV that the simple base64 estimate does not include. ECB
uses FiSH's 12-characters-per-8-bytes base64, so its limit is lower. CTCP ACTION
reserves nine bytes for `\x01ACTION `, giving 240 bytes (CBC) or 224 (ECB) per
action payload.

When the server advertises `draft/multiline`, the joined payload lines are sent
as one multiline batch, with each payload as its own batch line. Without the
capability they are sent as separate PRIVMSGs. A single long line therefore
wraps at payload boundaries and arrives as a multiline message; there is no
cross-payload continuation marker because other FiSH clients would display it.

Actions are sent as separate ACTION messages, never as a multiline batch: core
assembles batch lines before CTCP parsing, so batching would lose the ACTION
framing.

Incoming batches are decrypted line by line and joined with newlines. A legacy
peer may instead send one payload that decrypts to text containing newlines;
that is displayed as a multiline message too. If a message mixes payload lines
with plaintext lines it is left entirely alone rather than partially decrypted.

## Key storage and passphrases

Keys are stored per network and target in the plugin secret store, never in
`config.json` or an exported profile.

- Without a passphrase, desktop builds keep them encrypted with the operating
  system key store; web builds keep them in localStorage with no OS protection.
- With a passphrase, the key blob is encrypted with AES-GCM using a PBKDF2
  (SHA-256, 210000 iterations) key. It must be unlocked with
  `/fish <passphrase>` before anything can be encrypted or decrypted.
- While locked, a small plaintext index still records which targets are
  encrypted, so Kiwi IRC refuses to send plaintext to them instead of silently
  downgrading.

If the OS key store is unavailable on the desktop, plugin secrets fall back to
plaintext only when no encrypted file already exists for them.

## Encryption marker

Decrypted messages are marked so they are visually distinct. The marker is
rendered as a bordered pill with the glyph `⚷` by default, in the same colour as
the surrounding text so it reads on every theme, at reduced opacity so a channel
where every message is encrypted does not become noisy. Hovering shows
"Encrypted with FiSH (CBC)" or "(ECB)".

- Position is Prefix, Suffix, or None in General settings.
- The pill's text is config-only (the `marker` setting); there is no settings
  field for it. It is escaped when rendered, and an empty value means no marker.
- The marker is a plugin message **block**, not text. Incoming bodies can only
  produce the block types the parser emits, so a plaintext message cannot
  imitate the pill no matter which glyphs or IRC formatting it contains. It
  never reaches the wire, the local chat log, or a notification.
- The NephDeck theme plays a one-shot signal-tear effect on any body that
  contains the marker, so setting the position to None also turns that effect
  off; there is no row-level encrypted flag in the DOM.
- A row-level icon next to the bot/operator/rerouted icons would need a generic
  per-row icon hook plus layouts that accept a variable number of gutter icons;
  `prefix`/`suffix`/`none` are the only positions for now.

This is a cue that Kiwi decrypted an encrypted message. It says nothing about
who sent it and nothing about whether it was tampered with — FiSH has no MAC.

## Interoperability

The plugin is compatible with mIRC FiSH, ZNC's fish module, WeeChat's fish
script, and other DH1080 implementations. A few points where FiSH clients
disagree, and what Kiwi IRC does:

- CBC mode is negotiated by appending a `CBC` token to `DH1080_INIT` and
  `DH1080_FINISH`. A peer that answers without the token is treated as ECB. The
  older Mircryption spelling `DH1080_INIT_CBC <key>` is also accepted.
- Notices replayed from chat history are ignored: they are hidden from the
  message list but never derive a key, send a reply, or complete an exchange.
- Some implementations send the whole remainder of the line as the public key.
  Kiwi IRC splits on whitespace, matching FiSH 10 and mIRC.
- DH1080 public keys are standard Base64 without padding, plus one quirk: when
  the key's byte length is a multiple of three (which 135-byte keys always are)
  the reference encoders append a zero-value character. Kiwi IRC emits the same
  extra character so its keys are byte-identical to a peer's own output.
- The SHA-256 input is the shared secret at its minimal length. About one
  exchange in 256 produces a secret with a zero leading byte, and every
  reference hashes the stripped integer, so padding it back to 135 bytes would
  break exactly those exchanges.
- Blowfish is defined for 56-byte keys. mIRC FiSH 10, ZNC and OpenSSL consume up
  to 72 bytes and ignore the rest, while WeeChat (through pycryptodome) refuses
  anything longer than 56. Kiwi IRC truncates at 72 to match the wider set and
  warns when a key exceeds the 56-byte definition. Key schedules are verified
  against OpenSSL's `BF_set_key`.

## Golden vectors

`tests/fixtures/fish/vectors.json` holds ECB/CBC/DH1080 vectors produced by a
reference implementation. It is regenerated deliberately, never by `npm test`:

```sh
npm run generate:fish-vectors
```

The generator reads the reference from `scripts/fish.py`, which is gitignored
and never committed, and writes the fixture itself — nothing needs redirecting.
To use a copy kept elsewhere, pass `--reference PATH`. A run without
pycryptodome refuses to overwrite an existing fixture rather than silently
dropping the ECB/CBC vectors (`--allow-partial` overrides).

`scripts/fish-vectors.py` stubs WeeChat, seeds the reference's `urandom` so the
DH1080 exchanges are reproducible, and records the reference's own answer for
each case (including the ones it refuses, like 60-byte keys). The reference
source itself is not vendored: WeeChat's `fish.py` is GPL-3.0-or-later.

After regenerating, the DH exchanges and every ECB wire must be byte-identical;
only the CBC wires change, because their first block is random.

## Implementation

- `static/plugins/fish.js` — commands, filters, settings, key storage.
- `static/plugins/fish/crypto.js` — Blowfish, FiSH Base64, DH1080, SHA-256,
  UTF-8. Vendored: the Blowfish constant tables come from
  [raptor-blowfish](https://github.com/jtordgeman/raptor-blowfish) (MIT).
- Core hooks used: `addOutgoingMessageFilter`, `addIncomingMessageFilter`,
  `addIncomingTopicFilter`, `getSecret`/`setSecret`, `irc.message`, and
  `message.is_encrypted`.
- Tests: `tests/unit/FishCrypto.spec.js` (cipher, wire grammar, DH1080) and
  `tests/unit/FishPlugin.spec.js` (commands, placeholders, key storage and the
  DH1080 state machine).
