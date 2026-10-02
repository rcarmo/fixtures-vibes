#!/usr/bin/env bun
/**
 * Record a finished reference run as dated, read-only oracle evidence:
 *   oracle/<runtime>/<version>/<YYYY-MM-DD>-<ref>/{compliance-report.json,compliance-report.md,evidence.json,results.json}
 * Run after `make compliance` with the same FIXTURES_PROFILE. Refuses to overwrite an existing record.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadProfile } from '../suite/runtime';

const root = resolve(import.meta.dir, '..');
const profile = loadProfile();
const results = join(root, 'test-results');
const raw = JSON.parse(readFileSync(join(results, 'compliance.json'), 'utf8'));
const report = JSON.parse(readFileSync(join(results, `compliance-report-${profile.runtime}.json`), 'utf8'));
if (report.summary.problems.length) throw new Error(`Gate is not OK; not recording: ${report.summary.problems.join('; ')}`);

const ref = process.env.FIXTURES_VIBES_REF ?? 'local';
const started = String(raw.stats?.startTime ?? new Date().toISOString());
const dir = join(root, 'oracle', profile.runtime, profile.version, `${started.slice(0, 10)}-${ref}`);
if (existsSync(dir)) throw new Error(`${dir} exists; oracle records are immutable`);
mkdirSync(dir, { recursive: true });

// Per-test outcomes without captured stdout or attachments.
const tests: { title: string; file: string; project: string; status: string; durationMs: number }[] = [];
const walk = (suites: any[] = [], file = '') => suites.forEach(s => {
  const f = s.file || file;
  for (const spec of s.specs ?? []) for (const t of spec.tests ?? []) {
    const last = t.results?.at(-1);
    tests.push({ title: spec.title, file: f, project: t.projectName, status: t.status === 'skipped' ? 'skipped' : last?.status ?? t.status, durationMs: last?.duration ?? 0 });
  }
  walk(s.suites, f);
});
walk(raw.suites);

writeFileSync(join(dir, 'results.json'), JSON.stringify({
  runtime: profile.runtime, version: profile.version, fixturesVibes: ref, startedAt: started,
  durationMs: raw.stats?.duration ?? null, playwright: raw.config?.version ?? null, tests,
}, null, 2) + '\n');
// Reports name local files; store them relative to the repository so the record does not leak machine paths.
const relative = (text: string) => text.split(root + '/').join('').split(root.replace(/^\/srv\/piclaw-dev/, '') + '/').join('');
writeFileSync(join(dir, 'compliance-report.json'), relative(readFileSync(join(results, `compliance-report-${profile.runtime}.json`), 'utf8')));
writeFileSync(join(dir, 'compliance-report.md'), relative(readFileSync(join(results, `compliance-report-${profile.runtime}.md`), 'utf8')));
copyFileSync(join(results, `evidence-${profile.runtime}.json`), join(dir, 'evidence.json'));
console.log(`recorded ${tests.length} test outcomes in ${dir}`);
