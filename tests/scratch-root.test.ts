import { test, expect, afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { newRoot } from '../suite/lifecycle';
// @ts-ignore -- plain ESM helper
import { initRunDir, resolveProjectTmpRoot, snapshotOriginalTmpdir } from '../mk/project-tmp.mjs';

const saved = process.env.FIXTURES_RUN_ROOT;
afterEach(() => { if (saved === undefined) delete process.env.FIXTURES_RUN_ROOT; else process.env.FIXTURES_RUN_ROOT = saved; });

function sandbox(fn: (base: string) => void) {
  const base = mkdtempSync(join(tmpdir(), 'scratch-root-test-'));
  try { fn(base); } finally { rmSync(base, { recursive: true, force: true }); }
}

test('locally: /workspace/tmp, then system temp; in CI: RUNNER_TEMP, original TMPDIR, system temp — each + /<project>', () => sandbox(base => {
  const missing = join(base, 'no-workspace'), ws = join(base, 'ws');
  mkdirSync(ws); mkdirSync(join(base, 'runner')); mkdirSync(join(base, 't'));
  const sys = process.platform === 'win32' ? tmpdir() : '/tmp';
  expect(resolveProjectTmpRoot('p', { TMPDIR: join(base, 't') }, ws)).toBe(join(ws, 'p'));
  expect(resolveProjectTmpRoot('p', { TMPDIR: join(base, 't') }, missing)).toBe(join(sys, 'p'));
  // CI ignores the workspace mount even when it exists.
  expect(resolveProjectTmpRoot('p', { CI: 'true', RUNNER_TEMP: join(base, 'runner'), TMPDIR: join(base, 't') }, ws)).toBe(join(base, 'runner', 'p'));
  expect(resolveProjectTmpRoot('p', { GITHUB_ACTIONS: 'true', TMPDIR: join(base, 't') }, ws)).toBe(join(base, 't', 'p'));
  expect(resolveProjectTmpRoot('p', { CI: '1' }, ws)).toBe(join(sys, 'p'));
  // The snapshotted original TMPDIR wins over a TMPDIR already redirected into a run directory.
  expect(resolveProjectTmpRoot('p', { CI: 'true', PROJECT_ORIGINAL_TMPDIR: join(base, 't'), TMPDIR: join(base, 't', 'p', 'runs', 'x', 'tmp') }, ws)).toBe(join(base, 't', 'p'));
  const env: Record<string, string> = { TMPDIR: join(base, 't') };
  snapshotOriginalTmpdir(env); env.TMPDIR = join(base, 'elsewhere');
  expect(env.PROJECT_ORIGINAL_TMPDIR).toBe(join(base, 't'));
}));

test('explicit PROJECT_TMP_BASE gives <base>/<project>; PROJECT_TMP_ROOT is kept and must agree with it', () => sandbox(base => {
  const root = join(base, 'p');
  expect(resolveProjectTmpRoot('p', { PROJECT_TMP_BASE: base, CI: 'true', RUNNER_TEMP: '/nowhere' }, base)).toBe(root);
  expect(resolveProjectTmpRoot('p', { PROJECT_TMP_ROOT: root, TMPDIR: join(root, 'runs', 'x', 'tmp') }, base)).toBe(root);
  expect(resolveProjectTmpRoot('p', { PROJECT_TMP_BASE: base, PROJECT_TMP_ROOT: root }, base)).toBe(root);
  expect(() => resolveProjectTmpRoot('p', { PROJECT_TMP_BASE: base, PROJECT_TMP_ROOT: join(base, 'x', 'p') }, base)).toThrow('conflicting');
  for (const PROJECT_TMP_BASE of ['', 'relative']) expect(() => resolveProjectTmpRoot('p', { PROJECT_TMP_BASE }, base)).toThrow('PROJECT_TMP_BASE must');
}));

test('an explicit root that is relative, misnamed or symlinked fails instead of falling back', () => sandbox(base => {
  mkdirSync(join(base, 'real'));
  symlinkSync(join(base, 'real'), join(base, 'p'));
  for (const PROJECT_TMP_ROOT of ['rel/p', join(base, 'other'), join(base, 'p')])
    expect(() => resolveProjectTmpRoot('p', { PROJECT_TMP_ROOT }, base)).toThrow('PROJECT_TMP_ROOT must be');
  expect(() => resolveProjectTmpRoot('../p', {}, base)).toThrow('invalid canonical project name');
}));

test('runtime roots are created under the run directory with a private tmp/; a symlinked run root is refused', () => sandbox(base => {
  const run = initRunDir(join(base, 'p'), 'suite', 'r1');
  expect(run).toBe(join(base, 'p', 'runs', 'suite', 'r1'));
  for (const dir of ['cache', 'build', 'tests', 'logs', 'runs/suite/r1/tmp']) expect(existsSync(join(base, 'p', dir))).toBe(true);
  process.env.FIXTURES_RUN_ROOT = run;
  const root = newRoot('fixtures-x-');
  expect(root.startsWith(join(run, 'fixtures-x-'))).toBe(true);
  expect(existsSync(join(root, 'tmp'))).toBe(true);
  symlinkSync(run, join(base, 'link'));
  process.env.FIXTURES_RUN_ROOT = join(base, 'link');
  expect(() => newRoot('fixtures-x-')).toThrow('not a symlink');
  process.env.FIXTURES_RUN_ROOT = 'relative/run';
  expect(() => newRoot('fixtures-x-')).toThrow('must be absolute');
}));
