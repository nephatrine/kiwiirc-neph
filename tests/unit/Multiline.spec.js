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

        it('should concatenate continued lines for PRIVMSG and NOTICE', () => {
            let batch = {
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

            let results = BatchHandlers.handleMultilineBatch(network, client, batch);

            expect(results.length).toBe(1);
            // Part 1 + continued merge without newline; Part 2 follows a newline
            expect(results[0].params[1]).toBe('Part 1 continued\nPart 2');

            batch = {
                tags: {},
                commands: [
                    {
                        command: 'NOTICE',
                        params: ['#channel', 'Part 1'],
                        tags: {},
                    },
                    {
                        command: 'NOTICE',
                        params: ['#channel', ' continued'],
                        tags: { 'draft/multiline-concat': '' },
                    },
                    {
                        command: 'NOTICE',
                        params: ['#channel', 'Part 2'],
                        tags: {},
                    },
                ],
            };

            results = BatchHandlers.handleMultilineBatch(network, client, batch);

            expect(results.length).toBe(1);
            expect(results[0].command).toBe('NOTICE');
            expect(results[0].params[1]).toBe('Part 1 continued\nPart 2');
        });

        it('should mark bridge card multiline batches', () => {
            const batch = {
                tags: {},
                commands: [
                    {
                        command: 'PRIVMSG',
                        params: ['#channel', '[PREVIEW]'],
                        tags: {},
                    },
                    {
                        command: 'PRIVMSG',
                        params: ['#channel', 'Title: A title'],
                        tags: {},
                    },
                    {
                        command: 'PRIVMSG',
                        params: ['#channel', 'Body'],
                        tags: {},
                    },
                ],
            };

            const results = BatchHandlers.handleMultilineBatch(network, client, batch);

            expect(results[0].tags['kiwi-bridge-card']).toBe('1');
            expect(results[0].params[1]).toBe('[PREVIEW]\nTitle: A title\nBody');
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

        function sentMessages() {
            return client.raw.mock.calls
                .map(([message]) => message)
                .filter((message) => message && message.command === 'PRIVMSG');
        }

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

        it('should keep emoji graphemes intact in long lines', () => {
            const emoji = '😀';
            const longLine = emoji.repeat(100);
            BatchHandlers.sendMultiline(
                network,
                {},
                'PRIVMSG',
                '#channel',
                longLine,
                {}
            );

            let chunks = sentMessages().map((message) => message.params[1]);
            expect(chunks.join('')).toBe(longLine);
            expect(chunks.length).toBeGreaterThan(1);
            chunks.forEach((chunk) => {
                expect(chunk.split(emoji).join('')).toBe('');
                expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(300);
            });

            client.raw.mockClear();
            const family = '👨‍👩‍👧‍👦';
            const familyLine = family.repeat(50);
            network.capValue.mockReturnValue('max-bytes=10000,max-lines=10');
            BatchHandlers.sendMultiline(
                network,
                {},
                'PRIVMSG',
                '#channel',
                familyLine,
                {}
            );

            chunks = sentMessages().map((message) => message.params[1]);
            expect(chunks.join('')).toBe(familyLine);
            expect(chunks.length).toBeGreaterThan(1);
            chunks.forEach((chunk) => {
                expect(chunk.split(family).join('')).toBe('');
                expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(300);
            });
        });

        it('should count generated chunks when enforcing max-lines', () => {
            network.capValue.mockReturnValue('max-bytes=10000,max-lines=2');
            const state = { addMessage: jest.fn() };

            BatchHandlers.sendMultiline(
                network,
                state,
                'PRIVMSG',
                '#channel',
                'a'.repeat(700),
                {}
            );

            expect(client.raw).not.toHaveBeenCalled();
            expect(state.addMessage).toHaveBeenCalledWith(
                undefined,
                expect.objectContaining({ type: 'error' })
            );
        });
    });
});
