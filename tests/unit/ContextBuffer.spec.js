import state from '@/libs/state';

describe('read-only context buffers', () => {
    it('creates a temporary special buffer and excludes it from persistence', () => {
        const s = state.create();
        const network = s.addNetwork('TestNet', 'TestNick', {
            server: 'irc.example.com',
        });
        const context = s.addContextBuffer(network.id, '#old');

        expect(context.contextOnly).toBe(true);
        expect(context.contextTarget).toBe('#old');
        expect(context.isSpecial()).toBe(true);
        expect(context.joined).toBe(false);
        expect(context.show_input).toBe(false);

        const exported = JSON.parse(s.exportState(true, false));
        const exportedNames = exported.networks[0].buffers.map((buffer) => buffer.name);
        expect(exportedNames).not.toContain(context.name);
    });

    it('does not PART a context buffer when it is closed', () => {
        const s = state.create();
        const network = s.addNetwork('TestNet', 'TestNick', {
            server: 'irc.example.com',
        });
        const context = s.addContextBuffer(network.id, '#old');
        const part = jest.spyOn(network.ircClient, 'part').mockImplementation(() => {});

        s.removeBuffer(context);

        expect(part).not.toHaveBeenCalled();
        expect(network.buffers).not.toContain(context);
    });
});
