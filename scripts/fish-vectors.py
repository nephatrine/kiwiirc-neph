#!/usr/bin/env python3
"""Generate FiSH golden vectors from a reference implementation.

This project does not vendor FiSH reference code: WeeChat's ``fish.py`` is
GPL-3.0-or-later and this repository is not. Only derived *values* (ciphertexts,
derived keys) are written into ``tests/fixtures/fish/vectors.json``.

Usage:
    python3 scripts/fish-vectors.py
    python3 scripts/fish-vectors.py --reference /path/to/fish.py
    python3 scripts/fish-vectors.py --output - > /tmp/vectors.json

The reference lives at ``scripts/fish.py`` by default and is gitignored: it is
never committed. Output defaults to ``tests/fixtures/fish/vectors.json``; a
summary goes to stderr so ``--output -`` can be piped.

The DH1080 half only needs the standard library. The ECB/CBC half needs
pycryptodome (``Cryptodome`` or ``Crypto``); when it is missing those sections
are emitted empty and the checked-in Blowfish vectors stay authoritative.

Determinism: the reference's ``urandom`` is replaced with a SHA-256 counter
stream so DH key material is reproducible, and ``--seed`` changes it.
"""

import argparse
import hashlib
import importlib.util
import json
import os
import sys
import types

DEFAULT_SEED = 'kiwi-fish-vectors'


def install_weechat_stub():
    """The reference is a WeeChat script; stub just enough to import it."""
    weechat = types.ModuleType('weechat')

    def noop(*args, **kwargs):
        return None

    for name in (
        'register', 'hook_modifier', 'hook_config', 'hook_line', 'hook_command',
        'hook_timer', 'bar_item_new', 'bar_item_update', 'config_new',
        'config_new_section', 'config_new_option', 'config_read', 'config_write',
        'config_get', 'config_option_get', 'config_option_set',
        'config_option_set_null', 'config_weechat_read', 'command',
        'command_options', 'printf_date_tags', 'log', 'prnt',
    ):
        setattr(weechat, name, noop)

    weechat.prefix = lambda *a, **k: ''
    weechat.info_get = lambda *a, **k: ''
    weechat.secure_get = lambda *a, **k: None
    weechat.secure_set = lambda *a, **k: None
    weechat.string_split = lambda value, sep: value.split(sep)
    weechat.string_strip = lambda value, chars=None: value.strip(chars)
    weechat.string_eval_expression = lambda value, *a, **k: value
    weechat.hook_signal_send = noop

    sys.modules.setdefault('weechat', weechat)


def load_reference(path):
    install_weechat_stub()
    # Do not leave __pycache__ next to the reference script.
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('fish_reference', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Sha256Stream:
    """Deterministic stand-in for os.urandom."""

    def __init__(self, seed):
        self.seed = seed.encode('utf-8')
        self.counter = 0
        self.buffer = b''

    def read(self, count):
        while len(self.buffer) < count:
            block = hashlib.sha256(
                self.seed + b':' + str(self.counter).encode('ascii')
            ).digest()
            self.counter += 1
            self.buffer += block
        out, self.buffer = self.buffer[:count], self.buffer[count:]
        return out


def dh_vectors(reference, seed):
    """Deterministic DH1080 exchanges plus a leading-zero-secret case."""
    stream = Sha256Stream(seed)
    reference.urandom = stream.read

    prime = reference.p_dh1080
    b64 = reference.dh1080_b64encode
    secret_of = reference.dh1080_secret

    exchanges = []
    for _ in range(3):
        alice = reference.DH1080Ctx()
        bob = reference.DH1080Ctx()

        alice.secret = pow(bob.public, alice.private, prime)
        bob.secret = pow(alice.public, bob.private, prime)

        alice_key = secret_of(alice)
        bob_key = secret_of(bob)
        if alice_key != bob_key:
            raise RuntimeError('reference derived mismatched keys')

        exchanges.append({
            'alicePrivate': b64(reference.int2bytes(alice.private)),
            'alicePublic': b64(reference.int2bytes(alice.public)),
            'bobPrivate': b64(reference.int2bytes(bob.private)),
            'bobPublic': b64(reference.int2bytes(bob.public)),
            'key': alice_key,
        })

    # A shared secret whose most significant byte is zero. Hashing it as a
    # 134-byte integer and hashing it left-padded to 135 bytes give different
    # keys; this vector pins which one the reference does.
    short_ctx = reference.DH1080Ctx()
    short_ctx.secret = (1 << 1071) + 12345
    short_key = secret_of(short_ctx)

    wide_ctx = reference.DH1080Ctx()
    wide_ctx.secret = prime - 1
    wide_key = secret_of(wide_ctx)

    return {
        'primeHex': reference.p_dh1080.to_bytes(135, 'big').hex().upper(),
        'primeBitLength': prime.bit_length(),
        'publicKeyLength': len(b64(reference.int2bytes(prime - 1))),
        'keyLength': len(short_key),
        'exchanges': exchanges,
        'shortSecret': {
            'secretHex': short_ctx.secret.to_bytes(134, 'big').hex(),
            'byteLength': 134,
            'key': short_key,
        },
        'wideSecret': {
            'secretHex': wide_ctx.secret.to_bytes(135, 'big').hex(),
            'byteLength': 135,
            'key': wide_key,
        },
    }


def blowfish_vectors(reference):
    """ECB/CBC vectors, when the reference's Blowfish backend is importable."""
    if not getattr(reference, 'import_ok', False):
        return {'available': False, 'ecb': [], 'cbc': []}

    ecb = []
    for key, plain in [
        ('blowfish', 'qwerty'),
        ('blowfish', 'qwertyui'),
        ('blowfish', 'qwertyuiop'),
        ('blowfish', 'qwertyuiopasdfghjklzxcvbnm1234567890'),
        ('passphrase', 'example message'),
        ('k' * 56, 'boundary key'),
        ('k' * 60, 'long key'),
        ('k' * 72, 'maximum key'),
    ]:
        entry = {'key': key, 'plain': plain}
        try:
            entry['wire'] = reference.blowcrypt_pack(
                plain.encode('utf-8'), key, cbc=False)
        except Exception as exc:  # noqa: BLE001 - recorded as a fixture fact
            entry['error'] = type(exc).__name__ + ': ' + str(exc)
        ecb.append(entry)

    cbc = []
    for key, plain in [
        ('blowfish', 'qwertyui'),
        ('passphrase', 'example message'),
        ('k' * 60, 'long key'),
    ]:
        entry = {'key': key, 'plain': plain}
        try:
            wire = reference.blowcrypt_pack(
                plain.encode('utf-8'), key, cbc=True)
            decrypted, is_cbc = reference.blowcrypt_unpack(wire, key)
            if not is_cbc or decrypted != plain.encode('utf-8'):
                raise RuntimeError('reference CBC round trip failed')
            entry['wire'] = wire
        except Exception as exc:  # noqa: BLE001 - recorded as a fixture fact
            entry['error'] = type(exc).__name__ + ': ' + str(exc)
        cbc.append(entry)

    return {
        'available': True,
        'note': 'CBC payloads embed a random first block, so their wire values '
                'change on every run; only decryption is asserted for them.',
        'ecb': ecb,
        'cbc': cbc,
    }


DEFAULT_REFERENCE = 'scripts/fish.py'
DEFAULT_OUTPUT = 'tests/fixtures/fish/vectors.json'


def summarise(document, destination):
    """One-line human summary; always stderr so `--output -` stays clean."""
    dh = document['dh']
    blowfish = document['blowfish']
    errors = [entry for entry in blowfish['ecb'] + blowfish['cbc'] if 'error' in entry]

    parts = [
        'wrote ' + destination,
        '{} DH exchanges'.format(len(dh['exchanges'])),
        '{} ECB'.format(len(blowfish['ecb'])),
        '{} CBC'.format(len(blowfish['cbc'])),
    ]
    if errors:
        parts.append('{} reference refusal(s) recorded'.format(len(errors)))
    if not blowfish['available']:
        parts.append('BLOWFISH BACKEND UNAVAILABLE')

    print(' - '.join(parts), file=sys.stderr)


def write_output(document, destination, allow_partial):
    payload = json.dumps(document, indent=2, sort_keys=True) + '\n'

    if destination == '-':
        sys.stdout.write(payload)
        summarise(document, 'stdout')
        return

    # A run without the reference's Blowfish backend would replace real
    # vectors with empty lists, which is never what the caller wants.
    if not document['blowfish']['available'] and not allow_partial:
        if os.path.exists(destination):
            with open(destination, 'r', encoding='utf-8') as existing:
                if '"wire"' in existing.read():
                    sys.exit(
                        'refusing to overwrite {}: the Blowfish backend is '
                        'unavailable, so the ECB/CBC vectors would be lost. '
                        'Install pycryptodome, or pass --allow-partial.'
                        .format(destination)
                    )

    parent = os.path.dirname(destination)
    if parent:
        os.makedirs(parent, exist_ok=True)

    with open(destination, 'w', encoding='utf-8') as handle:
        handle.write(payload)

    summarise(document, destination)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--reference', default=DEFAULT_REFERENCE,
                        help='reference implementation '
                             '(default: {})'.format(DEFAULT_REFERENCE))
    parser.add_argument('--output', default=DEFAULT_OUTPUT,
                        help="destination file, or '-' for stdout "
                             '(default: {})'.format(DEFAULT_OUTPUT))
    parser.add_argument('--seed', default=DEFAULT_SEED,
                        help='seed for the deterministic urandom stream')
    parser.add_argument('--allow-partial', action='store_true',
                        help='write even when the Blowfish backend is missing')
    args = parser.parse_args()

    if not os.path.isfile(args.reference):
        parser.error(
            'reference not found at {} - place WeeChat\'s fish.py there (it is '
            'gitignored) or pass --reference PATH'.format(args.reference)
        )

    reference = load_reference(args.reference)

    document = {
        'note': 'Generated by scripts/fish-vectors.py; do not edit by hand.',
        'reference': 'weechat-fish (GPL-3.0-or-later, referenced only, '
                     'never vendored)',
        'seed': args.seed,
        'dh': dh_vectors(reference, args.seed),
        'blowfish': blowfish_vectors(reference),
    }

    write_output(document, args.output, args.allow_partial)


if __name__ == '__main__':
    main()
