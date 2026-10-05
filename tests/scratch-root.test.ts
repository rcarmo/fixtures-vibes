import { test, expect, afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { newRoot } from '../suite/lifecycle';

const saved = process.env.FIXTURES_RUN_ROOT;
afterEach(() => { if (saved === undefined) delete process.env.FIXTURES_RUN_ROOT; else process.env.FIXTURES_RUN_ROOT = saved; });

test('roots are created under FIXTURES_RUN_ROOT with a private tmp/, and a symlinked or relative run root is refused', () => {
  const base = mkdtempSync(join(process.env.TMPDIR || '/tmp', 'scratch-root-test-'));
  try {
    process.env.FIXTURES_RUN_ROOT = join(base, 'run');
    const root = newRoot('fixtures-x-');
    expect(root.startsWith(join(base, 'run', 'fixtures-x-'))).toBe(true);
    expect(existsSync(join(root, 'tmp'))).toBe(true);

    mkdirSync(join(base, 'real'));
    symlinkSync(join(base, 'real'), join(base, 'link'));
    process.env.FIXTURES_RUN_ROOT = join(base, 'link');
    expect(() => newRoot('fixtures-x-')).toThrow('not a symlink');
    process.env.FIXTURES_RUN_ROOT = 'relative/run';
    expect(() => newRoot('fixtures-x-')).toThrow('must be absolute');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
