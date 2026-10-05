import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { VIEWERS, extractViewer } from '../../scripts/extract-piclaw-viewers';

test('a viewer page is the generator literal, as the generator returns it, with its CSP', () => {
    const source = 'const VIEWER_CSP = [\n  "default-src \'self\'",\n  "img-src \'self\' data:",\n].join("; ");\n'
        + 'function generateXViewerPage(): string {\n  return `\n<p>a\\`b \\\\d</p>`;\n}\n';
    expect(extractViewer(source, 'x')).toEqual({ page: '<p>a`b \\d</p>', csp: "default-src 'self'; img-src 'self' data:" });
    expect(() => extractViewer(source.replace('<p>', '<p>${x}'), 'x')).toThrow('interpolates');
    expect(() => extractViewer(source.replace('generateXViewerPage', 'other'), 'x')).toThrow('no generate');
});

test('the build serves every extracted viewer page unchanged, each with a CSP', () => {
    const csp = JSON.parse(readFileSync('piclaw/viewers-3.2.5/csp.json', 'utf8'));
    for (const viewer of VIEWERS) {
        expect(readFileSync(`static/${viewer}/index.html`, 'utf8')).toBe(readFileSync(`piclaw/viewers-3.2.5/${viewer}/index.html`, 'utf8'));
        expect(csp[`/${viewer}/`]).toContain("frame-ancestors 'self'");
    }
});
