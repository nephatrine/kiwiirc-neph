import { installTwitchAction } from '@/libs/IrcClient';

describe('Twitch actions', () => {
    it('sends /me literally instead of a CTCP action', () => {
        const ircClient = {
            action: jest.fn(),
            say: jest.fn(),
        };

        installTwitchAction(ircClient);
        ircClient.action('#channel', 'waves', { 'client-nonce': 'abc' });

        expect(ircClient.say).toHaveBeenCalledWith(
            '#channel',
            '/me waves',
            { 'client-nonce': 'abc' }
        );
    });
});
