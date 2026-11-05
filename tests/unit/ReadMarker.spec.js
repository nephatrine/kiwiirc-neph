import state from '@/libs/state';

function makeNetwork(caps = ['draft/read-marker']) {
    const appState = state.create();
    const network = appState.addNetwork('TestNetwork', 'TestNick', {});
    network.state = 'connected';
    network.enabled_caps = caps;
    const buffer = appState.addBuffer(network.id, '#test');

    jest.spyOn(network.ircClient.readMarker, 'set').mockReturnValue('');
    jest.spyOn(network.ircClient.readMarker, 'get').mockReturnValue('');

    return { appState, network, buffer };
}

function addMessage(appState, buffer, serverTime, msgid, includeTime = true) {
    const tags = {};
    if (includeTime) {
        tags.time = new Date(serverTime).toISOString();
    }
    if (msgid) {
        tags.msgid = msgid;
    }
    return appState.addMessage(buffer, {
        time: serverTime,
        server_time: serverTime,
        nick: 'Other',
        message: 'hello',
        type: 'privmsg',
        tags,
    });
}

describe('read markers', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('sends the exact message timestamp and displays the same marker', () => {
        const { appState, network, buffer } = makeNetwork();
        addMessage(appState, buffer, 1000, 'm1');

        buffer.markAsRead(false);

        expect(network.ircClient.readMarker.set).toHaveBeenCalledWith(
            '#test',
            new Date(1000)
        );
        expect(buffer.last_read).toBe(1000);
        expect(buffer.flags.last_read_authoritative).toBe(0);
    });

    test('uses a timestamp reference when the server sends no msgid', () => {
        const { appState, network, buffer } = makeNetwork();
        addMessage(appState, buffer, 1000, null);

        buffer.markAsRead(false);

        expect(network.ircClient.readMarker.set).toHaveBeenCalledWith(
            '#test',
            new Date(1000)
        );
        expect(buffer.last_read).toBe(1000);
    });

    test('does not send a marker without a server time tag', () => {
        const { appState, network, buffer } = makeNetwork();
        addMessage(appState, buffer, 1000, 'm1', false);

        buffer.markAsRead(false);

        expect(network.ircClient.readMarker.set).not.toHaveBeenCalled();
    });

    test('keeps local-only read state without read-marker support', () => {
        const { buffer } = makeNetwork([]);
        jest.spyOn(Date, 'now').mockReturnValue(12345);

        buffer.markAsRead(false);

        expect(buffer.last_read).toBe(12345);
    });

    test('coalesces visible messages into one marker request', async() => {
        jest.useFakeTimers();
        const { appState, network, buffer } = makeNetwork();
        buffer.flags.is_visible = true;

        addMessage(appState, buffer, 1000, 'm1');
        addMessage(appState, buffer, 2000, 'm2');
        addMessage(appState, buffer, 3000, 'm3');

        expect(buffer.last_read).toBe(3000);
        expect(network.ircClient.readMarker.set).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1000);

        expect(network.ircClient.readMarker.set).toHaveBeenCalledTimes(1);
        expect(network.ircClient.readMarker.set).toHaveBeenCalledWith(
            '#test',
            new Date(3000)
        );
    });

    test('uses the sent message local time when the labeled response arrives', () => {
        const { appState, network, buffer } = makeNetwork();
        addMessage(appState, buffer, 1000, 'm1');
        network.ircClient.readMarker.set.mockReturnValue('label-1');

        buffer.markAsRead(false);
        expect(buffer.read_marker_pending).toMatchObject({
            label: 'label-1',
            serverTime: 1000,
            localTime: 1000,
        });

        // Simulate the server-time offset shifting between send and reply.
        network.timeToLocal = jest.fn(() => 950);
        network.ircClient.emit('read-marker', {
            target: '#test',
            timestamp: 'timestamp=1970-01-01T00:00:01.000Z',
            tags: { label: 'label-1' },
        });

        expect(buffer.last_read).toBe(1000);
        expect(buffer.flags.last_read_authoritative).toBe(1000);
        expect(buffer.read_marker_pending).toBeNull();
    });

    test('ignores an older external marker while a marker is pending', () => {
        const { appState, network, buffer } = makeNetwork();
        addMessage(appState, buffer, 1000, 'm1');
        network.ircClient.readMarker.set.mockReturnValue('label-1');
        buffer.markAsRead(false);

        network.ircClient.emit('read-marker', {
            target: '#test',
            timestamp: 'timestamp=1970-01-01T00:00:00.999Z',
            tags: {},
        });

        expect(buffer.last_read).toBe(1000);
        expect(buffer.read_marker_pending).not.toBeNull();
    });

    test('adopts a newer external marker and clears the pending one', () => {
        const { appState, network, buffer } = makeNetwork();
        addMessage(appState, buffer, 1000, 'm1');
        addMessage(appState, buffer, 2000, 'm2');
        network.ircClient.readMarker.set.mockReturnValue('label-1');
        buffer.markAsRead(false);

        network.ircClient.emit('read-marker', {
            target: '#test',
            timestamp: 'timestamp=1970-01-01T00:00:02.000Z',
            tags: {},
        });

        expect(buffer.last_read).toBe(2000);
        expect(buffer.flags.last_read_authoritative).toBe(2000);
        expect(buffer.read_marker_pending).toBeNull();
    });

    test('expires an unconfirmed pending marker', async() => {
        jest.useFakeTimers();
        const { appState, network, buffer } = makeNetwork();
        addMessage(appState, buffer, 1000, 'm1');
        network.ircClient.readMarker.set.mockReturnValue('label-1');

        buffer.markAsRead(false);
        expect(buffer.read_marker_pending).not.toBeNull();

        await jest.advanceTimersByTimeAsync(15000);

        expect(buffer.read_marker_pending).toBeNull();
        expect(buffer.last_read).toBe(1000);
    });

    test('accepts an older server marker and lowers the display marker', () => {
        const { buffer } = makeNetwork();
        buffer.last_read = 9000;
        buffer.flags.last_read_authoritative = 0;

        buffer.applyServerReadMarker(3000);

        expect(buffer.flags.last_read_authoritative).toBe(3000);
        expect(buffer.last_read).toBe(3000);
        expect(buffer.flags.unread).toBe(0);
    });

    test('adopts an incoming server marker from the client event', () => {
        const { network, buffer } = makeNetwork();
        buffer.last_read = 9000;

        network.ircClient.emit('read-marker', {
            target: '#test',
            timestamp: 'timestamp=1970-01-01T00:00:03.000Z',
            tags: {},
        });

        expect(buffer.flags.last_read_authoritative).toBe(3000);
        expect(buffer.last_read).toBe(3000);
    });

    test('treats MARKREAD * as no marker and still sends the next marker', () => {
        const { appState, network, buffer } = makeNetwork();
        addMessage(appState, buffer, 1000, 'm1');
        buffer.last_read = 5000;
        buffer.flags.last_read_authoritative = 4000;

        network.ircClient.emit('read-marker', {
            target: '#test',
            timestamp: '*',
            tags: {},
        });

        expect(buffer.flags.last_read_authoritative).toBe(0);
        expect(buffer.last_read).toBe(5000);

        buffer.markAsRead(false);
        expect(network.ircClient.readMarker.set).toHaveBeenCalledWith(
            '#test',
            new Date(1000)
        );
    });

    test('reverts the display marker after a MARKREAD failure', () => {
        const { buffer } = makeNetwork();
        buffer.last_read = 9000;
        buffer.flags.last_read_authoritative = 4000;

        buffer.readMarkerFailed();

        expect(buffer.last_read).toBe(4000);
    });

    test('clears a matching pending marker on failure', () => {
        const { appState, network, buffer } = makeNetwork();
        addMessage(appState, buffer, 1000, 'm1');
        network.ircClient.readMarker.set.mockReturnValue('label-1');
        buffer.markAsRead(false);
        buffer.flags.last_read_authoritative = 500;
        buffer.last_read = 1000;

        buffer.readMarkerFailed('other-label');
        expect(buffer.read_marker_pending).not.toBeNull();

        buffer.readMarkerFailed('label-1');
        expect(buffer.read_marker_pending).toBeNull();
        expect(buffer.last_read).toBe(500);
    });

    test('serializes read-marker tags on the message', () => {
        const { network } = makeNetwork(['draft/read-marker', 'labeled-response']);
        const client = network.ircClient;
        client.raw = jest.fn();
        client.readMarker.set.mockRestore();

        client.readMarker.set('#test', new Date(1000));

        const message = client.raw.mock.calls[0][0];
        expect(message.command).toBe('MARKREAD');
        expect(message.params).toEqual([
            '#test',
            'timestamp=1970-01-01T00:00:01.000Z',
        ]);
        expect(message.tags.label).toBeTruthy();
    });
});
