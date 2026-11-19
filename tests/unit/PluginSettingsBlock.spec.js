import Vue from 'vue';
import PluginSettingsBlock from '@/components/utils/PluginSettingsBlock';

describe('PluginSettingsBlock', () => {
    let vm;

    afterEach(() => {
        if (vm) {
            vm.$destroy();
            if (vm.$el.parentNode) {
                vm.$el.parentNode.removeChild(vm.$el);
            }
        }
        vm = null;
    });

    function makeBlock(component, title = 'Plugin Block', props = {}) {
        return {
            id: 1,
            component,
            props,
            title: () => title,
        };
    }

    function mountBlock(block, network = null) {
        const mountEl = document.createElement('div');
        document.body.appendChild(mountEl);

        vm = new Vue({
            el: mountEl,
            render: (h) => h(PluginSettingsBlock, {
                props: {
                    block,
                    network,
                },
            }),
        });

        return vm.$children[0];
    }

    it('renders the title, network props, and registered props', () => {
        let Child = {
            props: ['network', 'pluginProps'],
            render(h) {
                const networkName = this.network ? this.network.name : 'none';
                const pluginName = this.pluginProps.network ?
                    this.pluginProps.network.name :
                    'none';
                return h('div', { class: 'plugin-block-content' }, [
                    `${networkName}|${pluginName}`,
                ]);
            },
        };
        const network = { name: 'TestNet' };

        let comp = mountBlock(makeBlock(Child), network);

        expect(comp.$el.classList.contains('kiwi-appsettings-plugin-block')).toBe(true);
        expect(comp.$el.querySelector('h3').textContent).toBe('Plugin Block');
        expect(comp.$el.querySelector('.plugin-block-content').textContent)
            .toBe('TestNet|TestNet');

        vm.$destroy();
        vm.$el.remove();
        vm = null;

        Child = {
            props: ['extra'],
            render(h) {
                return h('div', { class: 'plugin-block-content' }, [this.extra]);
            },
        };

        comp = mountBlock(makeBlock(Child, 'Props', { extra: 'Extra value' }));

        expect(comp.$el.querySelector('.plugin-block-content').textContent)
            .toBe('Extra value');
    });

    it('renders general blocks without a network', () => {
        const Child = {
            props: ['network', 'pluginProps'],
            render(h) {
                return h('div', { class: 'plugin-block-content' }, [
                    `${this.network ? 'network' : 'none'}|` +
                    `${Object.keys(this.pluginProps).length}`,
                ]);
            },
        };

        const comp = mountBlock(makeBlock(Child, ''));

        expect(comp.$el.querySelector('h3')).toBeNull();
        expect(comp.$el.querySelector('.plugin-block-content').textContent)
            .toBe('none|0');
    });
});
