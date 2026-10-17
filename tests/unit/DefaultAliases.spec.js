import { configTemplates } from '@/res/configTemplates';
import AliasRewriter from '@/libs/AliasRewriter';

function makeRewriter() {
    const rewriter = new AliasRewriter();
    rewriter.importFromString(configTemplates.default.aliases);
    return rewriter;
}

const vars = {
    channel: '#chan',
    destination: '#chan',
    nick: 'TestNick',
};

describe('default aliases', () => {
    it('routes /ns to NickServ', () => {
        const out = makeRewriter().process('/ns register hunter2', vars);
        expect(out).toBe('/msg NickServ register hunter2');
    });

    it('routes /cs to ChanServ', () => {
        const out = makeRewriter().process('/cs register #chan', vars);
        expect(out).toBe('/msg ChanServ register #chan');
    });

    it('routes /hs to HostServ', () => {
        const out = makeRewriter().process('/hs request myhost', vars);
        expect(out).toBe('/msg HostServ request myhost');
    });

    it('routes /ms to MemoServ', () => {
        const out = makeRewriter().process('/ms TestNick hello', vars);
        expect(out).toBe('/msg MemoServ TestNick hello');
    });

    it('sets the topic with /t and text', () => {
        const out = makeRewriter().process('/t a brand new topic', vars);
        expect(out).toBe('/topic #chan a brand new topic');
    });

    it('reads the topic with a bare /t', () => {
        const out = makeRewriter().process('/t', vars);
        expect(out).toBe('/topic #chan');
    });

    it('leaves the removed /connect alias unrewritten', () => {
        const out = makeRewriter().process('/connect irc.example.com', vars);
        expect(out).toBe('/connect irc.example.com');
    });

    it('keeps existing shorthand working', () => {
        const rewriter = makeRewriter();
        expect(rewriter.process('/j #chan', vars)).toBe('/join #chan');
        expect(rewriter.process('/q TestNick', vars)).toBe('/query TestNick');
    });
});
