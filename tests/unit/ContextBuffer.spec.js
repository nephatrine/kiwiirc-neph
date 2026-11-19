import state from '@/libs/state';

describe('read-only context buffers', () => {
    it('creates a temporary special buffer, excludes it from persistence, and closes quietly', () => {
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

        const part = jest.spyOn(network.ircClient, 'part').mockImplementation(() => {});

        s.removeBuffer(context);

        expect(part).not.toHaveBeenCalled();
        expect(network.buffers).not.toContain(context);
    });

    it('creates a read-only server context using the real buffer name', () => {
        const s = state.create();
        const network = s.addNetwork('TestNet', 'TestNick', {
            server: 'irc.example.com',
        });
        const context = s.addServerContextBuffer(network.id, '#old');

        expect(context.name).toBe('#old');
        expect(context.contextOnly).toBe(true);
        expect(context.contextSource).toBe('server');
        expect(context.contextTarget).toBe('#old');
        expect(context.show_input).toBe(false);
        expect(s.getBufferByName(network.id, '#old')).toBe(context);

        expect(s.addServerContextBuffer(network.id, '#old')).toBe(context);

        expect(context.promoteServerContext()).toBe(true);
        expect(context.contextOnly).toBe(false);
        expect(context.contextSource).toBe('');
        expect(context.contextTarget).toBe('');
        expect(context.show_input).toBe(true);
    });
});
