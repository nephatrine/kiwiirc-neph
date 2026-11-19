import BufferSettings from '@/components/BufferSettings';
import state from '@/libs/state';

function makeBuffer(options = {}) {
    const raw = jest.fn();
    const settings = Object.assign({}, options.settings);
    const network = {
        connection: options.bncnetid ? { bncnetid: options.bncnetid } : {},
        ircClient: { raw },
    };
    const buffer = {
        name: '#test',
        settings,
        setting: jest.fn((name, value) => {
            if (typeof value !== 'undefined') {
                settings[name] = value;
                return value;
            }
            return settings[name];
        }),
        getNetwork: () => network,
    };

    return { buffer, raw };
}

function makeContext(buffer, deleteFn) {
    return {
        buffer,
        $delete: deleteFn || ((target, key) => {
            delete target[key];
        }),
    };
}

describe('buffer notification settings', () => {
    test('shows Default when the buffer has no override', () => {
        const { buffer } = makeBuffer();

        expect(BufferSettings.computed.settingAlertOn.get.call({ buffer }))
            .toBe('default');
    });

    test('shows an explicit buffer override', () => {
        const { buffer } = makeBuffer({
            settings: { alert_on: 'highlight' },
        });

        expect(BufferSettings.computed.settingAlertOn.get.call({ buffer }))
            .toBe('highlight');
    });

    test('clears the buffer override for Default', () => {
        const { buffer } = makeBuffer({
            settings: { alert_on: 'never' },
        });

        const result = BufferSettings.computed.settingAlertOn.set.call(
            makeContext(buffer),
            'default'
        );

        expect(result).toBe('default');
        expect(buffer.settings.alert_on).toBeUndefined();
        expect(buffer.settings.mute_sound).toBeUndefined();
    });

    test('sets Never without a separate sound flag', () => {
        const { buffer } = makeBuffer();

        BufferSettings.computed.settingAlertOn.set.call(makeContext(buffer), 'never');

        expect(buffer.settings.alert_on).toBe('never');
        expect(buffer.settings.mute_sound).toBeUndefined();
    });

    test('sets explicit non-Never options without a sound flag', () => {
        const { buffer } = makeBuffer();

        BufferSettings.computed.settingAlertOn.set.call(makeContext(buffer), 'highlight');

        expect(buffer.settings.alert_on).toBe('highlight');
        expect(buffer.settings.mute_sound).toBeUndefined();
    });

    test('Never clears Favorite', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#test');
        buffer.setting('favorite', true);

        expect(BufferSettings.computed.neverDisabledHint.call({
            buffer,
            $t: (key) => key,
        })).toBe('settings_never_disabled_hint');

        BufferSettings.computed.settingAlertOn.set.call(
            makeContext(buffer, (target, key) => s.$delete(target, key)),
            'never'
        );

        expect(buffer.setting('alert_on')).toBe('never');
        expect(buffer.setting('favorite')).toBe(false);
        expect(BufferSettings.computed.neverDisabledHint.call({
            buffer,
            $t: (key) => key,
        })).toBeNull();

        s.$destroy();
    });

    test('sends the selected value to the bouncer', () => {
        const { buffer, raw } = makeBuffer({ bncnetid: '42' });

        BufferSettings.computed.settingAlertOn.set.call(makeContext(buffer), 'default');

        expect(raw).toHaveBeenCalledWith(
            'BOUNCER changebuffer 42 #test notify=default'
        );
    });

    test('falls back to the network default after choosing Default', () => {
        const s = state.create();
        const network = s.addNetwork('TestNetwork', 'TestNick', {});
        const buffer = s.addBuffer(network.id, '#test');

        network.setting('alert_on', 'never');
        buffer.setting('alert_on', 'message');

        BufferSettings.computed.settingAlertOn.set.call(
            makeContext(buffer, (target, key) => s.$delete(target, key)),
            'default'
        );

        expect(buffer.settings.alert_on).toBeUndefined();
        expect(buffer.setting('alert_on')).toBe('never');

        s.$destroy();
    });
});
