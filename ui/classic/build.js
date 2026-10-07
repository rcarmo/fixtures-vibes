import { resolve, dirname } from 'path';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, rmSync, copyFileSync, cpSync } from 'fs';
import { fileURLToPath } from 'url';
import { patchPinnedStatusResize } from './scripts/patch-pinned-status-resize.mjs';
import { patchComposeHost } from './scripts/patch-compose-host.mjs';
import { patchSseConnection } from './scripts/patch-sse-connection.mjs';
import {piclawPlanSidebarAdapter} from './scripts/piclaw-plan-sidebar-adapter.mjs';
import {patchWidgetSandbox, patchWidgetMessageSource} from './scripts/patch-widget-isolation.mjs';
import { patchMarkdownCode } from './scripts/gi-markdown-code-adapter.mjs';
import { patchTimelineMenu } from './scripts/patch-timeline-menu.mjs';
import { patchQuickActionKeys } from './scripts/patch-popup-keys.mjs';
import { patch, piclawWebDir, piclawWebAdapter, verifyPiclawWeb } from './scripts/piclaw-web.mjs';

import { readdirSync, statSync } from 'fs';
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PICLAW_WEB = piclawWebDir(__dirname);
// Source maps are opt-in (GI_SOURCEMAPS=1): they are ~10 MB and would be
// embedded in the binary. See issue #10.
const SOURCEMAPS = process.env.GI_SOURCEMAPS === '1';
process.chdir(__dirname);

const webSrc = 'src';
const distDir = 'static/dist';
const vendorDir = 'static/js/vendor';
const jsDir = 'static/js';
const editorVendorDir = 'static/editor-vendor';

mkdirSync(distDir, { recursive: true });
mkdirSync(vendorDir, { recursive: true });
mkdirSync(jsDir, { recursive: true });
mkdirSync(editorVendorDir, { recursive: true });

function run(cmd) {
  const proc = Bun.spawnSync(cmd, { stdout: 'inherit', stderr: 'inherit' });
  if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1);
}

function move(src, dst) {
  if (existsSync(dst)) rmSync(dst);
  if (existsSync(src)) renameSync(src, dst);
}

// Build a vendor entry. Leaves a copy in src/vendor/<outputName> for
// app.ts import resolution, then moves the canonical output to static/.
function buildVendor(entryFile, finalDir, finalName) {
  const entry = `${webSrc}/vendor/${entryFile}`;
  const base = entryFile.replace(/\.ts$/, '');
  const srcJs = `${webSrc}/vendor/${base}.js`;
  run(['bun', 'build', entry, '--target=browser', '--format=esm', '--minify', `--outfile=${srcJs}`, ...(SOURCEMAPS ? ['--sourcemap=linked'] : [])]);
  const srcMap = `${webSrc}/vendor/${base}.js.map`;
  // Leave a copy at the exact path components expect (e.g. preact-htm.js)
  const vendorAlias = `${webSrc}/vendor/${finalName}`;
  if (existsSync(srcJs) && vendorAlias !== srcJs) {
    copyFileSync(srcJs, vendorAlias);
  }
  // Move canonical build output to static/
  move(srcJs, `${finalDir}/${finalName}`);
  if (SOURCEMAPS) move(srcMap, `${finalDir}/${finalName}.map`);
  else for (const stale of [srcMap, `${finalDir}/${finalName}.map`]) if (existsSync(stale)) rmSync(stale);
}

// ── Vendor bundles ────────────────────────────────────────────────────────
buildVendor('preact-htm-entry.ts', vendorDir, 'preact-htm.js');
buildVendor('marked-entry.ts',     jsDir,      'marked.min.js');
buildVendor('katex-entry.ts',      vendorDir,  'katex.min.js');
// Keep the renderer CSS/fonts on the same version as its JavaScript bundle.
mkdirSync('static/fonts/katex', { recursive: true });
// Only the woff2 faces ship: every supported browser loads woff2, and the
// woff/ttf fallbacks would add ~0.9 MB to the binary.
rmSync('static/fonts/katex', { recursive: true, force: true });
mkdirSync('static/fonts/katex', { recursive: true });
for (const font of readdirSync('node_modules/katex/dist/fonts')) {
  if (font.endsWith('.woff2')) copyFileSync(`node_modules/katex/dist/fonts/${font}`, `static/fonts/katex/${font}`);
}
copyFileSync('node_modules/katex/LICENSE', 'static/fonts/katex/LICENSE');
const katexCSS = readFileSync('node_modules/katex/dist/katex.min.css', 'utf8')
  .replace(/,url\(fonts\/[^)]+\.woff\) format\("woff"\)/g, '')
  .replace(/,url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g, '');
writeFileSync('static/css/katex.min.css', katexCSS.replaceAll('url(fonts/', 'url(/fonts/katex/'));
buildVendor('mermaid-entry.ts',    vendorDir,  'beautiful-mermaid.js');
// CodeMirror for the Piclaw editor and the other editor surfaces: the vendored 3.2.5 entry (a superset of the
// exports src/vendor/codemirror-entry.ts provided).
verifyPiclawWeb(__dirname);
run(['bun', 'build', `${PICLAW_WEB}/extensions/viewers/editor/vendor/codemirror-entry.ts`, '--target=browser', '--format=esm', '--minify',
  `--outfile=${editorVendorDir}/codemirror.js`, ...(SOURCEMAPS ? ['--sourcemap=linked'] : [])]);

// ── Editor bundle (Piclaw 3.2.5 StandaloneEditorInstance, loaded on first editor mount) ─────────────────────
const editorBuild = await Bun.build({
  entrypoints: [`${PICLAW_WEB}/extensions/viewers/editor/editor-extension.ts`], outdir: distDir,
  target: 'browser', format: 'esm', minify: true, sourcemap: SOURCEMAPS ? 'linked' : 'none',
  naming: { entry: 'editor.bundle.[ext]' },
  plugins: [piclawWebAdapter(__dirname)],
});
if (!editorBuild.success) { console.error(editorBuild.logs); process.exit(1); }

// ── App bundle ────────────────────────────────────────────────────────────
const appBuild = await Bun.build({
  entrypoints: [`${webSrc}/gi-bootstrap.ts`], outdir: distDir,
  target: 'browser', format: 'esm', sourcemap: SOURCEMAPS ? 'linked' : 'none', splitting: true, modulePreload: false,
  naming: { entry: 'app.bundle.[ext]', chunk: 'chunks/[name]-[hash].[ext]', asset: 'assets/[name]-[hash].[ext]' },
  external: ['/editor-vendor/codemirror.js'],
  plugins: [piclawPlanSidebarAdapter(), piclawWebAdapter(__dirname), { name: 'gi-widget-isolation', setup(build) {
    build.onLoad({ filter: /[\\/]ui[\\/]use-sse-connection\.ts$/ }, async args => ({ contents: patchSseConnection(await Bun.file(args.path).text()), loader: 'ts' }));
    build.onLoad({ filter: /[\\/]components[\\/]status\.ts$/ }, async args => ({ contents: patchPinnedStatusResize(await Bun.file(args.path).text()), loader: 'ts' }));
    build.onLoad({ filter: /[\\/]ui[\\/]generated-widget\.ts$/ }, async args => ({ contents: patchWidgetSandbox(await Bun.file(args.path).text()), loader: 'ts' }));
    build.onLoad({ filter: /[\\/]components[\\/]floating-widget-pane\.ts$/ }, async args => ({ contents: patchWidgetMessageSource(await Bun.file(args.path).text()), loader: 'ts' }));
  } }, { name: 'gi-markdown', setup(build) {
    build.onLoad({filter:/[\\/]src[\\/]markdown\.ts$/},async args=>({contents:patchMarkdownCode(await Bun.file(args.path).text()),loader:'ts'}));
  } }, { name: 'gi-popup-key-ownership', setup(build) {
    build.onLoad({ filter: /[\\/]components[\\/]compose-box\.ts$/ }, async args => ({ contents: patchComposeHost(await Bun.file(args.path).text()), loader: 'ts' }));
    build.onLoad({ filter: /[\\/]components[\\/]timeline-quick-actions\.ts$/ }, async args => ({
      contents: patchQuickActionKeys(await Bun.file(args.path).text()), loader: 'ts',
    }));
  } }, { name: 'gi-timeline-menu-dismissal', setup(build) {
    build.onLoad({ filter: /[\\/]components[\\/]timeline-menu\.ts$/ }, async args => ({
      contents: patchTimelineMenu(await Bun.file(args.path).text()), loader: 'ts',
    }));
  } }, { name: 'gi-appearance-renderer', setup(build) {
    // Gi's appearance pane (src/gi-appearance.ts) needs the preset table and the non-persisting apply.
    build.onLoad({ filter: /[\\/]ui[\\/]theme\.ts$/ }, async args => ({
      contents: (await Bun.file(args.path).text()) + '\nexport { THEME_PRESETS as giThemePresets, applyThemeState as giApplyThemeState };\n',
      loader: 'ts',
    }));
  } }, { name: 'gi-clipboard-safety', setup(build) {
    build.onResolve({filter: /^\.\/post-runtime-safety\.js$/}, args => {
      if (args.importer === resolve(webSrc, 'components/post.ts')) {
        return { path: resolve(webSrc, 'gi-clipboard-safety.ts') };
      }
    });
  } }],
});
if (!appBuild.success) { console.error(appBuild.logs); process.exit(1); }
// Retain only this build's hashed chunks. Old open clients receive a pane-load
// error after deployment rather than executing a mismatched module.
const outputPaths = new Set(appBuild.outputs.map(output => resolve(output.path)));
for (const entry of new Bun.Glob('chunks/**/*').scanSync({ cwd: distDir, onlyFiles: true })) {
  const path = resolve(distDir, entry);
  if (!outputPaths.has(path)) rmSync(path);
}

// No post-processing needed — vendor scripts are loaded as modules.

// Now clean up preact-htm alias
const phtmAlias = `${webSrc}/vendor/preact-htm.js`;
if (existsSync(phtmAlias)) rmSync(phtmAlias);

// Clean up vendor alias copies EXCEPT preact-htm.js (kept for app externals resolution)
['marked.min.js', 'katex.min.js', 'beautiful-mermaid.js', 'codemirror.js'].forEach((f) => {
  const p = `${webSrc}/vendor/${f}`;
  if (existsSync(p)) rmSync(p);
});


// Piclaw's standalone viewer pages (tab-mode web/data viewers), extracted from its v3.3.0 server routes
// (scripts/extract-piclaw-viewers.ts): runtimes serve static/<viewer>/index.html at /<viewer>/ with piclaw/viewers-3.3.0/csp.json.
for (const viewer of ['html-viewer', 'image-viewer', 'video-viewer', 'pdf-viewer', 'data-viewer']) {
  mkdirSync(`static/${viewer}`, { recursive: true });
  copyFileSync(`piclaw/viewers-3.3.0/${viewer}/index.html`, `static/${viewer}/index.html`);
}

// Theme catalogue for the server-side /theme and /tint commands, from Piclaw's shared preset catalogue.
{
  const { WEB_THEME_PRESETS } = await import(resolve(__dirname, PICLAW_WEB, 'src/core/ui-theme-catalogue.ts'));
  const keys = ['bgPrimary', 'bgSecondary', 'textPrimary', 'textSecondary', 'borderColor', 'accent', 'danger', 'success'];
  const pick = palette => palette && Object.fromEntries(keys.filter(k => typeof palette[k] === 'string').map(k => [k, palette[k]]));
  const catalogue = WEB_THEME_PRESETS.map(p => ({ name: p.id, label: p.label, mode: p.mode, light: pick(p.light), dark: pick(p.dark) }));
  writeFileSync(resolve(__dirname, 'theme-catalogue.json'), JSON.stringify(catalogue, null, 1) + '\n');
}

// ── CSS bundle ────────────────────────────────────────────────────────────
// Piclaw's Classic stylesheet (web/src/styles/app.css and its imports) → /dist/app.bundle.css, as Piclaw serves it.
// Classic serves KaTeX's own stylesheet (/css/katex.min.css, matching the npm KaTeX it bundles), so the vendored
// KaTeX copy, whose fonts live under Piclaw's /static/common/fonts, is left out. Gi's stylesheets load after it.
const cssBuild = await Bun.build({
  entrypoints: [`${PICLAW_WEB}/web/src/styles/app.css`], outdir: distDir, minify: true,
  naming: { entry: 'app.bundle.[ext]', asset: 'assets/[name]-[hash].[ext]' },
  plugins: [{ name: 'piclaw-css', setup(build) {
    build.onLoad({ filter: /[\\/]web[\\/]src[\\/]styles[\\/]app\.css$/ }, async args => ({
      contents: patch(await Bun.file(args.path).text(), 'app.css', [['@import "./katex.bundle.css";\n', '']]), loader: 'css',
    }));
  } }],
});
if (!cssBuild.success) { for (const log of cssBuild.logs) console.error(log); process.exit(1); }

// ── Static asset post-processing (issue #10) ──────────────────────────────
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out); else out.push(path);
  }
  return out;
}
const staticRoot = 'static';
if (!SOURCEMAPS) for (const f of walk(staticRoot)) if (f.endsWith('.map')) rmSync(f);

// Pre-compress text assets: deterministic .br/.gz siblings, kept only when
// they save at least 10%. The server serves them with Content-Encoding.
// index.html is templated per request and is never pre-compressed.
const compressible = /\.(js|mjs|css|svg|json|txt|webmanifest|map|xml|html)$/;
let variants = 0, rawBytes = 0, brBytes = 0;
for (const f of walk(staticRoot)) {
  if (f.endsWith('.gz') || f.endsWith('.br')) {
    const source = f.slice(0, -3);
    if (!existsSync(source)) rmSync(f); // stale variant
    continue;
  }
  const eligible = compressible.test(f) && f !== `${staticRoot}/index.html` && statSync(f).size >= 1024;
  const data = eligible ? readFileSync(f) : null;
  for (const [suffix, encode] of [['.br', d => brotliCompressSync(d, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11, [zlibConstants.BROTLI_PARAM_SIZE_HINT]: d.length } })], ['.gz', d => gzipSync(d, { level: 9 })]]) {
    const target = f + suffix;
    const encoded = data ? encode(data) : null;
    if (encoded && encoded.length <= data.length * 0.9) {
      if (!existsSync(target) || !readFileSync(target).equals(encoded)) writeFileSync(target, encoded);
      variants++;
      if (suffix === '.br') { rawBytes += data.length; brBytes += encoded.length; }
    } else if (existsSync(target)) rmSync(target);
  }
}
console.log(`Pre-compressed ${variants} variants (${(rawBytes / 1e6).toFixed(1)} MB → ${(brBytes / 1e6).toFixed(1)} MB brotli).`);

console.log('Gi web build complete.');
