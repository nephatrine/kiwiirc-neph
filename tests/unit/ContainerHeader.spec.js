import ContainerHeader from '@/components/ContainerHeader';

describe('ContainerHeader link handling', () => {
    function makeContext(network = null) {
        return {
            buffer: {
                networkid: 1,
                getNetwork: () => network,
            },
            $state: {
                addBuffer: jest.fn(),
                $emit: jest.fn(),
            },
        };
    }

    test('opens topic preview handles in the pinned media area', () => {
        const url = 'https://example.com/image.jpg';
        const handle = {
            getAttribute: jest.fn((name) => (
                name === 'data-url' ? url : null
            )),
        };
        const event = {
            target: {
                closest: jest.fn((selector) => (
                    selector === 'a[data-url]' ? handle : null
                )),
            },
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        };
        const context = makeContext();

        ContainerHeader.methods.onHeaderClick.call(context, event);

        expect(context.$state.$emit).toHaveBeenCalledWith('mediaviewer.show', url);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
        expect(context.$state.addBuffer).not.toHaveBeenCalled();
    });

    test('still joins channel links in the topic', () => {
        const channel = {
            getAttribute: jest.fn((name) => (
                name === 'data-channel-name' ? '#other' : null
            )),
        };
        const network = {
            ircClient: {
                join: jest.fn(),
            },
        };
        const event = {
            target: {
                closest: jest.fn((selector) => {
                    if (selector === 'a[data-url]') {
                        return null;
                    }
                    return selector === '[data-channel-name]' ? channel : null;
                }),
            },
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        };
        const context = makeContext(network);

        ContainerHeader.methods.onHeaderClick.call(context, event);

        expect(context.$state.addBuffer).toHaveBeenCalledWith(1, '#other');
        expect(network.ircClient.join).toHaveBeenCalledWith('#other');
        expect(context.$state.$emit).not.toHaveBeenCalled();
    });
});
