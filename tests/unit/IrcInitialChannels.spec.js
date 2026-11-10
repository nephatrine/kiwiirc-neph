import state from '@/libs/state';

describe('IrcClient initial channels', () => {
    let s;
    let network;
    let client;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {
            server: 'irc.example.com',
        });
        network.connection.channels = '#one,#two key';
        client = network.ircClient;
        jest.spyOn(client, 'join').mockImplementation(() => {});
        jest.spyOn(client, 'who').mockImplementation(() => {});
        jest.spyOn(client, 'raw').mockImplementation(() => {});
        jest.spyOn(s, 'addMessage').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function emitRegistered() {
        return new Promise((resolve, reject) => {
            const event = {
                command: 'registered',
                nick: 'TestNick',
                params: [],
            };
            client.parsed_middleware.handle(
                ['registered', event, client],
                (err) => (err ? reject(err) : resolve())
            );
        });
    }

    test('creates and joins the configured initial channels on registration', async() => {
        await emitRegistered();

        const one = s.getBufferByName(network.id, '#one');
        const two = s.getBufferByName(network.id, '#two');

        expect(one).toMatchObject({ joined: false, enabled: true, key: 'key' });
        expect(two).toMatchObject({ joined: false, enabled: true, key: '' });
        expect(client.join).toHaveBeenCalledWith('#one', 'key');
        expect(client.join).toHaveBeenCalledWith('#two', '');
    });
});
