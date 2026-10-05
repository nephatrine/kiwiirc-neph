'kiwi public';

import SaslScram from './SaslScram';

export default function saslMiddleware(network) {
    return function middleware(client, rawEvents, parsedEvents) {
        rawEvents.use(theMiddleware.bind(null, network));

        client.on('sasl success', (event) => {
            if (client.sasl_scram && client.sasl_scram.state === 'FINAL_SENT') {
                // event.params[0] is the nick, event.params[1] might be the payload
                const payload = event.params[1];
                if (payload && payload !== 'SASL authentication successful') {
                    try {
                        // 903 payload is also base64 encoded if it's a SCRAM response
                        const decoded = atob(payload);
                        client.sasl_scram.handleServerFinal(decoded);
                    } catch (err) {
                        // RFC 5802: If the server-final-message is omitted or invalid,
                        // the client MUST NOT consider the authentication exchange as complete.
                        // In IRC context, we should probably disconnect.
                        client.quit('SASL SCRAM verification failed');
                    }
                }
                client.sasl_scram = null;
            }
        });
    };
}

function theMiddleware(network, command, message, rawLine, client, next) {
    if (command !== 'AUTHENTICATE') {
        next();
        return;
    }

    const mechanism = client.options.sasl_mechanism || 'PLAIN';
    if (mechanism.toUpperCase() !== 'SCRAM-SHA-256') {
        next();
        return;
    }

    const payload = message.params[0];

    // Accumulate chunked payload if necessary
    if (!client.sasl_buffer) {
        client.sasl_buffer = '';
    }

    if (payload.length === 400) {
        client.sasl_buffer += payload;
        return;
    }

    let base64Payload = payload === '+' ? client.sasl_buffer : client.sasl_buffer + payload;
    client.sasl_buffer = '';

    let fullPayload = '';
    if (base64Payload) {
        try {
            fullPayload = atob(base64Payload);
        } catch (e) {
            client.sasl_scram = null;
            next();
            return;
        }
    }

    if (!client.sasl_scram) {
        // Initial AUTHENTICATE + response or server-first-message
        if (fullPayload === '') {
            const account = client.options.account;
            if (account && account.account && account.password) {
                client.sasl_scram = new SaslScram(account.account, account.password);
                const firstMsg = client.sasl_scram.getClientFirstMessage();
                sendAuthenticate(client, firstMsg);
            } else {
                next();
            }
            return;
        }
    }

    if (client.sasl_scram) {
        // We handle SCRAM state machine asynchronously, but we DO NOT call next()
        // so that irc-framework doesn't see these AUTHENTICATE commands and
        // prematurely send CAP END.
        processScramStep(client, fullPayload);
        return;
    }

    next();
}

async function processScramStep(client, fullPayload) {
    try {
        let response = '';
        if (client.sasl_scram.state === 'FIRST_SENT') {
            response = await client.sasl_scram.handleServerFirst(fullPayload);
        } else if (client.sasl_scram.state === 'FINAL_SENT') {
            await client.sasl_scram.handleServerFinal(fullPayload);
            // SASL protocol requires a final empty response to a server-final challenge
            // if it was successful.
            response = '+';
        }

        if (response) {
            if (response === '+') {
                client.raw('AUTHENTICATE +');
            } else {
                sendAuthenticate(client, response);
            }
        }
    } catch (err) {
        client.sasl_scram = null;
        // RFC 5802 requirement: abort on verification failure
        client.quit('SASL SCRAM handshake failed');
        // Since we blocked next(), irc-framework is still waiting.
        // Sending a bogus AUTHENTICATE will trigger ERR_SASLFAIL on the server.
        client.raw('AUTHENTICATE *');
    }
}

function sendAuthenticate(client, data) {
    const base64 = btoa(data);
    const maxLength = 400;
    let offset = 0;
    while (offset < base64.length) {
        const chunk = base64.substr(offset, maxLength);
        client.raw(`AUTHENTICATE ${chunk}`);
        offset += maxLength;
    }
    if (offset === base64.length) {
        client.raw('AUTHENTICATE +');
    }
}
