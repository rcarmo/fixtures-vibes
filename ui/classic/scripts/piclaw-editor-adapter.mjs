// Wires the vendored Piclaw 3.2.5 editor (piclaw/editor-3.2.5) into the Classic build without changing its bytes.
// Imports of modules that are not vendored there resolve to src/ (the adapter layer: api.ts, pane-registry, tab-store,
// recent-files, …); `#editor-vendor/codemirror` stays external and loads /editor-vendor/codemirror.js.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

export const EDITOR_DIR = 'piclaw/editor-3.2.5';
const CODEMIRROR = '/editor-vendor/codemirror.js';

/** Fail unless every vendored file matches SHA256SUMS. */
export function verifyPiclawEditor(root) {
  const dir = resolve(root, EDITOR_DIR);
  for (const line of readFileSync(resolve(dir, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
    const [sum, file] = line.split(/\s+/);
    const actual = createHash('sha256').update(readFileSync(resolve(dir, file))).digest('hex');
    if (actual !== sum) throw new Error(`vendored Piclaw editor source changed: ${file} (${actual})`);
  }
}

/** Replace each anchor exactly once; fail the build if an anchor moved. */
function patch(source, file, pairs) {
  for (const [from, to] of pairs) {
    const count = source.split(from).length - 1;
    if (count < 1) throw new Error(`Piclaw editor anchor changed in ${file}: ${from}`);
    source = source.replaceAll(from, to);
  }
  return source;
}

// The Classic tree is served at / (ui/API.md), not at Piclaw's /static/classic/.
export const patchEditorLoader = source => patch(source, 'editor-loader.ts', [
  ['/static/classic/dist/editor.bundle.js', '/dist/editor.bundle.js'],
]);

export function piclawEditorAdapter(root) {
  const vendored = resolve(root, EDITOR_DIR);
  const webSrc = resolve(vendored, 'web/src');
  const src = resolve(root, 'src');
  return { name: 'piclaw-editor-3.2.5', setup(build) {
    build.onResolve({ filter: /^#editor-vendor\/codemirror$/ }, () => ({ path: CODEMIRROR, external: true }));
    build.onResolve({ filter: /^\.\.?\// }, args => {
      if (!args.importer.startsWith(vendored + sep)) return undefined;
      const target = resolve(dirname(args.importer), args.path);
      const ts = target.replace(/\.js$/, '.ts');
      if (existsSync(ts) || existsSync(target)) return undefined;
      if (!target.startsWith(webSrc + sep)) throw new Error(`vendored Piclaw editor import not found: ${args.path} from ${args.importer}`);
      const mapped = resolve(src, relative(webSrc, ts));
      if (!existsSync(mapped)) throw new Error(`no Classic module for vendored Piclaw editor import ${args.path} (${mapped})`);
      return { path: mapped };
    });
    build.onLoad({ filter: /[\\/]editor-3\.2\.5[\\/]web[\\/]src[\\/]panes[\\/]editor-loader\.ts$/ }, async args => ({
      contents: patchEditorLoader(await Bun.file(args.path).text()), loader: 'ts',
    }));
  } };
}
