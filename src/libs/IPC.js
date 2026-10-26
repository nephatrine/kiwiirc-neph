'kiwi public';

import EventEmitter from 'eventemitter3';

class IpcBroadcastChannel extends EventEmitter {
    init() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        try {
            // Privacy settings in firefox 104~ block broadcast channels in iframes
            this.bc = new BroadcastChannel('kiwi-ipc');
            this.bc.onmessage = this.onmessage.bind(this);
        } catch {
            this.fallback = new IpcLocalStorage();
            this.fallback.on('message', (msg) => this.emit('message', msg));
            try {
                this.fallback.init();
            } catch {
                // Cross-tab sync is best-effort.
            }
        }
    }

    send(msg) {
        if (this.bc) {
            this.bc.postMessage(msg);
        } else if (this.fallback) {
            this.fallback.send(msg);
        }
    }

    onmessage(msg) {
        this.emit('message', msg);
    }
}

class IpcLocalStorage extends EventEmitter {
    init() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        window.addEventListener('storage', this.onmessage.bind(this));
    }

    send(msg) {
        localStorage.setItem('kiwi-ipc', JSON.stringify(msg));
        localStorage.removeItem('kiwi-ipc');
    }

    onmessage(msg) {
        if (msg.key === 'kiwi-ipc' && msg.newValue) {
            try {
                let parsedMsg = {
                    data: JSON.parse(msg.newValue),
                };
                this.emit('message', parsedMsg);
            } catch (e) {
                this.emit('error');
            }
        }
    }
}

const hasBroadcastChannel = typeof window !== 'undefined' && !!window.BroadcastChannel;

export default hasBroadcastChannel ?
    new IpcBroadcastChannel() :
    new IpcLocalStorage();
