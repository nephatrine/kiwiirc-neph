import * as IrcdDiffs from '@/helpers/IrcdDiffs';

describe('IrcdDiffs.js', () => {
    describe('extbanAccount', () => {
        it('should resolve the account extban for each ircd dialect', () => {
            expect(IrcdDiffs.extbanAccount({
                ircd: '',
                supports: (name) => (name === 'ACCOUNTEXTBAN' ? '$,a' : ''),
            })).toBe('$a');

            expect(IrcdDiffs.extbanAccount({
                ircd: 'InspIRCd-2.0',
                supports: (name) => (name === 'EXTBAN' ? '~,qjncrRa' : ''),
            })).toBe('~R');

            expect(IrcdDiffs.extbanAccount({
                ircd: 'UnrealIRCd-4.0',
                supports: (name) => (name === 'EXTBAN' ? '~,qjncrRa' : ''),
            })).toBe('~a');

            expect(IrcdDiffs.extbanAccount({
                ircd: 'generic',
                supports: () => '',
            })).toBe('');
        });
    });
});
