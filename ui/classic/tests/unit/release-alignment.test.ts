import { expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { patchAboutDialog } from '../../scripts/patch-about-dialog.mjs';
const root = new URL('../..', import.meta.url).pathname;

test('About retains the release focus/dialog implementation and uses shared runtime config', () => {
  const original = readFileSync(`${root}/piclaw/web-3.3.4/web/src/components/about-dialog.ts`, 'utf8');
  const adapted = patchAboutDialog(original);
  expect(adapted).toContain("fetch('/api/runtime/config'");
  expect(adapted).not.toContain("fetch('/agent/about'");
  expect(adapted).toContain("typeof data?.version === 'string'");
  expect(adapted).toContain("classic: 'Piclaw v3.3.4-ux'");
  expect(adapted).toContain("event.key === 'Tab'");
  expect(adapted).toContain('controller.abort();');
  expect(() => patchAboutDialog('drift')).toThrow();
  expect(() => patchAboutDialog(original + original)).toThrow();
  expect(() => patchAboutDialog(adapted)).toThrow();
});

test('Adaptive Cards are reproducibly built at the SDK loader URL', () => {
  const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'));
  const build = readFileSync(`${root}/build.js`, 'utf8');
  expect(pkg.dependencies.adaptivecards).toBe('3.0.6');
  expect(build).toContain('static/common/js/vendor/adaptivecards.min.js');
  expect(existsSync(`${root}/static/common/js/vendor/adaptivecards.min.js`)).toBe(true);
  expect(existsSync(`${root}/static/js/vendor/adaptivecards.min.js`)).toBe(false);
});
