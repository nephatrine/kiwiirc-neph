import * as BatchHandlers from '@/libs/BatchHandlers';
import * as TextFormatting from '@/helpers/TextFormatting';

const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

jest.mock('@/helpers/TextFormatting');

describe('BatchHandlers.js', () => {
    describe('handleMultilineBatch', () => {
        let network;
        let client;

        beforeEach(() => {
            network = {
                extractTargetGroup: jest.fn().mockReturnValue(null),
            };
            client = {};
        });

        it('should concatenate messages with draft/multiline-concat tag (look-back)', () => {
            const batch = {
                tags: { account: 'Account1' },
                commands: [
                    {
                        command: 'PRIVMSG',
                        params: ['#channel', 'Part 1'],
                        tags: {},
                    },
                    {
                        command: 'PRIVMSG',
                        params: ['#channel', ' continued'],
                        tags: { 'draft/multiline-concat': '' },
                    },
                    {
                        command: 'PRIVMSG',
                        params: ['#channel', 'Part 2'],
                        tags: {},
                    },
                ],
            };

            const results = BatchHandlers.handleMultilineBatch(network, client, batch);

            expect(results.length).toBe(1);
            const syntheticEvent = results[0];
            // Part 1 + continued should be merged without newline
            // Part 2 should be after a newline
            expect(syntheticEvent.params[1]).toBe('Part 1 continued\nPart 2');
        });
    });

    describe('sendMultiline', () => {
        let network;
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
                capValue: jest.fn().mockReturnValue('max-bytes=1000,max-lines=5'),
                bufferByName: jest.fn(),
                serverBuffer: jest.fn(),
                isChannelName: jest.fn().mockReturnValue(true),
                extractTargetGroup: jest.fn().mockReturnValue(null),
                active_outgoing_batches: new Map(),
            };

            TextFormatting.t.mockImplementation((key, vars) => (
                vars && vars.count ? `${key} ${vars.count}` : key
            ));
        });

        it('should send value-less concat tag on subsequent chunks only', () => {
            const longLine = 'a'.repeat(400); // Trigger chunking (350 limit)
            BatchHandlers.sendMultiline(network, {}, 'PRIVMSG', '#channel', longLine, {});

            // First chunk: no concat tag
            expect(client.raw).toHaveBeenCalledWith(expect.objectContaining({
                command: 'PRIVMSG',
                params: ['#channel', expect.stringMatching(/^a{300}$/)],
                tags: expect.not.objectContaining({ 'draft/multiline-concat': true }),
            }));

            // Second chunk: has concat tag
            expect(client.raw).toHaveBeenCalledWith(expect.objectContaining({
                command: 'PRIVMSG',
                params: ['#channel', expect.stringMatching(/^a{100}$/)],
                tags: expect.objectContaining({ 'draft/multiline-concat': true }),
            }));
        });
    });
});
