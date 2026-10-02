#!/usr/bin/env bun
/** Write MANIFEST.json: SHA-256 of every consumed file plus the oracle identity. Provenance only, not a test gate. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dir, '..');
const roots = ['features', 'schemas', 'control', 'suite', 'profiles', 'capabilities.json', 'package.json', 'bun.lock', 'Makefile'];
const walk = (p: string): string[] => {
  try { return readdirSync(p, { withFileTypes: true }).flatMap(e => walk(join(p, e.name))); } catch { return [p]; }
};
const files = roots.flatMap(r => walk(join(root, r))).map(p => relative(root, p)).sort();
const sha = (p: string) => createHash('sha256').update(readFileSync(join(root, p))).digest('hex');
const manifest = {
  oracle: {
    runtime: 'piclaw', version: '3.2.5', interface: 'classic',
    assets: { '/static/classic/dist/app.bundle.js': '65205f9b4339289f896120f3a7510a75baf14e7e085f39ed47e593ec9eb052d5' },
  },
  sources: {
    classic: 'rcarmo Gi features/ux/classic + additions/piclaw-2026-09-24 at af48800 (IDs preserved)',
    shared: 'Vibes Python tests/parity/features/canonical-ux.feature at 9a34046 (IDs minted @ux-shared-NNN)',
  },
  files: Object.fromEntries(files.map(f => [f, sha(f)])),
};
writeFileSync(join(root, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`MANIFEST.json: ${files.length} files`);
