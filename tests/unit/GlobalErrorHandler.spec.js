import getState from '@/libs/state';
import { installGlobalErrorHandlers, showUnexpectedError } from '@/libs/GlobalErrorHandler';

jest.mock('@/helpers/TextFormatting', () => {
    const actual = jest.requireActual('@/helpers/TextFormatting');
    return {
        ...actual,
        t: jest.fn((key, vars) => (vars && vars.message ? `${key}: ${vars.message}` : key)),
    };
});

describe('GlobalErrorHandler.js', () => {
    let state;
    let buffer;
    let addMessage;

    beforeEach(() => {
        state = getState();
        buffer = { name: '#test' };
        jest.spyOn(state, 'getActiveBuffer').mockReturnValue(buffer);
        addMessage = jest.spyOn(state, 'addMessage').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('reports an unexpected error in the active buffer', () => {
        showUnexpectedError({ error: 'UNKNOWN_ERROR', reason: 'readonly database' }, 'promise');

        expect(addMessage).toHaveBeenCalledTimes(1);
        expect(addMessage.mock.calls[0][0]).toBe(buffer);
        expect(addMessage.mock.calls[0][1].type).toBe('error');
        expect(addMessage.mock.calls[0][1].message).toContain('readonly database');
    });

    test('does nothing when there is no active buffer', () => {
        state.getActiveBuffer.mockReturnValue(null);

        expect(() => showUnexpectedError('boom', 'promise')).not.toThrow();
        expect(addMessage).not.toHaveBeenCalled();
    });

    test('installs window and Vue error handlers', () => {
        const listeners = {};
        const win = {
            addEventListener: jest.fn((name, fn) => {
                listeners[name] = fn;
            }),
        };
        const vue = { config: {} };

        installGlobalErrorHandlers(vue, win);

        expect(typeof listeners.unhandledrejection).toBe('function');
        listeners.unhandledrejection({ reason: { reason: 'nope' } });
        expect(addMessage).toHaveBeenCalledTimes(1);

        expect(typeof vue.config.errorHandler).toBe('function');
        vue.config.errorHandler(new Error('vue broke'), null, 'render');
        expect(addMessage).toHaveBeenCalledTimes(2);
        expect(addMessage.mock.calls[1][1].message).toContain('vue broke');
    });
});
