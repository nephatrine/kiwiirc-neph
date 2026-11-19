import Vue from 'vue';
import SelfUser from '@/components/SelfUser';

describe('SelfUser away message', () => {
    function build(status) {
        const raw = jest.fn();
        const user = {
            away: false,
            modes: [],
            metadata: typeof status === 'undefined' ? {} : { status },
        };
        const network = {
            nick: 'TestNick',
            ircClient: { raw },
            currentUser: () => user,
        };
        const Ctor = Vue.extend(SelfUser);
        const comp = new Ctor({ propsData: { network } });
        comp.$t = (key) => key;
        return { comp, raw };
    }

    it('sends the status metadata message or the localised default', () => {
        let { comp, raw } = build('Out to lunch');
        comp.awayStatus = true;
        expect(raw).toHaveBeenCalledWith('AWAY', 'Out to lunch');

        ({ comp, raw } = build(''));
        comp.awayStatus = true;
        expect(raw).toHaveBeenCalledWith('AWAY', 'default_away_message');

        ({ comp, raw } = build(undefined));
        delete comp.network.currentUser().metadata;
        comp.awayStatus = true;
        expect(raw).toHaveBeenCalledWith('AWAY', 'default_away_message');
    });

    it('sends an empty away message when unchecking', () => {
        const { comp, raw } = build('Out to lunch');
        comp.awayStatus = false;
        expect(raw).toHaveBeenCalledWith('AWAY', '');
    });
});
