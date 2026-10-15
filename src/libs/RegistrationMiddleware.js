import * as TextFormatting from '@/helpers/TextFormatting';

// Handles draft/account-registration for users that connected without a
// SASL account, plus the login-page before-connect flow: REGISTER while
// still negotiating (CAP END held open), with an optional VERIFY step.
//
// Unknown verbs (REGISTER, VERIFY, FAIL) reach the parsed middleware chain
// as 'unknown command', so this hooks the shared 'irc.unknown command'
// event and marks consumed replies as handled before the generic unknown
// command printer dumps them raw into the server tab.
//
// The pre-connect gate needs raw CAP timing: our rawEvents hook runs
// before irc-framework's own ACK processing, so planting a token in
// cap.requested holds CAP END open the same way the extended-isupport
// gate does. The token never goes on the wire: the framework only
// removes entries the server ACKs or NAKs, and no server will ever
// mention this name.
//
// The password is kept in closure scope only. It must never be stored on
// the network object: enumerable network fields can end up in persisted
// state.
const REGISTER_GATE_CAP = 'kiwi-register-wait';

// FAIL codes that only mean the current code was wrong. Anything else
// fails the whole attempt: the user edits the login form and retries
// over a fresh connection.
const RETRYABLE_VERIFY_CODES = ['INVALID_CODE', 'TEMPORARILY_UNAVAILABLE'];

export default function registrationMiddleware(network) {
    let pendingPassword = '';
    let preConnect = null;
    let registerGate = null;

    const resetRegistration = () => {
        pendingPassword = '';
        preConnect = null;
        if (registerGate) {
            clearTimeout(registerGate.timer);
            registerGate = null;
        }
        network.registration.pending = false;
        network.registration.awaitingVerify = false;
        network.registration.account = '';
        network.registration.error = '';
    };

    const scrubRegisterGate = (client) => {
        if (registerGate) {
            clearTimeout(registerGate.timer);
            registerGate = null;
        }
        const cap = client && client.network && client.network.cap;
        if (cap && cap.requested) {
            const idx = cap.requested.indexOf(REGISTER_GATE_CAP);
            if (idx !== -1) {
                cap.requested.splice(idx, 1);
            }
        }
    };

    // Release the hold after a conclusive reply. Ends negotiation
    // ourselves only if the framework has not already done so.
    const releaseRegisterGate = (client) => {
        if (!registerGate) {
            return;
        }
        clearTimeout(registerGate.timer);
        registerGate = null;
        scrubRegisterGate(client);
        const cap = client && client.network && client.network.cap;
        if (cap && cap.negotiating) {
            client.raw('CAP', 'END');
            cap.negotiating = false;
        }
    };

    // Give up on a pre-connect attempt: drop the hold without ending
    // negotiation ourselves, then tear the connection down so the login
    // page shows the message. Welcome reads network.last_error when the
    // socket closes.
    const abortPreConnect = (client, message) => {
        scrubRegisterGate(client);
        preConnect = null;
        pendingPassword = '';
        network.registration.pending = false;
        network.registration.awaitingVerify = false;
        network.registration.error = '';
        network.last_error = message || '';
        network.state = 'disconnected';
        if (client && client.options) {
            client.options.auto_reconnect = false;
        }
        if (client && client.connection) {
            client.connection.end();
        }
    };

    const serverMessage = (event) => {
        const params = (event && event.params) || [];
        return params[params.length - 1] || '';
    };

    const addServerNotice = (message, type) => {
        network.appState.addMessage(network.serverBuffer(), {
            time: Date.now(),
            nick: '*',
            message: message,
            type: type || 'message',
        });
    };

    const completeRegistration = (client, verb, account, message) => {
        network.sasl_account = account;
        if (pendingPassword) {
            // Always keep the session credentials: reconnects (including
            // mid-session auto-reconnects) authenticate with these. Disk
            // persistence is still gated by the watcher itself, so an
            // unchecked Remember Me keeps this login session-only. This
            // must not wait on persistence.isPersisting: pre-connect
            // registration completes before the startup screen closes
            // and starts the watcher.
            network.connection.account = account;
            network.password = pendingPassword;
        }
        const pendingAccount = network.registration.account;
        const wasPreConnect = !!preConnect;
        releaseRegisterGate(client);
        resetRegistration();
        const fallbackKey = verb === 'VERIFY' ?
            'account_verified' :
            'account_registered';
        // Pre-connect the welcome is still ahead of us, so only the
        // login-page error path needs the message.
        if (!wasPreConnect) {
            addServerNotice(message || TextFormatting.t(fallbackKey, {
                account: account || pendingAccount,
            }));
        }
    };

    const handleReply = (client, verb, status, event) => {
        const params = event.params || [];
        const account = params[1] || network.registration.account;
        const message = serverMessage(event);
        if (status === 'SUCCESS') {
            completeRegistration(client, verb, account, message);
        } else if (status === 'VERIFICATION_REQUIRED') {
            network.registration.account = account;
            network.registration.awaitingVerify = true;
            network.registration.error = '';
            if (message) {
                addServerNotice(message);
            }
            // The code may take a while to arrive; restart the backstop.
            if (registerGate) {
                clearTimeout(registerGate.timer);
                registerGate.timer = setTimeout(() => {
                    abortPreConnect(
                        registerGate.client,
                        TextFormatting.t('registration_timeout')
                    );
                }, 5000);
            }
        }
    };

    const handleFail = (client, verb, code, event) => {
        const message = serverMessage(event) || `${code}`;
        if (code === 'ALREADY_AUTHENTICATED') {
            // The account exists and we are logged in; nothing left to do.
            preConnect = null;
            pendingPassword = '';
            network.registration.pending = false;
            network.registration.awaitingVerify = false;
            network.registration.error = '';
            releaseRegisterGate(client);
            if (message) {
                addServerNotice(message);
            }
            return;
        }
        if (preConnect) {
            if (verb === 'VERIFY' && RETRYABLE_VERIFY_CODES.includes(code)) {
                // Wrong/expired code: keep the hold, let the user retry.
                network.registration.error = message;
                return;
            }
            abortPreConnect(client, message);
            return;
        }
        // Keep the registration pending so the form can show the error and
        // let the user retry with corrected values.
        network.registration.error = message;
    };

    return function middlewareFn(client, rawEvents) {
        const state = network.appState;

        // Pre-connect gate: runs before irc-framework's own ACK
        // processing, so the planted token holds CAP END open.
        rawEvents.use((command, event, rawLine, clientArg, next) => {
            if (
                command === 'CAP' &&
                event &&
                event.params &&
                preConnect &&
                !registerGate &&
                network.state === 'connecting'
            ) {
                const subcommand = (event.params[1] || '').toUpperCase();
                const cap = clientArg && clientArg.network && clientArg.network.cap;
                if (subcommand === 'ACK' && cap && cap.negotiating) {
                    const listed = event.params.slice(2).join(' ').split(' ').map((entry) => (
                        entry.split('=')[0].toLowerCase()
                    ));
                    if (listed.includes('draft/account-registration')) {
                        cap.requested.push(REGISTER_GATE_CAP);
                        registerGate = { client: clientArg, timer: 0 };
                        // Absolute backstop: never hold negotiation past this.
                        registerGate.timer = setTimeout(() => {
                            abortPreConnect(
                                clientArg,
                                TextFormatting.t('registration_timeout')
                            );
                        }, 5000);
                        network.registration.pending = true;
                        network.registration.awaitingVerify = false;
                        network.registration.account = displayAccountName(preConnect.account);
                        network.registration.error = '';
                        clientArg.raw(
                            'REGISTER',
                            preConnect.account,
                            preConnect.email,
                            pendingPassword
                        );
                    }
                }
            }
            next();
        });

        // The wire account stays verbatim: '*' is spec-legal and lets the
        // server resolve it against the NICK it actually received, which
        // is the only race-free option before 001. Only the display copy
        // is resolved, preferring connection.nick (freshly set by the
        // login page) over network.nick (stale until 001/REGISTERED).
        const displayAccountName = (account) => (account === '*' ?
            (network.connection.nick || network.nick) :
            account);

        state.$on('irc.unknown command', (event, eventNetwork, ircEventObj) => {
            if (!event || !eventNetwork || eventNetwork.id !== network.id) {
                return;
            }
            const verb = (event.command || '').toUpperCase();
            if (verb === 'REGISTER' || verb === 'VERIFY') {
                if (!network.registration.pending) {
                    return;
                }
                const status = (event.params[0] || '').toUpperCase();
                handleReply(client, verb, status, event);
                ircEventObj.handled = true;
            } else if (verb === 'FAIL') {
                const failedCmd = (event.params[0] || '').toUpperCase();
                if (
                    (failedCmd !== 'REGISTER' && failedCmd !== 'VERIFY') ||
                    !network.registration.pending
                ) {
                    return;
                }
                handleFail(client, failedCmd, (event.params[1] || '').toUpperCase(), event);
                ircEventObj.handled = true;
            }
        });

        // Arm a before-connect registration. Called by the login page
        // before connect(): nothing goes on the wire until the capability
        // is ACKed. The password stays in closure scope; only the public
        // account/email fields touch the reactive registration object.
        network.armPreConnectRegistration = (account, email, password) => {
            if (!account) {
                return;
            }
            pendingPassword = password || '';
            preConnect = {
                account: account,
                email: email || '*',
            };
            network.registration.pending = false;
            network.registration.awaitingVerify = false;
            network.registration.account = displayAccountName(account);
            network.registration.error = '';
        };

        // Back out of an armed or code-waiting attempt. Silent: the user
        // chose to cancel, so there is nothing to report.
        network.cancelPreConnectRegistration = () => {
            if (!preConnect && !registerGate) {
                return;
            }
            abortPreConnect(client, '');
        };

        // Helper to start an account registration. The password is last so
        // irc-framework colon-prefixes it, keeping passwords with spaces
        // intact.
        network.registerAccount = (account, email, password) => {
            if (network.state !== 'connected' || !network.hasCap('draft/account-registration')) {
                return;
            }
            pendingPassword = password || '';
            network.registration.pending = true;
            network.registration.awaitingVerify = false;
            network.registration.account = account === '*' ?
                network.nick :
                account;
            network.registration.error = '';
            client.raw('REGISTER', account, email, pendingPassword);
        };

        // Helper to complete a registration that required verification.
        network.verifyAccount = (code) => {
            const preConnectWait = preConnect && network.state === 'connecting';
            if (
                !network.registration.pending ||
                !network.registration.awaitingVerify ||
                (!preConnectWait && network.state !== 'connected')
            ) {
                return;
            }
            network.registration.error = '';
            // Pre-connect the armed account goes out verbatim so '*' stays
            // '*', exactly as REGISTER sends it. Post-connect the resolved
            // display name is the account.
            const account = preConnectWait ?
                preConnect.account :
                (network.registration.account || network.nick);
            client.raw('VERIFY', account, code);
        };

        client.on('socket close', () => {
            resetRegistration();
        });
    };
}
