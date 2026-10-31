import { expect, test } from 'bun:test';
import { readdirSync, lstatSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');

test('Classic is the only frontend tree; alternate directories and symlink aliases are forbidden', () => {
  const entries = readdirSync(resolve(root, 'ui'), { withFileTypes: true });
  expect(entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()).toEqual(['classic']);
  expect(entries.filter(entry => entry.isSymbolicLink()).map(entry => entry.name)).toEqual([]);
  expect(lstatSync(resolve(root, 'ui/classic')).isDirectory()).toBe(true);
  for (const name of ['vibes', 'tau', 'gi']) {
    expect(existsSync(resolve(root, 'ui', name))).toBe(false);
  }
});

test('there is one frontend package/build entry point and one served asset root', () => {
  for (const path of ['ui/classic/package.json', 'ui/classic/bun.lock', 'ui/classic/Makefile',
    'ui/classic/build.js', 'ui/classic/static/index.html']) {
    expect(existsSync(resolve(root, path)), path).toBe(true);
  }
  const makefiles = [readFileSync(resolve(root, 'Makefile'), 'utf8'), readFileSync(resolve(root, 'ui/classic/Makefile'), 'utf8')];
  for (const source of makefiles) expect(source).not.toMatch(/ui\/(?:vibes|tau)|ui-(?:vibes|tau)/);
});
