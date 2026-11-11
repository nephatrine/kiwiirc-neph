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

    test('hides search when unavailable in restricted mode', () => {
        const context = makeContext(false, true);

        expect(StateBrowser.computed.searchHidden.call(context)).toBe(true);
    });

    test('keeps search visible but disabled outside restricted mode', () => {
        const context = makeContext(false, false);

        expect(StateBrowser.computed.searchHidden.call(context)).toBe(false);
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

    test('shows search on special buffers in the desktop layout', () => {
        const context = makeVisibilityContext();

        expect(StateBrowser.computed.searchVisible.call(context)).toBe(true);
    });

    test('hides search for normal buffers', () => {
        const context = makeVisibilityContext({ special: false });

        expect(StateBrowser.computed.searchVisible.call(context)).toBe(false);
    });

    test('hides search in the mobile layout', () => {
        const context = makeVisibilityContext({ mobile: true });

        expect(StateBrowser.computed.searchVisible.call(context)).toBe(false);
    });

    test('hides search in restricted mode without a source', () => {
        const context = makeVisibilityContext({ hidden: true });

        expect(StateBrowser.computed.searchVisible.call(context)).toBe(false);
    });

    test('does not open search when it is unavailable', () => {
        const context = makeContext(false, false);

        StateBrowser.methods.clickSearch.call(context);

        expect(context.$state.$emit).not.toHaveBeenCalled();
    });

    test('opens search when it is available', () => {
        const context = makeContext(true, true);

        StateBrowser.methods.clickSearch.call(context);

        expect(context.$state.$emit).toHaveBeenCalledWith('chatlogs.open');
    });
});
