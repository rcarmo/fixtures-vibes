import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const json = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

test('current manifest oracle matches independently recorded reference asset identity', () => {
  const identity = json('oracle/piclaw/3.3.0/identity.json');
  const manifest = json('MANIFEST.json');
  expect(manifest.oracle).toEqual({ runtime: identity.runtime, version: identity.version,
    interface: identity.interface, assets: identity.assets });
  expect(identity.version).toBe('3.3.0');
  expect(identity.assets['/static/classic/dist/editor.bundle.js']).toMatch(/^[a-f0-9]{64}$/);
});

test('focused reference evidence preserves setup correction provenance and outcome totals', () => {
  const path = 'oracle/piclaw/3.3.0/2026-10-08-b17ef01-330-focused/';
  const record = json(path + 'results.json');
  expect(record.revalidation.kind).toBe('focused multi-run record, not full compliance');
  expect(record.revalidation.excludedInitialSetupOutcomes).toBe(10);
  expect(record.revalidation.initialStartedAt).not.toBe(record.revalidation.setupCorrectedStartedAt);
  expect(record.tests).toHaveLength(216);
  expect(record.tests.filter(t => t.status === 'passed')).toHaveLength(122);
  expect(record.tests.filter(t => t.status === 'failed')).toHaveLength(90);
  expect(record.tests.filter(t => t.status === 'skipped')).toHaveLength(4);
  const skips = json('profiles/piclaw-3.3.0-skips.json').skips;
  for (const result of record.tests.filter(t => t.status === 'failed')) {
    const id = result.title.match(/@ux-[a-z0-9-]+/)?.[0];
    const exception = skips.find(s => s.id === id);
    expect(exception).toBeDefined();
    if (exception.projects) expect(exception.projects).toContain(result.project);
  }
});
