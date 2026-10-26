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
            return {
                title: message.nick || 'Kiwi IRC',
                body: text,
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

    return {
        parseIrcMessage: parseIrcMessage,
        buildNotification: buildNotification,
        stateKeyFromScope: stateKeyFromScope,
        networkIdFromScope: networkIdFromScope,
        appRootFromScope: appRootFromScope,
        notificationTag: notificationTag,
    };
}));
