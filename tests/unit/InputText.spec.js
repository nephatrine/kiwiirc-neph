import Vue from 'vue';
import InputText from '@/components/utils/InputText';

describe('input-text autocomplete', () => {
    function mount(props) {
        const vm = new Vue({
            el: document.createElement('div'),
            render: (h) => h(InputText, { props }),
        });
        return vm.$children[0].$el.querySelector('input, textarea');
    }

    it('defaults text inputs to autocomplete off', () => {
        const el = mount({ value: '', type: 'text' });
        expect(el.getAttribute('autocomplete')).toBe('off');
    });

    it('defaults password inputs to autocomplete off', () => {
        const el = mount({ value: '', type: 'password' });
        expect(el.getAttribute('autocomplete')).toBe('off');
    });

    it('forwards a username token to the rendered input', () => {
        const el = mount({ value: '', type: 'text', autocomplete: 'username' });
        expect(el.getAttribute('autocomplete')).toBe('username');
    });

    it('forwards a current-password token to the rendered input', () => {
        const el = mount({ value: '', type: 'password', autocomplete: 'current-password' });
        expect(el.getAttribute('autocomplete')).toBe('current-password');
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
