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
    it('routes service aliases and topic commands', () => {
        const rewriter = makeRewriter();
        expect(rewriter.process('/ns register hunter2', vars))
            .toBe('/msg NickServ register hunter2');
        expect(rewriter.process('/cs register #chan', vars))
            .toBe('/msg ChanServ register #chan');
        expect(rewriter.process('/hs request myhost', vars))
            .toBe('/msg HostServ request myhost');
        expect(rewriter.process('/ms TestNick hello', vars))
            .toBe('/msg MemoServ TestNick hello');
        expect(rewriter.process('/t a brand new topic', vars))
            .toBe('/topic #chan a brand new topic');
        expect(rewriter.process('/t', vars)).toBe('/topic #chan');
    });

    it('leaves removed aliases alone and keeps existing shorthand', () => {
        const rewriter = makeRewriter();
        expect(rewriter.process('/connect irc.example.com', vars))
            .toBe('/connect irc.example.com');
        expect(rewriter.process('/j #chan', vars)).toBe('/join #chan');
        expect(rewriter.process('/q TestNick', vars)).toBe('/query TestNick');
    });
});
