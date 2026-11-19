jest.mock('sockjs-client', () => {
    const SockJS = jest.fn().mockImplementation(() => ({
        send: jest.fn(),
        close: jest.fn(),
    }));
    return SockJS;
});

import { createChannelConstructor } from '@/libs/ServerConnection';

describe('ServerConnection channel scoping', () => {
    test('scopes channels by gateway address and network id', () => {
        const wrapperA = createChannelConstructor('http://gateway-a.test/', '', 1);
        const wrapperB = createChannelConstructor('http://gateway-b.test/', '', 1);

        const channelA = wrapperA({ host: 'irc.example.com', port: 6667 });
        const channelB = wrapperB({ host: 'irc.example.com', port: 6667 });

        expect(channelA).not.toBe(channelB);

        const addr = 'http://gateway-probe.test/';
        const probeWrapper = createChannelConstructor(addr, '', undefined);
        const networkWrapper = createChannelConstructor(addr, '', 1);

        const probeChannel = probeWrapper({ host: 'irc.example.com', port: 6667 });
        const networkChannel = networkWrapper({ host: 'irc.example.com', port: 6667 });

        expect(probeChannel).not.toBe(networkChannel);
    });

    test('disposing a channel lets a later wrapper create a fresh one', () => {
        const addr = 'http://gateway-dispose.test/';
        const wrapper = createChannelConstructor(addr, '', 1);
        const first = wrapper({ host: 'irc.example.com', port: 6667 });

        first.disposeSocket();
        const second = wrapper({ host: 'irc.example.com', port: 6667 });

        expect(second).not.toBe(first);
    });
});
