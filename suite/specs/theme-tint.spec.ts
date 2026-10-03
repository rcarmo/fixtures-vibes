/**
 * Classic /theme and /tint commands (features/classic/compose/theme-tint.feature), judged by what a user sees: the page
 * background and the accent colour (the send button under the pointer, with a message ready).
 * Theme state persists on the runtime, so every test restores "/theme default" (which also clears the tint).
 */
import { test, expect } from '../fixtures';
import { rgb } from '../colour';
import type { Page } from '@playwright/test';

type Sel = (k: string) => string;
type Look = { background: string; accent: string; dark: boolean };
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

/** What the page looks like now: background, accent (hovered send button with a draft), and whether it is dark. */
async function appearance(page: Page, sel: Sel): Promise<Look> {
  const input = page.locator(sel('composeInput'));
  const draft = await input.inputValue();
  await input.fill('x');
  // The accent shows on the send button under the pointer; it animates, so read once it is opaque and has settled.
  await page.locator(sel('sendButton')).hover();
  const read = () => page.locator(sel('sendButton')).evaluate(e => getComputedStyle(e).backgroundColor);
  let accent = '';
  await expect.poll(async () => {
    const first = await read();
    await page.waitForTimeout(300);
    accent = await read();
    return first === accent && !/rgba\(0, 0, 0, 0\)|transparent/.test(accent);
  }).toBe(true);
  await input.fill(draft);
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = rgb(background);
  return { background, accent: rgb(accent).join(','), dark: 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 };
}

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
  await expect(replies).toHaveCount(before + 1, { timeout: 60_000 });
}

async function open(page: Page, runtime: any, sel: Sel) {
  await page.goto((await runtime.newSession()).url);
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await run(page, sel, '/theme default', /Theme set to/);
  return appearance(page, sel);
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
  const after = await appearance(page, sel);
  expect(after.dark).toBe(true);
  expect(after.accent).not.toBe(before.accent);
});

test('@ux-theme-003 /theme default restores from ristretto visually', async ({ page, runtime, sel }) => {
  const original = await open(page, runtime, sel);
  await run(page, sel, '/theme ristretto', /Theme set to/);
  await run(page, sel, '/theme default', /Theme set to/);
  expect(await appearance(page, sel)).toEqual(original);
});

test('@ux-theme-004 /theme dark returns error — not a valid theme name', async ({ page, runtime, sel }) => {
  const before = await open(page, runtime, sel);
  await run(page, sel, '/theme dark', /Unknown theme/);
  expect(await appearance(page, sel)).toEqual(before);
});

test('@ux-theme-005 /theme survives page refresh', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/theme ristretto', /Theme set to/);
  const dark = await appearance(page, sel);
  await page.reload();
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  expect(await appearance(page, sel)).toEqual(dark);
});

test('@ux-theme-006 /tint hex changes accent and background on default theme', async ({ page, runtime, sel }) => {
  const before = await open(page, runtime, sel);
  await run(page, sel, '/tint #e11d48', /Tint set to/);
  const after = await appearance(page, sel);
  expect(after.accent).toBe(hex('#e11d48').join(','));
  expect(after.background).not.toBe(before.background);
});

test('@ux-theme-007 /tint named color works on default theme', async ({ page, runtime, sel }) => {
  const before = await open(page, runtime, sel);
  await run(page, sel, '/tint orange', /Tint set to/);
  const after = await appearance(page, sel);
  expect(after.accent).not.toBe(before.accent);
  expect(after.background).not.toBe(before.background);
});

test('@ux-theme-008 Switching tints visibly changes accent color', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/tint #e11d48', /Tint set to/);
  const first = await appearance(page, sel);
  await run(page, sel, '/tint #3b82f6', /Tint set to/);
  const second = await appearance(page, sel);
  expect(second.accent).not.toBe(first.accent);
  expect(second.background).not.toBe(first.background);
});

test('@ux-theme-009 /tint off clears tint and restores vanilla default', async ({ page, runtime, sel }) => {
  const original = await open(page, runtime, sel);
  await run(page, sel, '/tint #3b82f6', /Tint set to/);
  await run(page, sel, '/tint off', /Tint cleared/);
  expect(await appearance(page, sel)).toEqual(original);
});

test('@ux-theme-010 /tint with no args shows usage', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/tint', /Usage/);
});

test('@ux-theme-011 /tint invalid value returns error', async ({ page, runtime, sel }) => {
  const before = await open(page, runtime, sel);
  await run(page, sel, '/tint $$notacolor', /Invalid tint/);
  expect(await appearance(page, sel)).toEqual(before);
});

test('@ux-theme-012 /tint survives page refresh', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/tint #e11d48', /Tint set to/);
  const tinted = await appearance(page, sel);
  await page.reload();
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  expect(await appearance(page, sel)).toEqual(tinted);
});

test('@ux-theme-013 Tint on default, switch to ristretto, switch back', async ({ page, runtime, sel }) => {
  const original = await open(page, runtime, sel);
  await run(page, sel, '/tint #e11d48', /Tint set to/);
  await run(page, sel, '/theme ristretto', /Theme set to/);
  expect((await appearance(page, sel)).dark).toBe(true);
  await run(page, sel, '/theme default', /Theme set to/);
  expect(await appearance(page, sel)).toEqual(original);
});

test('@ux-theme-014 /tint on ristretto switches to default+tint', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await run(page, sel, '/theme ristretto', /Theme set to/);
  await run(page, sel, '/tint #3b82f6', /Tint set to/);
  const after = await appearance(page, sel);
  expect(after.dark).toBe(false);
  expect(after.accent).toBe(hex('#3b82f6').join(','));
});

test('@ux-theme-015 Round-trip visual consistency', async ({ page, runtime, sel }) => {
  const original = await open(page, runtime, sel);
  await run(page, sel, '/tint #e11d48', /Tint set to/);
  const tinted = await appearance(page, sel);
  expect(tinted.background).not.toBe(original.background);
  await run(page, sel, '/theme ristretto', /Theme set to/);
  expect((await appearance(page, sel)).background).not.toBe(tinted.background);
  await run(page, sel, '/theme default', /Theme set to/);
  expect(await appearance(page, sel)).toEqual(original);
});
