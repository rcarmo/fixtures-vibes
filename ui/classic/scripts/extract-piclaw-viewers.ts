// Extract Piclaw's standalone viewer pages (the tab-mode iframes of the web and data viewers) from its server routes
// into static files, so every runtime serves the same pages from ui/classic/static instead of reimplementing them.
//
//   bun scripts/extract-piclaw-viewers.ts <piclaw-checkout>/runtime/src/channels/web/http
//
// Writes piclaw/viewers-3.2.5/<route>/index.html (the generator's literal page, unmodified), csp.json (each route's
// Content-Security-Policy) and SOURCES (SHA-256 of each route file it read). The generators take no input: a page
// with an interpolation is refused.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const VIEWERS = ['html-viewer', 'image-viewer', 'video-viewer', 'pdf-viewer', 'data-viewer'] as const;
const OUT = resolve(import.meta.dir, '../piclaw/viewers-3.2.5');

/** The page a route's `generate…Page(): string` returns, and its VIEWER_CSP. */
export function extractViewer(source: string, file: string) {
  const fn = source.match(/function generate\w*Page\(\): string \{\s*return `/);
  if (!fn) throw new Error(`${file}: no generate…Page() returning a template literal`);
  const start = fn.index! + fn[0].length;
  let end = start;
  while ((end = source.indexOf('`', end)) !== -1 && source[end - 1] === '\\') end++;
  if (end === -1) throw new Error(`${file}: unterminated page literal`);
  const literal = source.slice(start, end);
  if (literal.includes('${')) throw new Error(`${file}: the page interpolates values; it cannot be served statically`);
  // The literal has no substitutions, so evaluating it yields exactly the string the generator returns.
  const page: string = new Function(`return \`${literal}\`;`)();
  const csp = source.match(/const VIEWER_CSP = \[([\s\S]*?)\]\.join\((['"]); \2\)/);
  if (!csp) throw new Error(`${file}: no VIEWER_CSP`);
  const directives = [...csp[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
  return { page: page.startsWith('\n') ? page.slice(1) : page, csp: directives.join('; ') };
}

if (import.meta.main) {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: bun scripts/extract-piclaw-viewers.ts <piclaw>/runtime/src/channels/web/http');
  const csp: Record<string, string> = {};
  const sums: string[] = [];
  for (const name of VIEWERS) {
    const file = join(dir, `${name}-route.ts`);
    const source = readFileSync(file, 'utf8');
    const viewer = extractViewer(source, file);
    mkdirSync(join(OUT, name), { recursive: true });
    writeFileSync(join(OUT, name, 'index.html'), viewer.page);
    csp[`/${name}/`] = viewer.csp;
    sums.push(`${createHash('sha256').update(source).digest('hex')}  ${name}-route.ts`);
  }
  writeFileSync(join(OUT, 'csp.json'), JSON.stringify(csp, null, 2) + '\n');
  writeFileSync(join(OUT, 'SOURCES'), sums.join('\n') + '\n');
  console.log(`extracted ${VIEWERS.length} viewers to ${OUT}`);
}
