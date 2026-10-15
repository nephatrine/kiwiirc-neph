import state from '@/libs/state';

describe('network.isService', () => {
    let s;
    let network;

    beforeEach(() => {
        s = state.create();
        network = s.addNetwork('TestNetwork', 'TestNick', {});
    });

    it('recognises common network services', () => {
        [
            'NickServ', 'ChanServ', 'MemoServ', 'HostServ',
            'OperServ', 'BotServ', 'RootServ', 'HelpServ',
            'StatServ', 'HistServ',
        ].forEach((service) => {
            expect(network.isService(service)).toBe(true);
        });
    });

    it('matches service nicks case-insensitively', () => {
        expect(network.isService('HISTserv')).toBe(true);
        expect(network.isService('histserv')).toBe(true);
    });

    it('returns false for regular nicks and empty input', () => {
        expect(network.isService('SomeUser')).toBe(false);
        expect(network.isService('')).toBe(false);
        expect(network.isService(null)).toBe(false);
        expect(network.isService(undefined)).toBe(false);
    });

    it('honours network-specific services when provided', () => {
        network.services = ['CustomServ'];
        expect(network.isService('customserv')).toBe(true);
        expect(network.isService('SomeUser')).toBe(false);
    });
});
