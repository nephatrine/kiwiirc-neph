'kiwi public';

import Logger from '@/libs/Logger';
import bouncerMiddleware from '@/libs/BouncerMiddleware';
import { find } from '@/helpers/Utils';
import * as TextFormatting from '@/helpers/TextFormatting';

let log = Logger.namespace('BouncerProvider.js');

export default class BouncerProvider {
    constructor(state) {
        this.state = state;
        // Let components (network settings) reach the explicit save API.
        state.bouncer_provider = this;

        // This is the network that will be used to control the bouncer
        this.controllerNetwork = null;

        // The detected credentials for the BNC
        this.bnc = {
            enabled: false,
            username: '',
            password: '',
            server: '',
            port: 6667,
            tls: false,
            direct: false,
            path: '',
            registered: false,
        };

        // If enabled, new IRC connections will be re-routed through the bouncer
        this.rewriteConnections = true;

        // A snapshot of the current networks. Compared against to detect changed networks
        this.networksSnapshot = Object.create(null);

        // Failed bouncer saves, keyed by network id, holding the tag signature
        // that failed. Stops us resending the same request every save tick while
        // still retrying as soon as the user changes something.
        this.failedSaves = Object.create(null);

        // If we are currently monitoring for network settings changes
        this.monitoringChanges = false;

        state.$on('irc.motd', this.onNetworkMotd.bind(this));
        state.$on('irc.bouncer networks', this.onBouncerNetworks.bind(this));
        state.$on('irc.bouncer error', this.onBouncerError.bind(this));
    }

    enable(server, port, tls, direct, path) {
        log(`Using a Bouncer Provider with server ${server}:${port}`);

        this.bnc.server = server;
        this.bnc.port = port || 6667;
        this.bnc.tls = !!tls;
        this.bnc.direct = !!direct;
        this.bnc.path = path || '';
        this.bnc.enabled = true;

        // The bouncer account lives on the bouncer network: the account name in
        // its connection and the account password as the network SASL secret.
        const bncNetwork = this.state.networks.find((network) => network.is_bnc);
        if (bncNetwork) {
            this.bnc.username = bncNetwork.connection.account || '';
            this.bnc.password = bncNetwork.password || '';
        }

        // Enable BOUNCER on existing connections
        this.state.networks.forEach((network) => {
            network.ircClient.use(bouncerMiddleware(network));
        });

        // this.monitorNetworkChanges();
        this.listenToState();
    }

    // Try to get a connected network that can be used to control the bouncer
    getController() {
        if (this.controllerNetwork && this.controllerNetwork.state === 'connected') {
            return this.controllerNetwork;
        }

        this.controllerNetwork = null;
        for (let i = 0; i < this.state.networks.length; i++) {
            let network = this.state.networks[i];
            if (network.state === 'connected' && network.bouncerCap()) {
                this.controllerNetwork = network;
                break;
            }
        }

        return this.controllerNetwork;
    }

    async onNetworkMotd(event, network) {
        let client = network.ircClient;

        if (!this.bnc.enabled) {
            return;
        }

        if (!network.bouncerCap()) {
            log.debug(`bouncer-networks cap not available on network ${network.name}, not using for BNC`);
            return;
        }

        // Set the bncnetid if this connection got bound to a network upstream
        if (client.bnc.hasNetwork() && !network.connection.bncnetid) {
            network.connection.bncnetid = client.bnc.netId();
        }

        // A connection bound to a network is an ordinary IRC connection from
        // here on. The bouncer replays the network's state and buffers for us,
        // so there is nothing to sync and no buffer API to call.
        if (client.bnc.hasNetwork()) {
            return;
        }

        // The unbound connection is the one that manages the bouncer's networks
        await this.initAndAddNetworks(network);
    }

    onBouncerError(event) {
        log.error(`Bouncer error ${event.code} on ${event.subcommand}: ${event.reason}`);
        this.reportBouncerError(event.network, event.code, event.subcommand, event.reason);
    }

    initAndAddNetworks(network) {
        let client = network.ircClient;

        this.bnc.registered = true;

        if (!client.bnc.hasNetwork()) {
            // The unbound control connection is always visible so it can be
            // used to talk to the bouncer itself
            network.hidden = false;
            network.is_bnc = true;
            network.name = 'BNC';

            // Earlier versions created a second control connection when logging
            // out and back in, leaving the saved one behind. Keep the live one
            // and drop any that are left over.
            let staleControllers = this.state.networks.filter((existingNet) => (
                existingNet !== network &&
                existingNet.is_bnc &&
                !existingNet.connection.bncnetid
            ));

            staleControllers.forEach((staleNet) => {
                log.debug(`Removing stale bouncer control network '${staleNet.name}' (${staleNet.id})`);
                this.state.removeNetwork(staleNet.id);
            });
        } else {
            network.hidden = false;
            network.is_bnc = false;
        }

        // onBouncerNetworks will pick up the event handler for this
        client.bnc.getNetworks().catch((err) => {
            // The FAIL BOUNCER line already reports this to the user
            log.error(`Failed to list bouncer networks: ${(err && err.reason) || err}`);
        });
    }

    onBouncerNetworks(bncNetworks) {
        log.debug(`Got ${bncNetworks.length} networks from the BNC`, bncNetworks);
        bncNetworks.forEach((bncNet) => this.addNetworkToState(bncNet));

        // Remove any networks we have locally but no longer exist on the BNC
        this.state.networks.forEach((existingNet) => {
            let isNetworkInBncList = !!bncNetworks.find((n) => (
                n.netid === existingNet.connection.bncnetid
            ));

            if (!existingNet.is_bnc && !isNetworkInBncList) {
                log.debug(`Network '${existingNet.name}' (${existingNet.id}) was not in the BNC, removing locally`);
                this.state.removeNetwork(existingNet.id);
            }
        });

        // start monitoring network changes
        this.monitorNetworkChanges();

        if (this.state.getActiveBuffer()) {
            return;
        }
        if (!bncNetworks.length) {
            // The bouncer has no networks. Open the control connection's own
            // buffer so the user can talk to the bouncer itself.
            let controller = this.getController();
            if (controller) {
                controller.showServerBuffer('messages');
            }
        } else {
            for (let i = 0; i < this.state.networks.length; i++) {
                const net = this.state.networks[i];
                if (!net.is_bnc) {
                    // The first network that is not the BNC control network
                    net.showServerBuffer('settings');
                    break;
                }
            }
        }
    }

    addNetworkToState(bncNetwork) {
        let net = this.state.getNetworkFromBncNetId(bncNetwork.netid);
        if (!net) {
            net = this.state.addNetwork(bncNetwork.name, bncNetwork.nickname || '', {
                server: bncNetwork.host,
                port: bncNetwork.port,
                tls: bncNetwork.tls,
                password: '',
                bncnetid: bncNetwork.netid,
                account: bncNetwork.username || '',
            });
        } else {
            // Make sure our existing network is all up to date
            net.name = bncNetwork.name;
            net.connection.server = bncNetwork.host;
            net.connection.port = parseInt(bncNetwork.port, 10);
            net.connection.tls = bncNetwork.tls;
            net.connection.nick = bncNetwork.nickname || net.connection.nick;
            net.connection.password = '';
            net.connection.account = bncNetwork.username || '';
            net.nick = bncNetwork.nickname || net.nick || '';
        }

        net.connection.password = bncNetwork.pass || '';

        // The bouncer's own view of the upstream link. `network.state` only
        // tracks our socket to the bouncer, so the settings page reads this to
        // tell a broken upstream from a working one.
        net.bnc_state = bncNetwork.state || '';

        // A network the bouncer could not connect to carries the reason here.
        // Surface it once instead of leaving the network silently offline.
        if (bncNetwork.error && net.bnc_error !== bncNetwork.error) {
            net.bnc_error = bncNetwork.error;
            this.state.addMessage(net.serverBuffer(), {
                time: Date.now(),
                nick: '',
                message: `Bouncer: ${bncNetwork.error}`,
                type: 'error',
            });
        } else if (!bncNetwork.error) {
            net.bnc_error = '';
        }

        net.editable_name = true;
        return net;
    }

    // Keep a snapshot of what the current networks are. They will be periodically
    // compared with the active networks to see if anything has changed before
    // saving those changes.
    snapshotCurrentNetworks() {
        this.networksSnapshot = Object.create(null);

        this.state.networks.forEach((network) => {
            if (!network.connection.bncnetid) {
                return;
            }

            this.networksSnapshot[network.connection.bncnetid] = {
                bncnetid: network.connection.bncnetid,
                name: network.name,
                host: network.connection.server,
                port: network.connection.port,
                tls: network.connection.tls,
                nickname: network.connection.nick,
                username: network.connection.account,
                pass: network.connection.password,
            };
        });
    }

    // Compare the current networks with our previously saved snapshot of
    // networks. Save any changes to the bouncer
    saveState() {
        let controller = this.getController();
        if (!controller) {
            log.debug('No controller available to save networks');
            return;
        }

        this.state.networks.forEach((network) => {
            this.saveNetwork(network);
        });

        this.snapshotCurrentNetworks();
    }

    // Explicit save for the settings page: apply a single network, then refresh
    // the snapshot so a later save only sends further edits.
    saveNetworkChanges(network) {
        this.saveNetwork(network);
        this.snapshotCurrentNetworks();
    }

    // Diff one network against the last known bouncer snapshot and send it as
    // ADDNETWORK (new network) or CHANGENETWORK (existing network).
    saveNetwork(network) {
        let controller = this.getController();
        if (!controller) {
            log.debug('No controller available to save network');
            return;
        }

        // Never save the bouncer control connection as if it were a network
        if (network.is_bnc) {
            return;
        }

        let client = network.ircClient;
        let isBound = !!(client && client.bnc && client.bnc.hasNetwork());

        // don't save an empty controller to the network.
        // we can't use hasNetwork alone because that requires ircClient to be
        //  connected, and we save new nets before they are connected
        if (controller === network && !isBound) {
            return;
        }

        // Don't save any hidden networks
        if (network.hidden) {
            return;
        }

        // Every network needs a valid name
        if (!network.name.match(/^[a-zA-Z_0-9.]+$/)) {
            log.debug(`Network ${network.id} has an invalid name. Not saving to the BNC`);
            return;
        }

        let bncnetid = network.connection.bncnetid;
        let snapshot = this.networksSnapshot[bncnetid] || {};
        let tags = {};

        if (network.name !== snapshot.name) {
            tags.name = network.name;
        }
        if (network.connection.server !== snapshot.host) {
            tags.host = network.connection.server;
        }
        if (network.connection.port !== snapshot.port) {
            tags.port = network.connection.port;
        }
        if (network.connection.tls !== snapshot.tls) {
            tags.tls = network.connection.tls;
        }
        if (network.connection.nick !== snapshot.nickname) {
            tags.nickname = network.connection.nick;
        }
        if (network.connection.account !== snapshot.username) {
            tags.username = network.connection.account;
        }
        // `pass` is the upstream server password. The SASL secret never
        // goes through ADDNETWORK/CHANGENETWORK; Soju receives it through
        // BouncerServ and other bouncers have to be configured by hand.
        if (network.connection.password !== snapshot.pass) {
            tags.pass = network.connection.password;
        }

        // A newly added network would not have a snapshot bncnetid set yet.
        // Only save the network if we've entered its connection info.
        if (!snapshot.bncnetid && tags.host && tags.port && tags.nickname) {
            let signature = JSON.stringify(tags);
            if (this.failedSaves[network.id] === signature) {
                // Already reported this exact request as failed. The user
                // changing anything above gives us a new signature to try.
                return;
            }

            log(`Saving new network ${network.name} to the BNC`);
            controller.ircClient.bnc.addNetwork(tags).then((networkInfo) => {
                delete this.failedSaves[network.id];
                network.connection.bncnetid = networkInfo.netid;
            }).catch((err) => {
                this.failedSaves[network.id] = signature;
                this.reportSaveError(network, err);
            });
        } else if (snapshot.bncnetid && Object.keys(tags).length > 0) {
            log(`Updating network ${network.name} on the BNC`);
            controller.ircClient.bnc.saveNetwork(bncnetid, tags).catch((err) => {
                this.reportSaveError(network, err);
            });
        }
    }

    reportSaveError(network, err) {
        let reason = (err && (err.reason || err.message)) || 'Unknown error';
        let code = (err && err.error) || '';

        log.error(`Failed to save network '${network.name}' to the bouncer (${code}): ${reason}`);

        this.state.addMessage(network.serverBuffer(), {
            time: Date.now(),
            nick: '*',
            message: TextFormatting.t('settings_bnc_save_error', { reason: reason }),
            type: 'error',
        });
    }

    // Show a bouncer-level error in the control connection buffer, or in the
    // buffer of the network the bouncer was talking about
    reportBouncerError(network, code, subcommand, reason) {
        let target = network || this.getController();
        if (!target) {
            return;
        }

        this.state.addMessage(target.serverBuffer(), {
            time: Date.now(),
            nick: '*',
            message: TextFormatting.t('bouncer_error', {
                code: code || '',
                subcommand: subcommand || '',
                reason: reason || '',
            }),
            type: 'error',
        });
    }

    monitorNetworkChanges() {
        if (this.monitoringChanges) {
            return;
        }
        this.monitoringChanges = true;

        // Network changes are not saved automatically: the settings page has an
        // explicit save/connect action, so partial edits are never sent.
        this.snapshotCurrentNetworks();
    }

    listenToState() {
        let state = this.state;

        // Just before we connect to a network, make sure the BNC is saved and connected to
        // it or at least trying to connect.
        // Ie. Quickly creating a network and hitting connect before it's had time to
        //     save itself to the bouncer
        state.$on('network.connecting', (event) => {
            // Every connection we make is a connection to the bouncer. The
            // bouncer account is what authenticates it, and a BIND selects
            // which bouncer network the connection is for.
            let network = event.network;
            if (this.bnc.enabled && this.rewriteConnections) {
                let ircClient = network.ircClient;
                ircClient.options.host = this.bnc.server;
                ircClient.options.port = this.bnc.port;
                ircClient.options.tls = this.bnc.tls;
                ircClient.options.password = '';
                ircClient.options.account = {
                    account: this.bnc.username,
                    password: this.bnc.password,
                };

                network.connection.direct = this.bnc.direct;
                ircClient.options.path = this.bnc.path;
            }
        });
        state.$on('network.connecting', () => {
            let controller = this.getController();
            if (!controller) {
                log.debug('No controller available to save network states');
                return;
            }

            this.saveState();
        });
        state.$on('irc.motd', (event, network) => {
            network.buffers.forEach((buffer) => {
                if (buffer.isChannel() && buffer.enabled && buffer.joined) {
                    network.ircClient.who(buffer.name);
                }
            });
        });

        state.$on('network.new', (event) => {
            let network = event.network;

            // Enable BOUNCER on this connection
            network.ircClient.use(bouncerMiddleware(network));

            network.editable_name = true;

            // If network is attached to a bouncer do nothing
            // (use the name provided by the bouncer)
            if (network.connection.bncnetid) {
                return;
            }

            let existingNet = true;

            // append a number to the network name. E.g. "Network, Network2,..."
            // while there is a network with that name
            let currentNum = 1;
            let tryNetworkName;
            while (existingNet) {
                if (network.name && currentNum === 1) {
                    // don't append the number 1 if there is a custom name
                    tryNetworkName = network.name;
                } else {
                    tryNetworkName = (network.name || 'Network') + currentNum;
                }

                existingNet = find(state.networks, {
                    name: tryNetworkName,
                });

                if (!existingNet || existingNet === network) {
                    network.name = tryNetworkName;
                    break;
                }

                currentNum++;
            }
        });

        state.$on('network.removed', (event) => {
            let controller = this.getController();
            if (!controller) {
                log.debug('No controller available to save network states');
                return;
            }

            if (event.network.connection.bncnetid) {
                controller.ircClient.bnc.removeNetwork(event.network.connection.bncnetid)
                    .catch((err) => {
                        log.error(`Failed to remove network '${event.network.name}' from the bouncer: ${(err && err.reason) || err}`);
                    });
            }
        });
    }
}
