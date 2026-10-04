// Rebuilds the vendored browser bundles from the installed (current) npm packages:
// static/js/vendor/preact-htm.js, static/js/vendor/codemirror.js, and KaTeX CSS + fonts.
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const vendor = resolve(root, 'static/js/vendor');

async function bundle(entry, outfile) {
  const result = await Bun.build({ entrypoints: [entry], target: 'browser', format: 'esm', minify: true });
  if (!result.success) { console.error(result.logs); process.exit(1); }
  writeFileSync(outfile, await result.outputs[0].text());
}

await bundle(resolve(root, 'scripts/preact-htm-entry.js'), resolve(vendor, 'preact-htm.js'));
await bundle(resolve(vendor, 'codemirror-entry.ts'), resolve(vendor, 'codemirror.js'));

const katex = resolve(root, 'node_modules/katex/dist');
writeFileSync(resolve(root, 'static/css/katex.min.css'), readFileSync(resolve(katex, 'katex.min.css'), 'utf8').replaceAll('url(fonts/', 'url(/static/fonts/'));
for (const font of readdirSync(resolve(katex, 'fonts'))) {
  if (font.endsWith('.woff2')) copyFileSync(resolve(katex, 'fonts', font), resolve(root, 'static/fonts', font));
}
// Record the package versions the editor bundle was built from.
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const versions = {};
for (const name of Object.keys(pkg.devDependencies).filter(n => /^(@codemirror|@lezer|@replit|@uiw)\//.test(n)).sort()) {
  versions[name] = JSON.parse(readFileSync(resolve(root, 'node_modules', name, 'package.json'), 'utf8')).version;
}
writeFileSync(resolve(vendor, 'codemirror.meta.json'), JSON.stringify({ source_entry: 'static/js/vendor/codemirror-entry.ts', output: 'static/js/vendor/codemirror.js', package_versions: versions }, null, 2) + '\n');
console.log('vendor bundles rebuilt');
