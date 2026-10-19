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
        bound.bouncer_isupport = {
            'DRAFT/ACCOUNTREQUIRED': '',
            'SOJU.IM/FILEHOST': 'https://bouncer.example/upload',
        };
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

    it('treats the pre-bind CAP LS as the bouncer advert', () => {
        expect(bound.bouncerHasCap('draft/webpush')).toBe(true);
        expect(bound.bouncerHasCap('DRAFT/PERSISTENCE')).toBe(true);
        expect(bound.bouncerHasCap('draft/chathistory')).toBe(false);
        expect(direct.bouncerHasCap('draft/persistence')).toBe(false);
    });

    it('names the plane that advertised each cap', () => {
        expect(bound.capPlane('draft/persistence')).toBe('bouncer');
        expect(bound.capPlane('draft/chathistory')).toBe('upstream');
        expect(bound.capPlane('echo-message')).toBe('none');
        expect(direct.capPlane('draft/persistence')).toBe('upstream');
    });

    it('prefers the pre-bind tokens, then the controller tokens', () => {
        expect(bound.bouncerSupports('DRAFT/ACCOUNTREQUIRED')).toBe('');
        expect(bound.bouncerSupports('VAPID')).toBe('key');
        expect(bound.bouncerSupports('draft/FILEHOST')).toBeUndefined();
        expect(bound.tokenPlane('soju.im/FILEHOST')).toBe('bouncer');
        expect(bound.tokenPlane('draft/FILEHOST')).toBe('upstream');
        expect(bound.tokenPlane('NETWORK')).toBe('upstream');
        expect(bound.tokenPlane('UNKNOWN')).toBe('none');
    });

    it('reads the bouncer account from the controller', () => {
        expect(bound.bouncerAccount()).toBe('bouncer-account');
        expect(bound.bouncerPassword()).toBe('bouncer-secret');
        expect(controller.bouncerAccount()).toBe('bouncer-account');
        expect(direct.bouncerAccount()).toBe('');
        expect(direct.bouncerPassword()).toBe('');
    });

    it('reads the upstream account from the connection', () => {
        expect(direct.upstreamAccount()).toBe('direct-account');
        expect(direct.upstreamPassword()).toBe('direct-secret');
        expect(bound.upstreamAccount()).toBe('');
        bound.sasl_account = 'discovered-account';
        expect(bound.upstreamAccount()).toBe('discovered-account');
        bound.upstream_account = 'configured-account';
        expect(bound.upstreamAccount()).toBe('configured-account');
        expect(controller.upstreamAccount()).toBe('');
    });

    it('offers bouncer persistence only on the controller', () => {
        expect(controller.persistencePreferenceAvailable()).toBe(true);
        expect(bound.persistencePreferenceAvailable()).toBe(false);
        expect(direct.persistencePreferenceAvailable()).toBe(true);
    });

    it('offers bouncer webpush only on the controller', () => {
        s.setting('buffers.show_notifications', true);
        bound.persistence_status = { client: 'ON', effective: 'ON' };
        expect(controller.webpushAvailable()).toBe(true);
        expect(bound.webpushAvailable()).toBe(false);
    });

    it('ignores bouncer account registration on bound networks', () => {
        expect(bound.capPlane('draft/account-registration')).toBe('bouncer');
        expect(bound.accountRegistration()).toBeNull();
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
