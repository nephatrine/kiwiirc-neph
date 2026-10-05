import * as IrcdDiffs from '@/helpers/IrcdDiffs';

describe('IrcdDiffs.js', () => {
    describe('extbanAccount', () => {
        it('should support ACCOUNTEXTBAN token', () => {
            const network = {
                ircd: '',
                supports: (name) => (name === 'ACCOUNTEXTBAN' ? '$,a' : ''),
            };
            expect(IrcdDiffs.extbanAccount(network)).toBe('$a');
        });

        it('should fallback to InspIRCd R type', () => {
            const network = {
                ircd: 'InspIRCd-2.0',
                supports: (name) => (name === 'EXTBAN' ? '~,qjncrRa' : ''),
            };
            expect(IrcdDiffs.extbanAccount(network)).toBe('~R');
        });

        it('should fallback to default a type', () => {
            const network = {
                ircd: 'UnrealIRCd-4.0',
                supports: (name) => (name === 'EXTBAN' ? '~,qjncrRa' : ''),
            };
            expect(IrcdDiffs.extbanAccount(network)).toBe('~a');
        });

        it('should return empty string if no extban support', () => {
            const network = {
                ircd: 'generic',
                supports: () => '',
            };
            expect(IrcdDiffs.extbanAccount(network)).toBe('');
        });
    });
});
