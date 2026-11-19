import StateBrowser from '@/components/StateBrowser';

describe('StateBrowser search availability', () => {
    function makeContext(searchAvailable, restricted) {
        return {
            searchAvailable,
            searchVisible: searchAvailable,
            isRestrictedServer: restricted,
            $state: {
                $emit: jest.fn(),
            },
        };
    }

    function makeBuffer(isServer, isSpecial) {
        return {
            isServer: () => isServer,
            isSpecial: () => isSpecial,
        };
    }

    function makeVisibilityContext(options = {}) {
        return {
            searchAvailable: options.available !== false,
            searchHidden: options.hidden === true,
            activeBufferIsSpecial: options.special !== false,
            $state: {
                ui: {
                    is_narrow: options.mobile === true,
                },
            },
        };
    }

    test('gates search visibility on restricted mode', () => {
        expect(StateBrowser.computed.searchHidden.call(makeContext(false, true)))
            .toBe(true);
        expect(StateBrowser.computed.searchHidden.call(makeContext(false, false)))
            .toBe(false);
    });

    test('recognizes server and special buffers', () => {
        const server = StateBrowser.computed.activeBufferIsSpecial.call({
            $state: {
                getActiveBuffer: () => makeBuffer(true, false),
            },
        });
        const raw = StateBrowser.computed.activeBufferIsSpecial.call({
            $state: {
                getActiveBuffer: () => makeBuffer(false, true),
            },
        });
        const channel = StateBrowser.computed.activeBufferIsSpecial.call({
            $state: {
                getActiveBuffer: () => makeBuffer(false, false),
            },
        });

        expect(server).toBe(true);
        expect(raw).toBe(true);
        expect(channel).toBe(false);
    });

    test('shows search only on special desktop buffers with a source', () => {
        expect(StateBrowser.computed.searchVisible.call(makeVisibilityContext()))
            .toBe(true);
        expect(StateBrowser.computed.searchVisible.call(makeVisibilityContext({
            special: false,
        }))).toBe(false);
        expect(StateBrowser.computed.searchVisible.call(makeVisibilityContext({
            mobile: true,
        }))).toBe(false);
        expect(StateBrowser.computed.searchVisible.call(makeVisibilityContext({
            hidden: true,
        }))).toBe(false);

        const menuContext = makeVisibilityContext();
        menuContext.usermenuOpen = true;
        expect(StateBrowser.computed.searchVisible.call(menuContext)).toBe(false);
    });

    test('opens search only when it is available', () => {
        const unavailable = makeContext(false, false);
        StateBrowser.methods.clickSearch.call(unavailable);
        expect(unavailable.$state.$emit).not.toHaveBeenCalled();

        const available = makeContext(true, true);
        StateBrowser.methods.clickSearch.call(available);
        expect(available.$state.$emit).toHaveBeenCalledWith('chatlogs.open');
    });
});
