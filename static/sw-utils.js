/* Kiwi IRC web push service worker helpers.
   Kept dependency-free and UMD-wrapped so the worker can load it with
   importScripts() and Jest can require it directly. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.KiwiSwUtils = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // Prefixes used by FiSH and Mircryption encrypted payloads.
    var ENCRYPTED_PREFIXES = ['+OK ', 'mcps '];
    var ENCRYPTED_BODY = '[Encrypted Message]';

    function isEncryptedPayload(text) {
        var value = String(text || '');
        for (var i = 0; i < ENCRYPTED_PREFIXES.length; i++) {
            if (value.indexOf(ENCRYPTED_PREFIXES[i]) === 0) {
                return true;
            }
        }
        return false;
    }

    // "+OK +p text" / "+OK *+p text" carry plaintext inside FiSH framing.
    function plaintextEscapeBody(text) {
        var value = String(text || '');
        var prefixes = ['+OK *', '+OK ', 'mcps *', 'mcps '];
        for (var i = 0; i < prefixes.length; i++) {
            if (value.indexOf(prefixes[i]) === 0) {
                var rest = value.slice(prefixes[i].length);
                if (rest.indexOf('+p ') === 0 && rest.length > 3) {
                    return rest.slice(3);
                }
                return '';
            }
        }
        return '';
    }

    function notificationBody(text, isCtcp) {
        var candidate = String(text || '');
        if (isCtcp) {
            var inner = candidate.slice(1, -1);
            if (inner.slice(0, 7).toUpperCase() === 'ACTION ') {
                candidate = inner.slice(7);
            } else if (inner.toUpperCase() === 'ACTION') {
                candidate = '';
            } else {
                return ENCRYPTED_BODY;
            }
        }

        // An explicit plaintext escape is safe to show; anything else encrypted
        // must never surface ciphertext or a decrypted body, because the worker
        // only ever sees the wire text.
        var escaped = plaintextEscapeBody(candidate);
        if (escaped) {
            return escaped;
        }

        return isEncryptedPayload(candidate) ? ENCRYPTED_BODY : text;
    }

    function unescapeTagValue(value) {
        return String(value)
            .replace(/\\:/g, ';')
            .replace(/\\s/g, ' ')
            .replace(/\\\\/g, '\\')
            .replace(/\\r/g, '\r')
            .replace(/\\n/g, '\n');
    }

    function parseTags(raw) {
        const tags = {};
        if (!raw) {
            return tags;
        }

        String(raw).split(';').forEach((part) => {
            if (!part) {
                return;
            }
            const eq = part.indexOf('=');
            if (eq === -1) {
                tags[part] = '';
            } else {
                tags[part.slice(0, eq)] = unescapeTagValue(part.slice(eq + 1));
            }
        });

        return tags;
    }

    function parseIrcMessage(line) {
        let rest = String(line || '').replace(/[\r\n]+$/, '');
        if (!rest) {
            return null;
        }

        let tags = {};
        if (rest.charAt(0) === '@') {
            const spaceIdx = rest.indexOf(' ');
            if (spaceIdx === -1) {
                return null;
            }
            tags = parseTags(rest.slice(1, spaceIdx));
            rest = rest.slice(spaceIdx + 1);
        }

        let prefix = '';
        if (rest.charAt(0) === ':') {
            const spaceIdx = rest.indexOf(' ');
            if (spaceIdx === -1) {
                return null;
            }
            prefix = rest.slice(1, spaceIdx);
            rest = rest.slice(spaceIdx + 1);
        }

        let command = '';
        const commandSpace = rest.indexOf(' ');
        if (commandSpace === -1) {
            command = rest;
            rest = '';
        } else {
            command = rest.slice(0, commandSpace);
            rest = rest.slice(commandSpace + 1);
        }
        command = command.toUpperCase();
        if (!command) {
            return null;
        }

        const params = [];
        while (rest) {
            if (rest.charAt(0) === ':') {
                params.push(rest.slice(1));
                break;
            }
            const spaceIdx = rest.indexOf(' ');
            if (spaceIdx === -1) {
                params.push(rest);
                break;
            }
            params.push(rest.slice(0, spaceIdx));
            rest = rest.slice(spaceIdx + 1);
        }

        return {
            tags: tags,
            prefix: prefix,
            nick: prefix.split('!')[0],
            command: command,
            params: params,
        };
    }

    function buildNotification(line) {
        const message = parseIrcMessage(line);
        if (!message) {
            return null;
        }

        if (message.command === 'PRIVMSG' || message.command === 'NOTICE') {
            const target = message.params[0] || '';
            const text = message.params.length > 1 ?
                message.params[message.params.length - 1] :
                '';
            if (!text || target === '*' || target.charAt(0) === '$') {
                return null;
            }

            // CTCP responses are machine traffic. Actions remain eligible for
            // notifications because they are user-visible messages.
            const isCtcp = text.length > 1 &&
                text.charAt(0) === '\x01' &&
                text.charAt(text.length - 1) === '\x01';
            const ctcpType = isCtcp ?
                text.slice(1, -1).split(' ')[0].toUpperCase() :
                '';
            if (ctcpType && ctcpType !== 'ACTION') {
                return null;
            }

            return {
                title: message.nick || 'Kiwi IRC',
                body: notificationBody(text, isCtcp),
                data: {
                    nick: message.nick || '',
                    target: target,
                    msgid: message.tags.msgid || '',
                    command: message.command,
                },
            };
        }

        if (message.command === 'INVITE') {
            const channel = message.params[1] || '';
            if (!channel) {
                return null;
            }
            return {
                title: message.nick || 'Kiwi IRC',
                body: 'Invited you to ' + channel,
                data: {
                    nick: message.nick || '',
                    target: channel,
                    msgid: message.tags.msgid || '',
                    command: message.command,
                },
            };
        }

        return null;
    }

    function scopeParts(scope) {
        if (!scope) {
            return null;
        }

        let url = null;
        try {
            url = new URL(scope);
        } catch {
            return null;
        }

        const parts = url.pathname.split('/').filter(Boolean);
        let idx = -1;
        for (let i = 0; i < parts.length - 2; i++) {
            if (parts[i] === 'static' && parts[i + 1] === 'webpush') {
                idx = i + 1;
            }
        }
        if (idx === -1 || parts.length < idx + 3) {
            return null;
        }

        try {
            return {
                stateKey: decodeURIComponent(parts[idx + 1]),
                networkId: decodeURIComponent(parts[idx + 2]),
            };
        } catch (err) {
            return null;
        }
    }

    function stateKeyFromScope(scope) {
        const parsed = scopeParts(scope);
        return parsed ? parsed.stateKey : '';
    }

    function networkIdFromScope(scope) {
        const parsed = scopeParts(scope);
        return parsed ? parsed.networkId : '';
    }

    function appRootFromScope(scope) {
        return new URL('../../../../', scope).href;
    }

    function notificationTag(stateKey, networkId, msgid) {
        if (!msgid) {
            return '';
        }
        return 'kiwi-webpush:' + String(stateKey) + ':' +
            String(networkId) + ':' + String(msgid);
    }

    function shouldSuppressPush(clients) {
        return (clients || []).some((client) => client && client.focused);
    }

    function anyNotificationsDisabled(states) {
        return (states || []).some((enabled) => enabled === false);
    }

    return {
        parseIrcMessage: parseIrcMessage,
        buildNotification: buildNotification,
        isEncryptedPayload: isEncryptedPayload,
        stateKeyFromScope: stateKeyFromScope,
        networkIdFromScope: networkIdFromScope,
        appRootFromScope: appRootFromScope,
        notificationTag: notificationTag,

        shouldSuppressPush: shouldSuppressPush,
        anyNotificationsDisabled: anyNotificationsDisabled,
    };
}));
