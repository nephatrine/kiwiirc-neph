import Vue from 'vue';
import InputText from '@/components/utils/InputText';
import IrcInput from '@/components/utils/IrcInput';

describe('input-text autocomplete', () => {
    function mount(props) {
        const vm = new Vue({
            el: document.createElement('div'),
            render: (h) => h(InputText, { props }),
        });
        return vm.$children[0].$el.querySelector('input, textarea');
    }

    it('defaults autocomplete off and forwards tokens and title hints', () => {
        let el = mount({ value: '', type: 'text' });
        expect(el.getAttribute('autocomplete')).toBe('off');

        el = mount({ value: '', type: 'password' });
        expect(el.getAttribute('autocomplete')).toBe('off');

        el = mount({ value: '', type: 'text', autocomplete: 'username' });
        expect(el.getAttribute('autocomplete')).toBe('username');

        el = mount({ value: '', type: 'password', autocomplete: 'current-password' });
        expect(el.getAttribute('autocomplete')).toBe('current-password');

        el = mount({ value: '', type: 'text', title: 'Field hint' });
        expect(el.getAttribute('title')).toBe('Field hint');
    });

    it('focuses its inner input', () => {
        // Attached so focus() moves document.activeElement under jsdom
        const mountEl = document.createElement('div');
        document.body.appendChild(mountEl);
        const vm = new Vue({
            el: mountEl,
            render: (h) => h(InputText, { props: { value: '', type: 'text' } }),
        });
        const comp = vm.$children[0];
        comp.focus();
        expect(document.activeElement).toBe(comp.$el.querySelector('input'));
        vm.$destroy();
        vm.$el.remove();
    });
});

describe('IrcInput paste handling', () => {
    test('emits pasted clipboard images once', () => {
        const image = {
            name: 'image.png',
            type: 'image/png',
            size: 10,
            lastModified: 1,
        };
        const methods = (IrcInput.options || IrcInput).methods;
        let context = {
            $emit: jest.fn(),
        };
        let event = {
            preventDefault: jest.fn(),
            clipboardData: {
                files: [],
                items: [{
                    kind: 'file',
                    getAsFile: () => image,
                }],
                types: ['image/png'],
            },
        };

        methods.onPaste.call(context, event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(context.$emit).toHaveBeenCalledWith('files', [image]);

        const duplicate = {
            name: 'image.png',
            type: 'image/png',
            size: 10,
            lastModified: 2,
        };
        context = {
            $emit: jest.fn(),
        };
        event = {
            preventDefault: jest.fn(),
            clipboardData: {
                files: [image],
                items: [{
                    kind: 'file',
                    getAsFile: () => duplicate,
                }],
                types: ['image/png'],
            },
        };

        methods.onPaste.call(context, event);

        expect(context.$emit).toHaveBeenCalledWith('files', [image]);
    });
});

describe('IrcInput non-breaking spaces', () => {
    test('normalizes non-breaking spaces in raw text', () => {
        const context = {
            $refs: {
                editor: {
                    innerText: '/lim\u00A0EIGHTBALL Am I cool?',
                },
            },
        };

        const methods = (IrcInput.options || IrcInput).methods;

        expect(methods.getRawText.call(context))
            .toBe('/lim EIGHTBALL Am I cool?');
    });
});
