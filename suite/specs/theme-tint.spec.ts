/**
 * Classic /theme and /tint commands (features/classic/compose/theme-tint.feature).
 * Theme state persists on the runtime, so every test restores "/theme default" (which also clears the tint).
 */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

type Sel = (k: string) => string;
const state = (page: Page) => page.evaluate(() => {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  return {
    theme: root.dataset.theme ?? '', color: root.dataset.colorTheme ?? '', tint: root.dataset.tint ?? '',
    bgVar: root.style.getPropertyValue('--bg-primary').trim(), accentVar: root.style.getPropertyValue('--accent-color').trim(),
    bgComputed: css.getPropertyValue('--bg-primary').trim(), accentComputed: css.getPropertyValue('--accent-color').trim(),
    storedTheme: localStorage.getItem('piclaw_theme'), storedTint: localStorage.getItem('piclaw_tint') ?? '',
    background: getComputedStyle(document.body).backgroundColor,
  };
});

/** Send a slash command and wait for a new reply containing `expected`. */
async function run(page: Page, sel: Sel, command: string, expected: RegExp) {
  const replies = page.locator(sel('timelinePost')).filter({ hasText: expected });
  const before = await replies.count();
  const input = page.locator(sel('composeInput'));
  await input.fill(command);
  // Send with the button: Enter may instead accept a slash-command suggestion once the suggestions open.
  await page.locator(sel('sendButton')).click();
  await expect(input).toHaveValue('');
  // Command replies go through the agent queue and can lag under load.
  await expect(replies).toHaveCount(before + 1, { timeout: 30_000 });
}

async function open(page: Page, runtime: any, sel: Sel) {
  await page.goto((await runtime.newSession()).url);
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await run(page, sel, '/theme default', /Theme set to/);
  return state(page);
}

test.afterEach(async ({ page, sel }) => {
  if (page.url().startsWith('http')) await run(page, sel, '/theme default', /Theme set to/).catch(() => {});
});

test('@ux-theme-001 /theme with no arguments shows available themes', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/theme', /Available themes/);
});

test('@ux-theme-002 /theme ristretto applies dark theme visually', async ({ page, runtime, sel }) => {
  const before = await open(page, runtime, sel);
  await run(page, sel, '/theme ristretto', /Theme set to/);
  const after = await state(page);
  expect(after.background).not.toBe(before.background);
  expect(after).toMatchObject({ theme: 'dark', color: 'ristretto', tint: '', storedTheme: 'ristretto' });
  expect(after.bgVar).not.toBe('');
  expect(after.accentVar).not.toBe('');
});

test('@ux-theme-003 /theme default restores from ristretto visually', async ({ page, runtime, sel }) => {
  const original = await open(page, runtime, sel);
  await run(page, sel, '/theme ristretto', /Theme set to/);
  const dark = await state(page);
  await run(page, sel, '/theme default', /Theme set to/);
  const after = await state(page);
  expect(after.background).not.toBe(dark.background);
  expect(after).toMatchObject({ color: 'default', tint: '', storedTheme: 'default' });
  // The untinted default no longer carries ristretto's values: what applies is the plain default again.
  expect(after.bgComputed).toBe(original.bgComputed);
  expect(after.accentComputed).toBe(original.accentComputed);
});

test('@ux-theme-004 /theme dark returns error — not a valid theme name', async ({ page, runtime, sel }) => {
  const before = await open(page, runtime, sel);
  await run(page, sel, '/theme dark', /Unknown theme/);
  const after = await state(page);
  expect({ theme: after.theme, color: after.color, background: after.background }).toEqual({ theme: before.theme, color: before.color, background: before.background });
});

test('@ux-theme-005 /theme survives page refresh', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/theme ristretto', /Theme set to/);
  await page.reload();
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await expect.poll(async () => (await state(page)).theme).toBe('dark');
  expect((await state(page)).storedTheme).toBe('ristretto');
});

test('@ux-theme-006 /tint hex changes accent and background on default theme', async ({ page, runtime, sel }) => {
  const before = await open(page, runtime, sel);
  await run(page, sel, '/tint #e11d48', /Tint set to/);
  const after = await state(page);
  expect(after).toMatchObject({ color: 'default', tint: '#e11d48' });
  expect(after.bgVar).not.toBe('');
  expect(after.bgComputed).not.toBe(before.bgComputed);
  expect(after.accentVar).not.toBe('');
  expect(after.storedTint).toContain('e11d48');
});

test('@ux-theme-007 /tint named color works on default theme', async ({ page, runtime, sel }) => {
  const before = await open(page, runtime, sel);
  await run(page, sel, '/tint orange', /Tint set to/);
  const after = await state(page);
  expect(after).toMatchObject({ color: 'default', tint: 'orange', storedTint: 'orange' });
  expect(after.bgComputed).not.toBe(before.bgComputed);
  expect(after.accentVar).not.toBe('');
});

test('@ux-theme-008 Switching tints visibly changes accent color', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/tint #e11d48', /Tint set to/);
  const first = await state(page);
  await run(page, sel, '/tint #3b82f6', /Tint set to/);
  const second = await state(page);
  expect(second.accentVar).not.toBe(first.accentVar);
  expect(second.bgVar).not.toBe(first.bgVar);
});

test('@ux-theme-009 /tint off clears tint and restores vanilla default', async ({ page, runtime, sel }) => {
  const original = await open(page, runtime, sel);
  await run(page, sel, '/tint #3b82f6', /Tint set to/);
  await run(page, sel, '/tint off', /Tint cleared/);
  const after = await state(page);
  expect(after).toMatchObject({ color: 'default', tint: '' });
  expect(after.bgComputed).toBe(original.bgComputed);
  expect(after.accentComputed).toBe(original.accentComputed);
});

test('@ux-theme-010 /tint with no args shows usage', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/tint', /Usage/);
});

test('@ux-theme-011 /tint invalid value returns error', async ({ page, runtime, sel }) => {
  const before = await open(page, runtime, sel);
  await run(page, sel, '/tint $$notacolor', /Invalid tint/);
  const after = await state(page);
  expect({ tint: after.tint, bg: after.bgComputed }).toEqual({ tint: before.tint, bg: before.bgComputed });
});

test('@ux-theme-012 /tint survives page refresh', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/tint #e11d48', /Tint set to/);
  const tinted = await state(page);
  await page.reload();
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await expect.poll(async () => (await state(page)).tint).not.toBe('');
  expect((await state(page)).bgVar).toBe(tinted.bgVar);
});

test('@ux-theme-013 Tint on default, switch to ristretto, switch back', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/tint #e11d48', /Tint set to/);
  await run(page, sel, '/theme ristretto', /Theme set to/);
  expect((await state(page)).color).toBe('ristretto');
  await run(page, sel, '/theme default', /Theme set to/);
  expect(await state(page)).toMatchObject({ color: 'default', tint: '' });
});

test('@ux-theme-014 /tint on ristretto switches to default+tint', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/theme ristretto', /Theme set to/);
  await run(page, sel, '/tint #3b82f6', /Tint set to/);
  expect(await state(page)).toMatchObject({ color: 'default', tint: '#3b82f6' });
});

test('@ux-theme-015 Round-trip visual consistency', async ({ page, runtime, sel }) => {
  const original = await open(page, runtime, sel);
  await run(page, sel, '/tint #e11d48', /Tint set to/);
  const tinted = await state(page);
  expect(tinted.background).not.toBe(original.background);
  await run(page, sel, '/theme ristretto', /Theme set to/);
  const dark = await state(page);
  expect(dark.background).not.toBe(tinted.background);
  await run(page, sel, '/theme default', /Theme set to/);
  expect((await state(page)).background).toBe(original.background);
});
