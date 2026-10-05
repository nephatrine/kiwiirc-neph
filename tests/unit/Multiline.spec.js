import * as BatchHandlers from '@/libs/BatchHandlers';
import * as TextFormatting from '@/helpers/TextFormatting';

const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

jest.mock('@/helpers/TextFormatting');

describe('BatchHandlers.js', () => {
    describe('handleMultiline', () => {
        let network;
        let state;
        let client;
        let parsedEventsHandler;

        beforeEach(() => {
            network = {
                extractTargetGroup: jest.fn().mockReturnValue(null),
            };
            state = {};
            client = {};
            parsedEventsHandler = jest.fn();
        });

        it('should concatenate messages with draft/multiline-concat tag', () => {
            const event = {
                tags: { account: 'Account1' },
                commands: [
                    {
                        command: 'PRIVMSG',
                        params: ['#channel', 'Part 1'],
                        tags: { 'draft/multiline-concat': '' },
                    },
                    {
                        command: 'PRIVMSG',
                        params: ['#channel', 'Part 2'],
                        tags: {},
                    },
                    {
                        command: 'PRIVMSG',
                        params: ['#channel', 'Part 3'],
                        tags: {},
                    },
                ],
            };

            BatchHandlers.handleMultiline(network, state, event, parsedEventsHandler, client);

            expect(parsedEventsHandler).toHaveBeenCalled();
            const cmdName = parsedEventsHandler.mock.calls[0][0];
            const syntheticEvent = parsedEventsHandler.mock.calls[0][1];
            expect(cmdName).toBe('message');
            expect(syntheticEvent.message).toBe('Part 1Part 2\nPart 3');
            expect(syntheticEvent.target).toBe('#channel');
            expect(syntheticEvent.type).toBe('privmsg');
            expect(syntheticEvent.account).toBe('Account1');
        });

        it('should handle empty batches gracefully', () => {
            const event = { commands: [] };
            BatchHandlers.handleMultiline(network, state, event, parsedEventsHandler, client);
            expect(parsedEventsHandler).not.toHaveBeenCalled();
        });
    });

    describe('sendMultiline', () => {
        let network;
        let state;
        let client;

        beforeEach(() => {
            client = {
                raw: jest.fn(),
                Message: function Message(c, ...args) {
                    this.command = c;
                    this.params = args;
                    this.tags = {};
                    this.to1459 = () => `${this.command} ${this.params.join(' ')}`;
                },
            };
            network = {
                ircClient: client,
                capValue: jest.fn().mockReturnValue('max-bytes=100,max-lines=5'),
                bufferByName: jest.fn(),
                serverBuffer: jest.fn(),
                isChannelName: jest.fn().mockReturnValue(true),
                extractTargetGroup: jest.fn().mockReturnValue(null),
            };
            state = {
                addMessage: jest.fn(),
            };

            TextFormatting.t.mockImplementation((key, vars) => (
                vars && vars.count ? `${key} ${vars.count}` : key
            ));
        });

        it('should send a valid multiline message as a batch', () => {
            const message = 'Line 1\nLine 2';
            const tags = { '+reply': '123' };
            BatchHandlers.sendMultiline(network, state, 'PRIVMSG', '#channel', message, tags);

            expect(client.raw).toHaveBeenCalledWith(expect.objectContaining({
                command: 'BATCH',
                params: [expect.stringMatching(/^\+[a-z0-9]+$/), 'draft/multiline', '#channel'],
                tags: expect.objectContaining({ '+reply': '123' }),
            }));
            expect(client.raw).toHaveBeenCalledWith(expect.objectContaining({
                command: 'PRIVMSG',
                params: ['#channel', 'Line 1'],
                tags: expect.not.objectContaining({
                    '+reply': expect.anything(),
                }),
            }));
            expect(client.raw).toHaveBeenCalledWith(expect.objectContaining({
                command: 'PRIVMSG',
                params: ['#channel', 'Line 2'],
                tags: expect.not.objectContaining({
                    '+reply': expect.anything(),
                }),
            }));
            expect(client.raw).toHaveBeenCalledWith(expect.stringMatching(/^BATCH -[a-z0-9]+/));
        });

        it('should use draft/multiline-concat tag when chunking long lines', () => {
            network.capValue.mockReturnValue('max-bytes=1000,max-lines=10');
            const longLine = 'a'.repeat(400);
            BatchHandlers.sendMultiline(network, state, 'PRIVMSG', '#channel', longLine, {});

            expect(client.raw).toHaveBeenCalledWith(expect.objectContaining({
                command: 'PRIVMSG',
                params: ['#channel', expect.stringContaining('aaa')],
                tags: expect.objectContaining({
                    'draft/multiline-concat': true,
                }),
            }));
        });

        it('should block oversized messages (bytes)', () => {
            const message = 'a'.repeat(200); // max-bytes is 100
            BatchHandlers.sendMultiline(network, state, 'PRIVMSG', '#channel', message, {});

            expect(client.raw).not.toHaveBeenCalled();
            expect(state.addMessage).toHaveBeenCalled();
            expect(state.addMessage.mock.calls[0][1].message).toBe('multiline_too_large');
        });

        it('should block oversized messages (lines)', () => {
            const message = '1\n2\n3\n4\n5\n6'; // max-lines is 5
            BatchHandlers.sendMultiline(network, state, 'PRIVMSG', '#channel', message, {});

            expect(client.raw).not.toHaveBeenCalled();
            expect(state.addMessage).toHaveBeenCalled();
        });
    });

    describe('handleNetsplit', () => {
        let network;
        let state;
        let serverBuffer;
        let channelBuffer;

        beforeEach(() => {
            serverBuffer = {
                getLastMessage: jest.fn(),
            };
            channelBuffer = {
                name: '#channel',
            };
            network = {
                name: 'TestNet',
                serverBuffer: () => serverBuffer,
                bufferByName: (name) => (name === '#channel' ? channelBuffer : null),
                isChannelName: (name) => name.startsWith('#'),
            };
            state = {
                addMessage: jest.fn(),
            };

            TextFormatting.formatAndT.mockImplementation((type, params, key, vars) => (
                `${key} ${vars.count}`
            ));
        });

        it('should collapse netsplit QUITs into a summary', () => {
            const event = {
                type: 'netsplit',
                params: ['server1.net', 'server2.net'],
                commands: [
                    { nick: 'user1', command: 'QUIT', params: ['#channel'] },
                    { nick: 'user2', command: 'QUIT', params: ['#channel'] },
                ],
            };

            BatchHandlers.handleNetsplit(network, state, event);

            expect(state.addMessage).toHaveBeenCalledTimes(2); // Server buffer + 1 Channel buffer
            const summary = state.addMessage.mock.calls[0][1].message;
            expect(summary).toContain('netsplit_summary');
            expect(summary).toContain('2');
        });
    });
});
