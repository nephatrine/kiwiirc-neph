# FiSH Encryption

FiSH encrypts private messages, channels, notices, actions, and channel topics
with Blowfish. It is bundled as a plugin and works with other FiSH clients.

> FiSH is a weak, unauthenticated cipher. ECB leaks patterns in the plaintext,
> and neither mode detects tampering. Anyone with the key can read the messages,
> and nobody can tell whether a message was modified. Use it for lightweight
> privacy, not for anything that must stay secret.

## Enable

The default `plugins` list includes this entry:

```json
"plugins": [
    { "name": "fish", "url": "static/plugins/fish.html" }
]
```

Remove it from the `plugins` array to disable the plugin.

## Wire Format

| Case         | Wire text                                               |
| ------------ | ------------------------------------------------------- |
| ECB          | `+OK <payload>`                                         |
| CBC          | `+OK *<payload>`                                        |
| Action       | `\x01ACTION +OK ...\x01`                                |
| Key exchange | `NOTICE <nick> :DH1080_INIT\|DH1080_FINISH <key> [CBC]` |

Kiwi sends `+OK`. Incoming `mcps` and `mcps *` messages from Mircryption are
also accepted. CBC is marked by a `*` directly before the payload.

## Commands

- `/key [target] [mode:]key` — Set a key. `mode` is `ecb:` (default) or `cbc:`.
- `/key [target] del:` — Delete a key.
- `/key [target]` — Show the stored key locally.
- `/keyx [-cbc|-ecb] [nick]` — Start a DH1080 exchange, default `-cbc`.
- `/topic+ <topic>` — Set an encrypted channel topic.
- `/action+ <destination> <message>` — Send an encrypted ACTION.
- `/me+ <message>` — Alias for `/action+ $destination`, like `/me`.
- `/notice+ [target] <message>` — Send an encrypted NOTICE.
- `/fish -set <passphrase>` — Protect stored keys with a passphrase.
- `/fish -del` — Remove passphrase protection.
- `/fish <passphrase>` — Unlock the stored keys.
- `/fish` — Show whether keys are locked or unlocked.

A single `/key` argument is treated as a target when it is a channel name or
already has a key; otherwise it is the key for the current buffer. Keys are
always displayed locally and are never sent to IRC.

Valid mode prefixes are `ecb:`, `cbc:`, and `del:`. Anything else that looks
like a mode is rejected rather than stored, so a typo cannot leave an unusable
key. A key containing a colon must state its mode, for example `ecb:my:key`.

## Settings UI

Channel Settings has an **Encryption** tab for the current channel:

- **Encryption Type** is None, Blowfish ECB, or Blowfish CBC. Selecting None
  deletes the channel key.
- The key field is masked with a reveal toggle and a password-strength meter.
- ECB and CBC show a short warning about their weaknesses.
- Saving uses the same key store as `/key`, including the 56-byte warning and
  passphrase lock.

A query's user information sidebar has the same section plus **Key Exchange**,
which starts a DH1080 exchange and fills in the derived key. The button always
negotiates CBC; `/keyx -ecb` is available for a manual ECB exchange.

When keys are passphrase-protected and locked, these controls are disabled until
the keys are unlocked in General settings.

## Automatic Key Exchange

**Automatic Key Exchange** is off by default. When enabled, it starts a DH1080
exchange when a private message has no key. The message is held until the
exchange completes and is then encrypted and sent. If the exchange fails or
times out after 30 seconds, nothing is sent and an error repeats the draft.

Channels are never auto-exchanged; set their keys manually. Service nicks
advertised by the server are skipped.

## Missing Keys and Placeholders

A message that cannot be decrypted shows a clickable `[ENCRYPTED with FiSH ECB]`
or `[ENCRYPTED with FiSH CBC]` placeholder. Clicking retries decryption with the
loaded keys. **Decrypt Encrypted Messages** in the network settings retries
every placeholder at once.

A wrong key, a mode mismatch, or a malformed payload stays a placeholder rather
than showing garbage. Encrypted messages, including decrypted ones, are excluded
from local chat logs. Local notifications show decrypted text; web push shows
only `[Encrypted Message]`.

## Plaintext Escape

Prefix a message with `+p ` to send it unencrypted where FiSH would otherwise
encrypt, without removing the key. `/msg`, `/action`, and `/notice` honour it;
`/action+` and `/notice+` always encrypt. The prefix needs a trailing space and
something after it, and only applies where a key is set or a query would trigger
automatic exchange. It also works while keys are locked, since typing it is
explicit consent to plaintext.

Incoming `+OK +p <text>`, `+OK *+p <text>`, and `mcps +p <text>` carry plaintext
inside the framing: the prefix is stripped, the text is not decrypted, and it is
logged as a normal message without a marker. Web push shows that text.

## Multiline Messages

One FiSH payload is one IRC line. Outgoing text is split at newlines and at the
payload size limit before encryption, so every chunk becomes its own `+OK` line.
Empty lines are not sent.

When the server supports `draft/multiline`, the encrypted lines are sent as one
multiline batch; otherwise they are sent as separate messages. A long single
line therefore arrives as a multiline message split at payload boundaries.
Actions are sent as separate ACTION messages.

Incoming batches are decrypted line by line. A legacy peer may send one payload
that decrypts to text containing newlines; that also displays as multiline. A
message that mixes encrypted and plaintext lines is left alone rather than
partially decrypted.

## Key Storage and Passphrases

Keys are stored per network and target in the plugin secret store, never in
`config.json` or an exported profile.

- Without a passphrase, desktop builds use the operating system key store; web
  builds use browser storage without OS protection.
- With a passphrase, the key blob is encrypted and must be unlocked with
  `/fish <passphrase>` before anything can be encrypted or decrypted.
- While locked, a plaintext index still records which targets are encrypted, so
  Kiwi refuses to send plaintext to them.

## Encryption Marker

Decrypted messages show a small marker, a bordered `⚷` pill by default, so they
are visually distinct. Hovering shows the mode. Position is Prefix, Suffix, or
None in General settings; the glyph is config-only and an empty value disables
it. The marker is only a cue that decryption succeeded; it says nothing about
the sender or whether the message was tampered with.

## Interoperability

Kiwi interoperates with mIRC FiSH, ZNC's fish module, WeeChat's fish script, and
other DH1080 implementations, with a few differences:

- CBC is negotiated by a `CBC` token on `DH1080_INIT` and `DH1080_FINISH`. A
  peer that answers without it is treated as ECB. The older
  `DH1080_INIT_CBC <key>` spelling is accepted.
- DH1080 notices replayed from chat history are ignored, so old exchanges cannot
  overwrite a current key or trigger a reply.
- Some clients send the whole rest of the line as the public key; Kiwi splits on
  whitespace, matching FiSH 10 and mIRC.
- Blowfish is defined for 56-byte keys. Kiwi accepts up to 72 bytes and warns
  above 56; other clients may reject or truncate longer keys differently.

The plugin does not authenticate messages and has no message-integrity check.
