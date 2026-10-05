import { test, expect, afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { newRoot } from '../suite/lifecycle';
// @ts-ignore -- plain ESM helper
import { initRunDir, resolveProjectTmpRoot } from '../mk/project-tmp.mjs';

const saved = process.env.FIXTURES_RUN_ROOT;
afterEach(() => { if (saved === undefined) delete process.env.FIXTURES_RUN_ROOT; else process.env.FIXTURES_RUN_ROOT = saved; });

function sandbox(fn: (base: string) => void) {
  const base = mkdtempSync(join(tmpdir(), 'scratch-root-test-'));
  try { fn(base); } finally { rmSync(base, { recursive: true, force: true }); }
}

test('the root resolves once: explicit, then /workspace/tmp, RUNNER_TEMP, TMPDIR, platform temp — each + /<project>', () => sandbox(base => {
  const missing = join(base, 'no-workspace');
  mkdirSync(join(base, 'ws')); mkdirSync(join(base, 'runner')); mkdirSync(join(base, 't'));
  expect(resolveProjectTmpRoot('p', {}, join(base, 'ws'))).toBe(join(base, 'ws', 'p'));
  expect(resolveProjectTmpRoot('p', { RUNNER_TEMP: join(base, 'runner'), TMPDIR: join(base, 't') }, missing)).toBe(join(base, 'runner', 'p'));
  expect(resolveProjectTmpRoot('p', { TMPDIR: join(base, 't') }, missing)).toBe(join(base, 't', 'p'));
  expect(resolveProjectTmpRoot('p', {}, missing)).toBe(join(tmpdir(), 'p'));
  // An explicit root is used as given (no second project suffix), even when TMPDIR already points inside it.
  const root = join(base, 'ws', 'p');
  expect(resolveProjectTmpRoot('p', { PROJECT_TMP_ROOT: root, TMPDIR: join(root, 'runs', 'x', 'tmp') }, missing)).toBe(root);
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
  for (const dir of ['cache', 'build', 'runs/suite/r1/tmp']) expect(existsSync(join(base, 'p', dir))).toBe(true);
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
