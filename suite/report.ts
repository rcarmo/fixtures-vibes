#!/usr/bin/env bun
/**
 * Compliance report and gate. Reads Playwright JSON results, the feature catalogue, the runtime profile and its
 * skips file. Writes test-results/compliance-report.{json,md} and an evidence manifest. Exits 1 when:
 *  - a scenario covered by the suite fails in any project,
 *  - a skip names an unknown ID, is duplicated, or is stale (the scenario passed),
 *  - a capability-absent skip names a capability the profile claims,
 *  - a suite test title does not start with a known scenario ID.
 * Scenarios without a shared spec yet are reported as "no-suite-test" and do not fail the gate.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { loadProfile } from './runtime';
import { loadCatalogue, titleId } from './catalogue';

const root = resolve(import.meta.dir, '..');
const profile = loadProfile();
const resultsPath = resolve(root, process.env.FIXTURES_RESULTS ?? 'test-results/compliance.json');
const outDir = resolve(root, 'test-results');
mkdirSync(outDir, { recursive: true });

const catalogue = loadCatalogue(root);

// Results
type Outcome = { project: string; status: string; file: string; title: string };
const results = new Map<string, Outcome[]>();
const problems: string[] = [];
const walkSuites = (suites: any[] = [], file = '') => suites.forEach(s => {
  const f = s.file || file;
  for (const spec of s.specs ?? []) {
    const id = titleId(spec.title);
    if (!id || !catalogue.has(id)) { problems.push(`suite test without a known scenario ID: ${spec.title}`); continue; }
    for (const t of spec.tests ?? []) {
      const status = t.status === 'skipped' ? 'skipped' : (t.results?.at(-1)?.status ?? t.status);
      (results.get(id) ?? results.set(id, []).get(id)!).push({ project: t.projectName, status, file: f, title: spec.title });
    }
  }
  walkSuites(s.suites, f);
});
if (!existsSync(resultsPath)) throw new Error(`No Playwright results at ${resultsPath}`);
const raw = JSON.parse(readFileSync(resultsPath, 'utf8'));
walkSuites(raw.suites);
if (!results.size) problems.push('no suite tests ran (check FIXTURES_PROFILE and global setup errors)');
for (const e of raw.errors ?? []) problems.push(`run error: ${String(e.message ?? e).split('\n')[0]}`);

// Skips
const skipsPath = profile.skips ? resolve(profile.dir, profile.skips) : null;
if (skipsPath && !existsSync(skipsPath)) problems.push(`skips file not found: ${skipsPath}`);
const skipsDoc = skipsPath && existsSync(skipsPath) ? JSON.parse(readFileSync(skipsPath, 'utf8')) : { skips: [] };
const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
for (const [name, doc] of [['runtime-profile', { ...profile, dir: undefined }], ['skips', skipsDoc]] as const) {
  if (name === 'skips' && !skipsPath) continue;
  const validate = ajv.compile(JSON.parse(readFileSync(join(root, `schemas/${name}.schema.json`), 'utf8')));
  if (!validate(JSON.parse(JSON.stringify(doc)))) problems.push(`${name} invalid: ${ajv.errorsText(validate.errors)}`);
}
const skips = skipsDoc.skips as any[];
const skipById = new Map<string, any>();
for (const s of skips) {
  if (!catalogue.has(s.id)) problems.push(`skip for unknown ID ${s.id}`);
  if (skipById.has(s.id)) problems.push(`duplicate skip ${s.id}`);
  if (s.reason === 'capability-absent' && profile.capabilities.includes(s.capability)) problems.push(`skip ${s.id} claims ${s.capability} absent but the profile claims it`);
  skipById.set(s.id, s);
}

// Per-scenario status
const rows = [...catalogue].map(([id, sc]) => {
  const outs = results.get(id) ?? [];
  const missingCaps = sc.caps.filter(c => !profile.capabilities.includes(c));
  const skip = skipById.get(id);
  // A skip may cover only some projects; failures elsewhere are unlisted.
  const listed = (o: Outcome) => Boolean(skip) && (!skip.projects || skip.projects.includes(o.project));
  const failing = outs.filter(o => o.status !== 'passed' && o.status !== 'skipped');
  const unlisted = failing.filter(o => !listed(o));
  let status: string;
  if (!outs.length) status = 'no-suite-test';
  else if (outs.every(o => o.status === 'skipped')) status = skip ? `skipped:${skip.reason}` : missingCaps.length ? 'skipped:capability-absent(unlisted)' : 'skipped';
  else if (unlisted.length) status = 'failed';
  else if (failing.length) status = `failing-but-skipped:${skip.reason}`;
  else status = skip?.intermittent ? `passed-this-run:${skip.reason}(intermittent)` : 'passed';
  if (status === 'failed') problems.push(`${id} failed in ${unlisted.map(o => o.project).join(', ')}`);
  if (status === 'passed' && skip) problems.push(`stale skip ${id}: scenario passes`);
  if (status === 'skipped:capability-absent(unlisted)') problems.push(`${id} skipped for missing ${missingCaps.join(', ')} but not listed in the skips file`);
  return { id, name: sc.name, uri: sc.uri, capabilities: sc.caps, status, projects: outs.map(o => `${o.project}:${o.status}`) };
});

const count = (p: (s: string) => boolean) => rows.filter(r => p(r.status)).length;
const summary = {
  runtime: profile.runtime, version: profile.version, scenarios: rows.length,
  passed: count(s => s === 'passed'), failed: count(s => s === 'failed'), skipped: count(s => s.startsWith('skipped')),
  listedFailing: count(s => s.startsWith('failing-but-skipped') || s.startsWith('passed-this-run')),
  noSuiteTest: count(s => s === 'no-suite-test'),
  // Provenance, so a report built from stale results or another skips file is visible.
  resultsFile: resultsPath, resultsStartedAt: raw.stats?.startTime ?? null, skipsFile: skipsPath,
  skipsListed: skips.map(s => s.id), problems,
};
writeFileSync(join(outDir, `compliance-report-${profile.runtime}.json`), JSON.stringify({ summary, rows }, null, 2));
writeFileSync(join(outDir, `evidence-${profile.runtime}.json`), JSON.stringify({
  runtime: profile.runtime, fixturesVibes: process.env.FIXTURES_VIBES_REF ?? 'local',
  entries: [...results].filter(([, o]) => o.some(x => x.status === 'passed')).map(([id, o]) => ({
    id, tests: o.filter(x => x.status === 'passed').map(x => ({ file: x.file, title: x.title, project: x.project })) })),
}, null, 2));
const md = [`# Compliance: ${profile.runtime} ${profile.version}`, '',
  `| Scenarios | Passed | Failed | Skipped | Listed failing | No suite test yet |`, '|---:|---:|---:|---:|---:|---:|',
  `| ${summary.scenarios} | ${summary.passed} | ${summary.failed} | ${summary.skipped} | ${summary.listedFailing} | ${summary.noSuiteTest} |`, '',
  `Results: \`${resultsPath}\` (run started ${summary.resultsStartedAt ?? 'unknown'})`,
  `Skips: ${skipsPath ? `\`${skipsPath}\` (${skips.length} listed)` : 'none'}`, '',
  ...(problems.length ? ['## Gate problems', '', ...problems.map(p => `- ${p}`)] : ['Gate: OK']),
  '', '## Covered scenarios', '', ...rows.filter(r => r.status !== 'no-suite-test').map(r => `- \`${r.id}\` ${r.status} — ${r.name}`)];
writeFileSync(join(outDir, `compliance-report-${profile.runtime}.md`), md.join('\n') + '\n');
console.log(md.join('\n'));
process.exit(problems.length ? 1 : 0);
