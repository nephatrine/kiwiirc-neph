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

    test('opens media handles and joins channel links in the topic', () => {
        const url = 'https://example.com/image.jpg';
        const handle = {
            getAttribute: jest.fn((name) => (
                name === 'data-url' ? url : null
            )),
        };
        const mediaEvent = {
            target: {
                closest: jest.fn((selector) => (
                    selector === 'a[data-url]' ? handle : null
                )),
            },
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        };
        let context = makeContext();

        ContainerHeader.methods.onHeaderClick.call(context, mediaEvent);

        expect(context.$state.$emit).toHaveBeenCalledWith('mediaviewer.show', url);
        expect(mediaEvent.preventDefault).toHaveBeenCalled();
        expect(mediaEvent.stopPropagation).toHaveBeenCalled();
        expect(context.$state.addBuffer).not.toHaveBeenCalled();

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
        const channelEvent = {
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
        context = makeContext(network);

        ContainerHeader.methods.onHeaderClick.call(context, channelEvent);

        expect(context.$state.addBuffer).toHaveBeenCalledWith(1, '#other');
        expect(network.ircClient.join).toHaveBeenCalledWith('#other');
        expect(context.$state.$emit).not.toHaveBeenCalled();
    });

    test('enables search only with server support and ignores clicks without it', () => {
        let context = makeContext({
            state: 'connected',
            ircClient: {
                search: {
                    isSupported: () => true,
                },
            },
        });

        expect(ContainerHeader.computed.canSearch.call(context)).toBe(true);

        context = makeContext({
            state: 'connected',
            ircClient: {
                search: {
                    isSupported: () => false,
                },
            },
        });

        expect(ContainerHeader.computed.canSearch.call(context)).toBe(false);

        context.canSearch = false;

        ContainerHeader.methods.searchMessages.call(context);

        expect(context.$state.$emit).not.toHaveBeenCalled();
    });
});
