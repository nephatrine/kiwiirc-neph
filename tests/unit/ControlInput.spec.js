import ControlInput from '@/components/ControlInput';

describe('ControlInput input activity', () => {
    function makeContext(sharedInput) {
        const buffer = { current_input: 'old buffer input' };
        const network = { id: 'network' };
        const context = {
            buffer,
            network,
            current_input_value: '',
            showCommandWarning: true,
            maybeHidePlugins: jest.fn(),
            $state: {
                setting: jest.fn(() => sharedInput),
                ui: { current_input: 'old shared input' },
                $emit: jest.fn(),
            },
        };

        return { context, buffer, network };
    }

    it('updates the buffer and emits input activity', () => {
        const { context, buffer, network } = makeContext(false);

        ControlInput.methods.inputUpdate.call(context, 'hello');

        expect(context.current_input_value).toBe('hello');
        expect(buffer.current_input).toBe('hello');
        expect(context.showCommandWarning).toBe(false);
        expect(context.maybeHidePlugins).toHaveBeenCalledTimes(1);
        expect(context.$state.$emit).toHaveBeenCalledWith('input.activity', {
            network,
            buffer,
            textLength: 5,
        });
    });

    it('updates shared input and emits input activity', () => {
        const { context } = makeContext(true);

        ControlInput.methods.inputUpdate.call(context, 'hi');

        expect(context.$state.ui.current_input).toBe('hi');
        expect(context.$state.$emit).toHaveBeenCalledWith('input.activity', expect.objectContaining({
            textLength: 2,
        }));
    });
});
