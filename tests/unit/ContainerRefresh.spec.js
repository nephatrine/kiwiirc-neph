import Container from '@/components/Container';

function makeContext(buffer, settings) {
    return {
        buffer,
        $state: {
            setting: jest.fn((key) => settings[key]),
        },
    };
}

describe('Container message list refresh key', () => {
    test('changes with the buffer, theme, layout, and font settings', () => {
        const buffer = {
            name: '#kiwiirc',
            setting: jest.fn(() => 'inline'),
        };
        const settings = {
            theme: 'NephWave',
            useMonospace: false,
        };
        const context = makeContext(buffer, settings);

        const initialKey = Container.computed.messageListKey.call(context);

        settings.theme = 'NephDeck';
        const themeKey = Container.computed.messageListKey.call(context);
        expect(themeKey).not.toBe(initialKey);

        buffer.setting.mockReturnValue('corporate');
        const layoutKey = Container.computed.messageListKey.call(context);
        expect(layoutKey).not.toBe(themeKey);

        settings.useMonospace = true;
        const fontKey = Container.computed.messageListKey.call(context);
        expect(fontKey).not.toBe(layoutKey);

        buffer.name = '#other';
        const bufferKey = Container.computed.messageListKey.call(context);
        expect(bufferKey).not.toBe(fontKey);
    });

    test('falls back to the global layout when the buffer has no override', () => {
        const settings = {
            'buffers.messageLayout': 'modern',
            'theme': 'Default',
            'useMonospace': false,
        };
        const context = makeContext({ name: '#kiwiirc' }, settings);

        expect(Container.computed.messageListKey.call(context))
            .toBe('#kiwiirc|Default|modern|sans');
    });
});
