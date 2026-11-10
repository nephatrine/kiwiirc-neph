import fs from 'fs';
import path from 'path';

const PLUGIN_DIR = path.join(__dirname, '../../static/plugins');

const extracted = [
    { name: 'bongo-cat', css: true },
    { name: 'radio', css: true },
    { name: 'nephwave-desktop', css: false },
    { name: 'nephnet-cyberdeck', css: false },
    { name: 'suggest-limnoria', css: false },
];

describe('Extracted plugin assets', () => {
    extracted.forEach((plugin) => {
        it(`loads ${plugin.name} from external assets`, () => {
            const html = fs.readFileSync(
                path.join(PLUGIN_DIR, `${plugin.name}.html`),
                'utf8'
            );
            const scriptMatch = html.match(/<script src="([^"]+)"><\/script>/);

            expect(scriptMatch).not.toBeNull();
            const scriptPath = path.join(PLUGIN_DIR, scriptMatch[1]);
            expect(fs.existsSync(scriptPath)).toBe(true);
            expect(fs.statSync(scriptPath).size).toBeGreaterThan(0);

            if (plugin.css) {
                const linkMatch = html.match(
                    /<link rel="stylesheet" href="([^"]+)">/
                );
                expect(linkMatch).not.toBeNull();
                const cssPath = path.join(PLUGIN_DIR, linkMatch[1]);
                expect(fs.existsSync(cssPath)).toBe(true);
                expect(fs.statSync(cssPath).size).toBeGreaterThan(0);
            }
        });
    });
});
