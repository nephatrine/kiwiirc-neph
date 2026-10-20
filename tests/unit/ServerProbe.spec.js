import EventEmitter from 'eventemitter3';
import { probeServerCaps } from '@/libs/ServerProbe';

function makeTransport() {
    const transport = new EventEmitter();
    transport.writeLine = jest.fn();
    transport.connect = jest.fn(() => {
        transport.emit('open');
    });
    transport.close = jest.fn();
    return transport;
}

function probeWith(transport, options) {
    return probeServerCaps({
        createTransport: () => transport,
        transportOptions: {
            direct: false,
            host: 'irc.example.net',
            port: 6697,
            ...(options || {}),
        },
    });
}

describe('server probe', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        window.sessionStorage.clear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('resolves caps from a single LS line without requesting anything else', async() => {
        const transport = makeTransport();
        const pending = probeWith(transport);
        transport.emit('line', ':serv CAP * LS :sasl draft/account-registration=before-connect');
        const info = await pending;

        expect(info.caps.sasl).toBe('');
        expect(info.caps['draft/account-registration']).toBe('before-connect');
        expect(info.extendedIsupport).toBe(false);
        expect(info.capsComplete).toBe(true);
        expect(transport.writeLine).toHaveBeenCalledTimes(1);
        expect(transport.writeLine).toHaveBeenCalledWith('CAP LS 302');
        expect(transport.close).toHaveBeenCalled();
    });

    it('accumulates multiline LS responses before resolving', async() => {
        const transport = makeTransport();
        const pending = probeWith(transport);
        transport.emit('line', ':serv CAP * LS * :sasl multi-prefix');
        transport.emit('line', ':serv CAP * LS :server-time');
        const info = await pending;

        expect(info.caps.sasl).toBe('');
        expect(info.caps['multi-prefix']).toBe('');
        expect(info.caps['server-time']).toBe('');
        expect(info.capsComplete).toBe(true);
        expect(transport.writeLine).not.toHaveBeenCalledWith(
            expect.stringContaining('REQ')
        );
    });

    it('requests extended-isupport and reads ISUPPORT after ACK', async() => {
        const transport = makeTransport();
        const pending = probeWith(transport);
        transport.emit('line', ':serv CAP * LS :sasl draft/extended-isupport');
        expect(transport.writeLine).toHaveBeenCalledWith('CAP REQ :draft/extended-isupport');

        transport.emit('line', ':serv CAP nick ACK :draft/extended-isupport');
        expect(transport.writeLine).toHaveBeenCalledWith('ISUPPORT');

        transport.emit('line', ':serv 005 nick CHANTYPES=# PREFIX=(ov)@+ :are supported by this server');
        transport.emit('line', ':serv 005 nick NETWORK=Example DRAFT/ACCOUNTREQUIRED :are supported');
        jest.advanceTimersByTime(1000);
        const info = await pending;

        expect(info.extendedIsupport).toBe(true);
        expect(info.isupport.CHANTYPES).toBe('#');
        expect(info.isupport.PREFIX).toBe('(ov)@+');
        expect(info.isupport.NETWORK).toBe('Example');
        expect(info.isupport['DRAFT/ACCOUNTREQUIRED']).toBe('');
        expect(info.isupport.ARE).toBeUndefined();
        expect(transport.close).toHaveBeenCalled();
    });

    it('does not send ISUPPORT after NAK', async() => {
        const transport = makeTransport();
        const pending = probeWith(transport);
        transport.emit('line', ':serv CAP * LS :draft/extended-isupport');
        transport.emit('line', ':serv CAP nick NAK :draft/extended-isupport');
        const info = await pending;

        expect(info.extendedIsupport).toBe(true);
        expect(info.isupport).toEqual({});
        expect(transport.writeLine).not.toHaveBeenCalledWith('ISUPPORT');
    });

    it('resolves with nothing on a silent server after the timeout', async() => {
        const transport = makeTransport();
        const pending = probeWith(transport, { port: 6668 });
        jest.advanceTimersByTime(8000);
        const info = await pending;

        expect(info.caps).toEqual({});
        expect(info.isupport).toEqual({});
        expect(info.capsComplete).toBe(false);
        expect(transport.close).toHaveBeenCalled();
    });

    it('resolves partial results when the connection closes early', async() => {
        const transport = makeTransport();
        const pending = probeWith(transport, { port: 6669 });
        transport.emit('line', ':serv CAP * LS * :sasl');
        transport.emit('close');
        const info = await pending;

        expect(info.caps.sasl).toBe('');
        expect(info.capsComplete).toBe(false);
    });

    it('reports an incomplete probe when the transport cannot be created', async() => {
        const info = await probeServerCaps({
            createTransport: () => {
                throw new Error('no transport');
            },
            transportOptions: { direct: false, host: 'irc.example.net', port: 6671 },
        });

        expect(info.caps).toEqual({});
        expect(info.capsComplete).toBe(false);
    });

    it('caches results for the session', async() => {
        const first = makeTransport();
        const factory = jest.fn(() => first);
        const options = {
            createTransport: factory,
            transportOptions: { direct: false, host: 'irc.example.net', port: 6670 },
        };
        const firstPending = probeServerCaps(options);
        first.emit('line', ':serv CAP * LS :sasl');
        const firstInfo = await firstPending;

        const secondInfo = await probeServerCaps(options);
        expect(factory).toHaveBeenCalledTimes(1);
        expect(secondInfo).toEqual(firstInfo);
    });

    it('does not cache a probe that never completed CAP LS', async() => {
        const first = makeTransport();
        const factory = jest.fn(() => first);
        const options = {
            createTransport: factory,
            transportOptions: { direct: false, host: 'irc.example.net', port: 6672 },
        };

        const firstPending = probeServerCaps(options);
        jest.advanceTimersByTime(8000);
        const firstInfo = await firstPending;
        expect(firstInfo.capsComplete).toBe(false);

        const second = makeTransport();
        factory.mockReturnValue(second);
        const secondPending = probeServerCaps(options);
        second.emit('line', ':serv CAP * LS :sasl');
        const secondInfo = await secondPending;

        expect(factory).toHaveBeenCalledTimes(2);
        expect(secondInfo.capsComplete).toBe(true);
        expect(secondInfo.caps.sasl).toBe('');
    });
});
