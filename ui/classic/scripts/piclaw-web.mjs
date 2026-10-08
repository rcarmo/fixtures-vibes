/**
 * Classic's build view of Piclaw: the web sources vendored unmodified under piclaw/web-<version>/ (written by
 * scripts/vendor-piclaw.mjs, pinned by SHA256SUMS) with Classic's src/ as an overlay. A module at `web/src/<path>`
 * is Classic's `src/<path>` when that file exists (Gi's own modules and adapters), otherwise Piclaw's; extension
 * sources (`extensions/…`) are always Piclaw's. Anchored patches adapt a few vendored modules at build time and fail
 * the build if an anchor moves.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { patchEditorRevision, patchConflictRevision, patchEditorRefreshRevision } from './patch-editor-revision.mjs';
const CODEMIRROR = '/editor-vendor/codemirror.js';

/** The single vendored tree, e.g. piclaw/web-3.3.0 (relative to ui/classic). */
export function piclawWebDir(root) {
  const dirs = readdirSync(resolve(root, 'piclaw')).filter(d => d.startsWith('web-'));
  if (dirs.length !== 1) throw new Error(`expected exactly one piclaw/web-* directory, found ${dirs.join(', ') || 'none'}`);
  return `piclaw/${dirs[0]}`;
}

/** Fail unless every vendored file matches SHA256SUMS. */
export function verifyPiclawWeb(root) {
  const dir = resolve(root, piclawWebDir(root));
  for (const line of readFileSync(resolve(dir, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
    const [sum, file] = line.split(/\s+/);
    const actual = createHash('sha256').update(readFileSync(resolve(dir, file))).digest('hex');
    if (actual !== sum) throw new Error(`vendored Piclaw source changed: ${file} (${actual})`);
  }
  return dir;
}

/** Replace each anchor (all occurrences); fail the build if an anchor moved. */
export function patch(source, file, pairs) {
  for (const [from, to] of pairs) {
    if (!source.includes(from)) throw new Error(`Piclaw anchor changed in ${file}: ${from}`);
    source = source.replaceAll(from, to);
  }
  return source;
}

// The Classic tree is served at / (ui/API.md), not at Piclaw's /static/classic/.
export const patchEditorLoader = source => patch(source, 'editor-loader.ts', [
  ['/static/classic/dist/editor.bundle.js', '/dist/editor.bundle.js'],
]);

// Classic composes only popOutPane from app-window-actions; its compose-time root-session action has no Classic API.
export const patchWindowActions = source => patch(source, 'app-window-actions.ts', [
  ["import { createRootChatSession as defaultCreateRootChatSession } from '../api.js';",
    "const defaultCreateRootChatSession = async () => { throw new Error('Classic does not create root sessions from the composer'); };"],
]);

// Workspace uploads go through Classic's API (ui/API.md: POST /api/workspace/upload with ?path and ?overwrite=1),
// not Piclaw's chunked /workspace/upload-chunk protocol; the batch/progress helper stays Piclaw's.
export const patchExplorerUploads = source => patch(source, 'workspace-explorer.ts', [
  ["import { uploadFileBatch, uploadWorkspaceFile } from '../ui/upload-transfers.js';",
    "import { uploadFileBatch } from '../ui/upload-transfers.js';\nimport { uploadWorkspaceFile } from '../api.js';"],
]);

/** Resolve a logical runtime/ path (web/src/…, extensions/…) to a file: Classic overlay first, then vendored. */
export function overlayResolver(root) {
  const vendored = resolve(root, piclawWebDir(root));
  const src = resolve(root, 'src');
  const candidates = (p) => [p, p.replace(/\.js$/, '.ts'), `${p}.ts`, join(p, 'index.ts')];
  const logicalOf = (file) => file.startsWith(src + sep) ? join('web/src', relative(src, file))
    : file.startsWith(vendored + sep) ? relative(vendored, file) : null;
  return {
    vendored, src, logicalOf,
    resolve(importer, spec) {
      // Imports from elsewhere (unit tests) that name a path under src/ get the same overlay view.
      const from = logicalOf(importer);
      const outside = from ? null : logicalOf(resolve(dirname(importer), spec));
      if (!from && !outside) return null;
      const logical = outside || join(dirname(from), spec);
      if (logical.startsWith('..')) return null;
      for (const c of candidates(logical)) {
        const o = c.startsWith('web/src/') ? join(src, c.slice('web/src/'.length)) : null;
        if (o && existsSync(o) && !o.endsWith(sep)) return o;
      }
      for (const c of candidates(logical)) if (existsSync(join(vendored, c))) return join(vendored, c);
      return null;
    },
  };
}

export function piclawWebAdapter(root) {
  verifyPiclawWeb(root);
  const overlay = overlayResolver(root);
  return { name: 'piclaw-web', setup(build) {
    build.onResolve({ filter: /^#editor-vendor\/codemirror$/ }, () => ({ path: CODEMIRROR, external: true }));
    build.onResolve({ filter: /^\.\.?\// }, args => {
      const path = overlay.resolve(args.importer, args.path);
      return path ? { path } : undefined;
    });
    build.onLoad({ filter: /[\\/]web-[^\\/]+[\\/]extensions[\\/]viewers[\\/]editor[\\/]editor-extension\.ts$/ }, async args => ({
      contents: patchEditorRevision(await Bun.file(args.path).text()), loader: 'ts',
    }));
    build.onLoad({ filter: /[\\/]web-[^\\/]+[\\/]web[\\/]src[\\/]panes[\\/]file-conflict-monitor\.ts$/ }, async args => ({
      contents: patchConflictRevision(await Bun.file(args.path).text()), loader: 'ts',
    }));
    build.onLoad({ filter: /[\\/]web-[^\\/]+[\\/]web[\\/]src[\\/]ui[\\/]app-pane-runtime-orchestration\.ts$/ }, async args => ({
      contents: patchEditorRefreshRevision(await Bun.file(args.path).text()), loader: 'ts',
    }));
    build.onLoad({ filter: /[\\/]web-[^\\/]+[\\/]web[\\/]src[\\/]panes[\\/]editor-loader\.ts$/ }, async args => ({
      contents: patchEditorLoader(await Bun.file(args.path).text()), loader: 'ts',
    }));
    build.onLoad({ filter: /[\\/]web-[^\\/]+[\\/]web[\\/]src[\\/]components[\\/]workspace-explorer\.ts$/ }, async args => ({
      contents: patchExplorerUploads(await Bun.file(args.path).text()), loader: 'ts',
    }));
    build.onLoad({ filter: /[\\/]web-[^\\/]+[\\/]web[\\/]src[\\/]ui[\\/]app-window-actions\.ts$/ }, async args => ({
      contents: patchWindowActions(await Bun.file(args.path).text()), loader: 'ts',
    }));
  } };
}
