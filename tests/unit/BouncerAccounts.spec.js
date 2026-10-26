import state from '@/libs/state';

describe('bouncer feature planes', () => {
    let s;
    let controller;
    let bound;
    let direct;

    beforeEach(() => {
        s = state.create();

        controller = s.addNetwork('BNC', 'TestNick', {});
        controller.is_bnc = true;
        controller.state = 'connected';
        controller.connection.account = 'bouncer-account';
        controller.password = 'bouncer-secret';
        controller.enabled_caps = ['draft/persistence', 'draft/webpush'];
        controller.advertised_caps = ['draft/persistence', 'draft/webpush'];
        controller.isupport = {
            'VAPID': 'key',
            'SOJU.IM/FILEHOST': 'https://bouncer.example/upload',
        };
        controller.persistence_status = { client: 'ON', effective: 'ON' };

        bound = s.addNetwork('Libera', 'TestNick', {
            bncnetid: '2',
            account: 'upstream-account',
        });
        bound.state = 'connected';
        bound.advertised_caps = [
            'draft/persistence',
            'draft/webpush',
            'draft/account-registration',
            'draft/bouncer-networks',
        ];
        bound.isupport = {
            'NETWORK': 'Libera.Chat',
            'DRAFT/FILEHOST': 'https://upstream.example/upload',
        };
        bound.enabled_caps = [
            'draft/persistence',
            'draft/webpush',
            'draft/account-registration',
            'draft/chathistory',
        ];
        bound.cap_values['draft/account-registration'] = '';

        direct = s.addNetwork('Direct', 'TestNick', {});
        direct.state = 'connected';
        direct.sasl_account = 'direct-account';
        direct.password = 'direct-secret';
        direct.enabled_caps = ['draft/persistence', 'draft/chathistory'];
    });

    it('recognises the controller, bound and direct connections', () => {
        expect(controller.isBouncerConnection()).toBe(true);
        expect(controller.isBouncerController()).toBe(true);
        expect(bound.isBouncerConnection()).toBe(true);
        expect(bound.isBouncerController()).toBe(false);
        expect(direct.isBouncerConnection()).toBe(false);
        expect(direct.isBouncerController()).toBe(false);
    });

    it('tracks the current account from SASL and explicit reports', () => {
        expect(direct.currentAccount()).toBe('direct-account');
        expect(bound.currentAccount()).toBe('');
        expect(controller.currentAccount()).toBe('');

        bound.sasl_account = 'USER/NETWORK@CLIENT';
        expect(bound.currentAccount()).toBe('USER');

        bound.setCurrentAccount('explicit/NETWORK@CLIENT');
        expect(bound.currentAccount()).toBe('explicit');

        bound.setCurrentAccount('*');
        expect(bound.currentAccount()).toBe('');

        bound.setCurrentAccount('explicit');
        bound.resetCurrentAccount();
        expect(bound.currentAccount()).toBe('USER');

        controller.sasl_account = 'bouncer-account';
        expect(controller.currentAccount()).toBe('bouncer-account');
    });

    it('offers persistence on every network that negotiated it', () => {
        controller.sasl_account = 'bouncer-account';
        bound.sasl_account = 'bouncer-account';
        expect(controller.persistencePreferenceAvailable()).toBe(true);
        expect(bound.persistencePreferenceAvailable()).toBe(true);
        expect(direct.persistencePreferenceAvailable()).toBe(true);
    });

    it('offers webpush on the controller and a bound network', () => {
        controller.sasl_account = 'bouncer-account';
        controller.setting('show_notifications', true);
        bound.sasl_account = 'bouncer-account';
        bound.setting('show_notifications', true);
        bound.isupport.VAPID = 'bound-key';
        bound.persistence_status = { client: 'ON', effective: 'ON' };

        expect(controller.webpushAvailable()).toBe(true);
        expect(bound.webpushAvailable()).toBe(true);
    });

    it('does not borrow the controller VAPID for a bound network', () => {
        bound.sasl_account = 'bouncer-account';
        bound.setting('show_notifications', true);
        bound.persistence_status = { client: 'ON', effective: 'ON' };

        expect(bound.webpushVapidKey()).toBe('');
        expect(bound.webpushAvailable()).toBe(false);
    });

    it('offers upstream webpush on a bound network', () => {
        bound.sasl_account = 'bouncer-account';
        bound.setting('show_notifications', true);
        bound.advertised_caps = bound.advertised_caps.filter((cap) => (
            cap !== 'draft/webpush'
        ));
        bound.isupport.VAPID = 'upstream-key';
        bound.persistence_status = { client: 'ON', effective: 'ON' };

        expect(bound.webpushAvailable()).toBe(true);
    });

    it('offers account registration on a bound network', () => {
        expect(bound.accountRegistration()).toEqual({
            beforeConnect: false,
            customAccountName: false,
            emailRequired: false,
            minPasswordLength: 0,
            maxPasswordLength: 0,
        });
    });

    it('detects Soju by its version string', () => {
        expect(controller.isSoju()).toBe(false);

        controller.ircd = 'soju';
        expect(controller.isSoju()).toBe(true);

        controller.ircd = 'soju-0.8.2';
        expect(controller.isSoju()).toBe(true);

        controller.ircd = 'Ergo-2.14.0';
        expect(controller.isSoju()).toBe(false);
    });

    it('builds the BouncerServ command that stores SASL credentials', () => {
        controller.ircd = 'soju-0.8.2';
        bound.password = 'sasl-secret';

        expect(bound.bouncerSaslCommand()).toBe(
            'sasl set-plain -network Libera upstream-account sasl-secret'
        );
    });

    it('falls back to the nickname for the SASL account', () => {
        controller.ircd = 'soju';
        bound.connection.account = '';
        bound.password = 'sasl-secret';

        expect(bound.bouncerSaslCommand()).toBe(
            'sasl set-plain -network Libera TestNick sasl-secret'
        );
    });

    it('does not build a SASL command without a Soju bouncer', () => {
        bound.password = 'sasl-secret';

        expect(bound.bouncerSaslCommand()).toBe('');
        expect(bound.bouncerSaslManual()).toBe(true);
    });

    it('only builds a SASL command once the bouncer knows the network', () => {
        controller.ircd = 'soju';

        let added = s.addNetwork('NewNet', 'nick', { account: 'account' });
        added.password = 'sasl-secret';

        expect(added.bouncerSaslCommand()).toBe('');

        added.connection.bncnetid = '3';
        expect(added.bouncerSaslCommand()).toBe(
            'sasl set-plain -network NewNet account sasl-secret'
        );
    });

    it('skips networks that lack a password, a safe name, or are the controller', () => {
        controller.ircd = 'soju';

        bound.password = '';
        expect(bound.bouncerSaslCommand()).toBe('');

        bound.password = 'sasl-secret';
        bound.name = 'Has Space';
        expect(bound.bouncerSaslCommand()).toBe('');

        bound.name = 'Libera';
        expect(controller.bouncerSaslCommand()).toBe('');
    });

    it('marks credentials a non-Soju bouncer must be told about by hand', () => {
        bound.password = 'sasl-secret';
        expect(bound.bouncerSaslManual()).toBe(true);

        bound.connection.account = '';
        expect(bound.bouncerSaslManual()).toBe(true);

        bound.password = '';
        expect(bound.bouncerSaslManual()).toBe(false);

        bound.password = 'sasl-secret';
        controller.ircd = 'soju';
        expect(bound.bouncerSaslManual()).toBe(false);
    });
});
