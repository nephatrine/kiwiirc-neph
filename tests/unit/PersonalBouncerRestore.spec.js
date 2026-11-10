jest.mock('@/libs/BouncerProvider', () => jest.fn(() => ({
    enable: jest.fn(),
})));

import BouncerProvider from '@/libs/BouncerProvider';
import Personal from '@/components/startups/Personal';

describe('Personal bouncer restoration', () => {
    test('enables the bouncer provider from a saved control connection', async() => {
        const controller = {
            id: 1,
            is_bnc: true,
            connection: {
                server: 'bnc.example.com',
                port: 6697,
                tls: true,
                direct: false,
                path: '',
            },
        };
        const state = {
            settings: {
                startupOptions: {},
            },
            persistence: {
                includeBuffers: false,
                watchStateForChanges: jest.fn(),
            },
            networks: [controller],
            setSetting: jest.fn(),
            setActiveBuffer: jest.fn(),
        };
        const context = {
            $state: state,
            $emit: jest.fn(),
        };

        await Personal.methods.init.call(context);

        expect(BouncerProvider).toHaveBeenCalledWith(state);
        const provider = BouncerProvider.mock.results[0].value;
        expect(provider.enable).toHaveBeenCalledWith(
            'bnc.example.com',
            6697,
            true,
            false,
            ''
        );
        expect(state.setSetting).toHaveBeenCalledWith('settings.restricted', false);
    });
});
