#!/usr/bin/env bun
/**
 * Vendor the Piclaw web sources Classic uses, unmodified, from a Piclaw git checkout at one ref:
 *   bun scripts/vendor-piclaw.mjs <piclaw-repo> <ref> [label]
 * writes piclaw/web-<label>/ (label defaults to the ref) with the Piclaw `runtime/` layout (web/src/…,
 * extensions/viewers/editor/…), SOURCE (repository, ref, commit) and SHA256SUMS, and removes any other piclaw/web-*.
 *
 * Only the build's import closure is copied. Resolution follows the build's overlay rule (scripts/piclaw-web.mjs):
 * `web/src/<path>` is Classic's `src/<path>` when that exists, otherwise Piclaw's. Entry points: Classic's
 * src/gi-bootstrap.ts, Piclaw's editor extension and CodeMirror entry, and Piclaw's Classic stylesheet
 * (web/src/styles/app.css with its @imports and relative font assets).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';

const [repo, ref, labelArg] = process.argv.slice(2);
if (!repo || !ref) { console.error('usage: vendor-piclaw.mjs <piclaw-repo> <ref> [label]'); process.exit(2); }
const root = resolve(import.meta.dir, '..');
const classicSrc = join(root, 'src');
const commit = execFileSync('git', ['-C', repo, 'rev-parse', `${ref}^{commit}`], { encoding: 'utf8' }).trim();
const label = (labelArg || ref).replace(/^v/, '');
const listing = new Set(execFileSync('git', ['-C', repo, 'ls-tree', '-r', '--name-only', commit, 'runtime/'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\n').filter(Boolean).map(p => p.slice('runtime/'.length)));
const show = (path) => execFileSync('git', ['-C', repo, 'show', `${commit}:runtime/${path}`], { maxBuffer: 1 << 28 });

// A module is a logical runtime/ path; Classic's src/<p> overlays web/src/<p>.
const overlay = (logical) => logical.startsWith('web/src/') ? join(classicSrc, logical.slice('web/src/'.length)) : null;
const exists = (logical) => (overlay(logical) && existsSync(overlay(logical))) || listing.has(logical);
const source = (logical) => {
  const o = overlay(logical);
  if (o && existsSync(o)) return { classic: true, text: Bun.file(o).text() };
  return { classic: false, text: Promise.resolve(show(logical).toString('utf8')) };
};
function resolveSpec(fromLogical, spec) {
  const base = normalize(join(dirname(fromLogical), spec));
  for (const c of [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, join(base, 'index.ts')]) if (exists(c)) return c;
  return null;
}
const importRe = /(?:^|[^\w$.])(?:import|export)\s*(?:[^'"`;]*?\sfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

const entries = ['web/src/gi-bootstrap.ts', 'extensions/viewers/editor/editor-extension.ts', 'extensions/viewers/editor/vendor/codemirror-entry.ts',
  'web/src/styles/app.css'];
// CSS: @import "x", @import url("x") and relative url(x) assets (fonts); absolute URLs are the server's.
const cssRe = /@import\s+(?:url\()?\s*["']([^"']+)["']|url\(\s*["']?(?![a-z]+:|\/|#|data:)([^"')]+)["']?\s*\)/g;
const seen = new Set(), vendored = new Set(), unresolved = [];
const queue = [...entries];
while (queue.length) {
  const logical = queue.pop();
  if (seen.has(logical)) continue;
  seen.add(logical);
  if (!exists(logical)) { unresolved.push(logical); continue; }
  const { classic, text } = source(logical);
  if (!classic) vendored.add(logical);
  if (logical.endsWith('.css')) {
    for (const m of (await text).matchAll(cssRe)) {
      const spec = m[1] || m[2];
      if (/^(?:[a-z]+:|\/)/.test(spec)) continue;
      const target = normalize(join(dirname(logical), spec));
      if (exists(target)) queue.push(target); else unresolved.push(`${logical} -> ${spec}`);
    }
    continue;
  }
  if (!/\.(ts|js|mjs)$/.test(logical)) continue;
  for (const m of (await text).matchAll(importRe)) {
    const spec = m[1] || m[2];
    const target = resolveSpec(logical, spec);
    if (target) queue.push(target); else unresolved.push(`${logical} -> ${spec}`);
  }
}

const out = join(root, 'piclaw', `web-${label}`);
for (const d of readdirSync(join(root, 'piclaw'))) if (d.startsWith('web-')) rmSync(join(root, 'piclaw', d), { recursive: true });
const sums = [];
for (const logical of [...vendored].sort()) {
  const bytes = show(logical);
  mkdirSync(dirname(join(out, logical)), { recursive: true });
  writeFileSync(join(out, logical), bytes);
  sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ./${logical}`);
}
const url = (() => { try { return execFileSync('git', ['-C', repo, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
writeFileSync(join(out, 'SOURCE'), `repository ${url}\nref ${ref}\ncommit ${commit}\n`);
writeFileSync(join(out, 'SHA256SUMS'), sums.join('\n') + '\n');
console.log(`vendored ${vendored.size} Piclaw files at ${commit.slice(0, 10)} into ${relative(root, out)}`);
const reached = new Set([...seen].filter(l => l.startsWith('web/src/')).map(l => l.slice('web/src/'.length)));
const unreached = [...new Bun.Glob('**/*.{ts,js}').scanSync(classicSrc)].filter(f => !reached.has(f) && !f.startsWith('vendor/')).sort();
if (unreached.length) console.log(`Classic src modules outside the bundle graph (build.js may still use some):\n  ${unreached.join('\n  ')}`);
if (unresolved.length) console.log(`unresolved (bare, generated or missing):\n  ${[...new Set(unresolved)].join('\n  ')}`);
