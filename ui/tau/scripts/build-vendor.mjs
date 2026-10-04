// Rebuilds the vendored browser bundles in static/js/vendor from the installed (current) npm packages,
// and refreshes KaTeX CSS + fonts.
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const vendor = resolve(root, 'static/js/vendor');

async function bundle(entry, outfile, format = 'esm') {
  const result = await Bun.build({ entrypoints: [resolve(root, 'scripts', entry)], target: 'browser', format, minify: true });
  if (!result.success) { console.error(result.logs); process.exit(1); }
  writeFileSync(resolve(vendor, outfile), await result.outputs[0].text());
}

await bundle('preact-htm-entry.js', 'preact-htm.js');
await bundle('codemirror-entry.ts', 'codemirror.js');
await bundle('beautiful-mermaid-entry.js', 'beautiful-mermaid.js', 'iife');

const katex = resolve(root, 'node_modules/katex/dist');
copyFileSync(resolve(katex, 'katex.min.js'), resolve(vendor, 'katex.min.js'));
writeFileSync(resolve(root, 'static/css/katex.min.css'),
  readFileSync(resolve(katex, 'katex.min.css'), 'utf8').replaceAll('url(fonts/', 'url(/static/fonts/'));
for (const font of readdirSync(resolve(katex, 'fonts'))) {
  if (font.endsWith('.woff2')) copyFileSync(resolve(katex, 'fonts', font), resolve(root, 'static/fonts', font));
}
console.log('vendor bundles rebuilt');
