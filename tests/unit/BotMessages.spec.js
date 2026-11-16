import state from '@/libs/state';
import Message from '@/libs/Message';

function makeNetwork() {
    const s = state.create();
    const network = s.addNetwork('TestNetwork', 'TestNick', {
        server: 'irc.example.com',
    });
    network.nick = 'TestNick';
    network.state = 'connected';
    const buffer = s.addBuffer(network.id, '#test');
    const user = s.addUser(network.id, { nick: 'BotUser' });
    user.metadata.bot = 'Sopel';
    return { s, network, buffer, user };
}

function emitMessage(network, nick, target, message) {
    network.ircClient.command_handler.emit('privmsg', {
        nick,
        ident: nick.toLowerCase(),
        hostname: 'example.com',
        target,
        message,
        tags: {},
        time: Date.now(),
    });
}

describe('bot messages', () => {
    test('marks metadata bots as bot messages', () => {
        const { s, user } = makeNetwork();
        const message = new Message({
            nick: 'BotUser',
            message: 'hello',
        }, user);

        expect(message.is_bot).toBe(true);
        s.$destroy();
    });

    test('resolves the network and global bot-message policy', () => {
        const { s, network } = makeNetwork();

        expect(network.showBotMessages()).toBe(true);
        s.setting('showBotMessages', false);
        expect(network.showBotMessages()).toBe(false);

        network.setting('showBotMessages', 'yes');
        expect(network.showBotMessages()).toBe(true);
        network.setting('showBotMessages', 'no');
        expect(network.showBotMessages()).toBe(false);
        s.$destroy();
    });

    test('filters metadata bots when bot messages are disabled', () => {
        const { s, network, buffer } = makeNetwork();
        network.setting('showBotMessages', 'no');

        emitMessage(network, 'BotUser', '#test', 'hidden');
        expect(buffer.getMessages()).toHaveLength(0);

        network.setting('showBotMessages', 'yes');
        emitMessage(network, 'BotUser', '#test', 'visible');
        expect(buffer.getMessages()).toHaveLength(1);
        expect(buffer.getMessages()[0].is_bot).toBe(true);
        s.$destroy();
    });
});
