import state from '@/libs/state';
import { getAvatarTransform } from '@/components/UserAvatarCommon';

describe('avatar away status transform', () => {
    let s;

    beforeAll(() => {
        s = state.recreate();
    });

    afterAll(() => {
        s.$destroy();
    });

    it('defaults to the bottom-right corner', () => {
        expect(s.setting('avatars.away_status_position')).toBe(2);
        expect(getAvatarTransform()).toBe('rotate(135 50 50)');
    });

    it('uses the configured corner', () => {
        s.setting('avatars.away_status_position', 1);

        expect(getAvatarTransform()).toBe('rotate(45 50 50)');

        s.setting('avatars.away_status_position', 4);

        expect(getAvatarTransform()).toBe('rotate(315 50 50)');
    });
});
