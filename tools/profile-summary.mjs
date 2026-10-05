#!/usr/bin/env node
/**
 * Summarise V8 .cpuprofile / .heapprofile files (node --cpu-prof / --heap-prof) for post-run analysis: total sampled
 * CPU, top self-time functions, and top allocation sites by sampled self size, split into suite/application code
 * (this repository) versus runtime/dependency frames. Usage: profile-summary.mjs <dir> [top=15]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const where = (cf) => {
  const url = (cf.url || '').replace(/^file:\/\//, '');
  if (!url) return '(native)';
  const rel = url.startsWith(repo) ? relative(repo, url) : url;
  return `${rel}:${(cf.lineNumber ?? -1) + 1}`;
};
const own = (cf) => (cf.url || '').replace(/^file:\/\//, '').startsWith(repo) && !(cf.url || '').includes('/node_modules/');
const label = (cf) => `${cf.functionName || '(anonymous)'} ${where(cf)}`;
const fmt = (n, unit) => unit === 'ms' ? `${n.toFixed(1)} ms` : `${(n / 1024).toFixed(0)} KiB`;

function table(title, map, total, unit, top) {
  const rows = [...map.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, top);
  console.log(`\n${title} (total ${fmt(total, unit)})`);
  for (const [k, { v, mine }] of rows) console.log(`  ${fmt(v, unit).padStart(10)} ${(100 * v / (total || 1)).toFixed(1).padStart(5)}% ${mine ? '*' : ' '} ${k}`);
}

/** Bun's --heap-prof writes a heap snapshot (live objects at exit), not a sampling profile: summarise by type/name. */
function snapshot(file, p, top) {
  const f = p.snapshot.meta.node_fields, types = p.snapshot.meta.node_types[0], w = f.length;
  const it = f.indexOf('type'), iname = f.indexOf('name'), isize = f.indexOf('self_size');
  const self = new Map(); let total = 0;
  for (let i = 0; i < p.nodes.length; i += w) {
    const size = p.nodes[i + isize]; total += size;
    const k = `${types[p.nodes[i + it]]} ${String(p.strings[p.nodes[i + iname]]).slice(0, 60)}`;
    const e = self.get(k) || { v: 0, mine: false }; e.v += size; self.set(k, e);
  }
  console.log(`\n== ${file}: heap snapshot at exit, ${fmt(total, 'b')} live (no allocation sites in this format)`);
  table('top live objects by type/name', self, total, 'b', top);
}

/** Bun test capture (mk/bun-test-profile.ts): JSC profile() stack samples and an Inspector heap snapshot. */
function bunTest(name, dir, top) {
  const cpu = JSON.parse(readFileSync(join(dir, 'cpu.json'), 'utf8'));
  const ms = (cpu.stackTraces.interval || 0.001) * 1000;
  const self = new Map(), incl = new Map(); let n = 0, mine = 0;
  const frameLabel = f => `${f.name || '(anonymous)'} ${f.sourceURL ? (f.sourceURL.startsWith(repo) ? relative(repo, f.sourceURL) : f.sourceURL) : '(native)'}:${f.line > 1e9 ? '?' : f.line}`;
  const ownFrame = f => !!f.sourceURL && f.sourceURL.startsWith(repo) && !f.sourceURL.includes('/node_modules/');
  for (const t of cpu.stackTraces.traces) {
    const frames = (t.frames || []).filter(f => f.name !== 'profile');
    n++;
    const leaf = frames[0];
    const k = leaf ? frameLabel(leaf) : '(idle/native)';
    const e = self.get(k) || { v: 0, mine: !!leaf && ownFrame(leaf) }; e.v += ms; self.set(k, e);
    const first = frames.find(ownFrame);
    if (first) { mine += ms; const ki = frameLabel(first); const ei = incl.get(ki) || { v: 0, mine: true }; ei.v += ms; incl.set(ki, ei); }
  }
  console.log(`\n== ${name}/cpu.json: ${n} samples at ${ms} ms = ${(n * ms).toFixed(0)} ms of JS, ${mine.toFixed(0)} ms under repository frames (* = repository frame)`);
  table('top self time', self, n * ms, 'ms', top);
  table('time attributed to the innermost repository frame', incl, n * ms, 'ms', top);
  const heap = JSON.parse(readFileSync(join(dir, 'heap.json'), 'utf8'));
  const w = heap.nodes.length % 4 === 0 ? 4 : 5;
  const byClass = new Map(); let total = 0;
  for (let i = 0; i < heap.nodes.length; i += w) {
    const size = heap.nodes[i + 1]; total += size;
    const k = heap.nodeClassNames[heap.nodes[i + 2]];
    const e = byClass.get(k) || { v: 0, mine: false }; e.v += size; byClass.set(k, e);
  }
  console.log(`\n== ${name}/heap.json: heap snapshot at the end of the run, ${heap.nodes.length / w} objects, ${fmt(total, 'b')} (live objects only; JSC keeps no allocation sites)`);
  table('top live objects by class', byClass, total, 'b', top);
}

const [dir, topArg] = process.argv.slice(2);
if (!dir) { console.error('usage: profile-summary.mjs <dir> [top]'); process.exit(2); }
const top = Number(topArg) || 15;
for (const file of readdirSync(dir).sort()) {
  const path = join(dir, file);
  if (/^bun-test-\d+$/.test(file)) { try { bunTest(file, path, top); } catch (e) { console.log(`\n== ${file}: capture incomplete (${e.message})`); } continue; }
  if (file.endsWith('.cpuprofile')) {
    const p = JSON.parse(readFileSync(path, 'utf8'));
    const byId = new Map(p.nodes.map(n => [n.id, n]));
    const self = new Map(); let total = 0, mineTotal = 0;
    const dt = p.timeDeltas || [];
    (p.samples || []).forEach((id, i) => {
      const n = byId.get(id); const ms = (dt[i] || 0) / 1000; total += ms;
      const name = n.callFrame.functionName;
      if (name === '(idle)' || name === '(program)' || name === '(garbage collector)') { const k = name; const e = self.get(k) || { v: 0, mine: false }; e.v += ms; self.set(k, e); return; }
      const k = label(n.callFrame); const e = self.get(k) || { v: 0, mine: own(n.callFrame) }; e.v += ms; self.set(k, e);
      if (e.mine) mineTotal += ms;
    });
    console.log(`\n== ${file}: ${total.toFixed(0)} ms sampled, repository code self ${mineTotal.toFixed(1)} ms (* = repository frame)`);
    table('top self time', self, total, 'ms', top);
  } else if (/^time-.*\.txt$/.test(file)) {
    const keep = /^\s*(Command being timed|User time|System time|Percent of CPU|Elapsed|Maximum resident set size|Exit status)/;
    console.log(`\n== ${file} (process CPU time and peak RSS, including profiler overhead)`);
    for (const line of readFileSync(path, 'utf8').split('\n')) if (keep.test(line)) console.log(`  ${line.trim()}`);
  } else if (/^bun-test-heap-.*\.json$/.test(file)) {
    const h = JSON.parse(readFileSync(path, 'utf8'));
    console.log(`\n== ${file} (bun test: live heap at exit; no allocation profile available)`);
    console.log(`  heap ${fmt(h.heapSize, 'b')} of ${fmt(h.heapCapacity, 'b')}, extra ${fmt(h.extraMemorySize, 'b')}, ${h.objectCount} objects`);
    console.log(`  top types: ${h.topObjectTypes.slice(0, 8).map(([t, n]) => `${t} ${n}`).join(', ')}`);
  } else if (file.endsWith('.heapprofile')) {
    const p = JSON.parse(readFileSync(path, 'utf8'));
    if (p.snapshot) { snapshot(file, p, top); continue; }
    const self = new Map(); let total = 0, mineTotal = 0;
    (function walk(n) {
      const size = n.selfSize || 0; total += size;
      if (size) { const k = label(n.callFrame); const e = self.get(k) || { v: 0, mine: own(n.callFrame) }; e.v += size; self.set(k, e); if (e.mine) mineTotal += size; }
      for (const c of n.children || []) walk(c);
    })(p.head);
    console.log(`\n== ${file}: ${fmt(total, 'b')} live sampled allocations at exit, repository frames ${fmt(mineTotal, 'b')} (* = repository frame)`);
    table('top allocation sites (sampled self size)', self, total, 'b', top);
  }
}
