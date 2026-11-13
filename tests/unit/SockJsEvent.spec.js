describe('SockJS event replacement', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('uses pagehide instead of the deprecated unload event', () => {
        const addEventListener = jest
            .spyOn(globalThis, 'addEventListener')
            .mockImplementation(() => {});
        let eventUtils;

        jest.isolateModules(() => {
            eventUtils = jest.requireActual('../../build/webpack/sockjs-event');
        });

        expect(addEventListener).toHaveBeenCalledWith(
            'pagehide',
            expect.any(Function),
            false
        );
        expect(addEventListener.mock.calls.some(([type]) => type === 'unload'))
            .toBe(false);

        const callback = jest.fn();
        eventUtils.unloadAdd(callback);

        const pagehideHandler = addEventListener.mock.calls.find(
            ([type]) => type === 'pagehide'
        )[1];
        pagehideHandler();

        expect(callback).toHaveBeenCalled();
    });
});
