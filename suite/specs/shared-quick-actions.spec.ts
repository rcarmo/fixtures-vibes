/** Shared Quick actions contract (features/canonical/shared-ux.feature @ux-shared-003, 006). */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { quietTimelinePoint } from '../points';

/** Click a timeline point that is not a control, so focus is on noninteractive content. */
async function focusTimeline(page: Page, sel: (k: string) => string) {
  const point = await quietTimelinePoint(page, sel('timeline'));
  expect(point, 'a non-interactive timeline point').not.toBeNull();
  await page.mouse.click(point![0], point![1]);
}

const searchBox = (page: Page) => page.getByRole('textbox', { name: /jump|quick action|slash command/i });

test('@ux-shared-003 Type on the idle timeline to open Quick actions', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill('existing draft');
  await focusTimeline(page, sel);
  await page.keyboard.type('S');
  await expect(searchBox(page)).toHaveCount(1);
  await expect(searchBox(page)).toBeFocused();
  await expect(searchBox(page)).toHaveValue('S');

  // An exact title is preferred over a longer prefix match; the highlight wraps in both directions.
  const highlight = page.locator(sel('quickActionHighlight'));
  await searchBox(page).fill('/abort');
  await expect(highlight).toHaveCount(1);
  await expect(highlight).toContainText(/\/abort(?!-)/);
  const text = async () => ((await highlight.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  // The palette re-renders after a query change or key press; read the highlight once it is stable.
  const settled = async () => {
    let value = '';
    await expect.poll(async () => {
      const first = await text();
      await page.waitForTimeout(150);
      value = await text();
      return first === value && value !== '';
    }).toBe(true);
    return value;
  };
  const first = await settled();
  await page.keyboard.press('ArrowDown');
  const second = await settled();
  expect(second, 'the "/abort" query matches at least two results').not.toBe(first);
  await page.keyboard.press('ArrowUp');
  expect(await settled()).toBe(first);
  await page.keyboard.press('ArrowUp');
  expect(await settled(), 'ArrowUp from the first result wraps to the last').not.toBe(first);
  await page.keyboard.press('ArrowDown');
  expect(await settled(), 'ArrowDown from the last result wraps to the first').toBe(first);

  // Enter runs the highlighted action once and keeps the composer draft.
  await searchBox(page).fill('Show workspace');
  // Wait until the highlight has settled on the action (the filtered list may re-render after the query changes).
  await expect.poll(async () => (await settled()).includes('Show workspace')).toBe(true);
  await page.keyboard.press('Enter');
  await expect(searchBox(page)).toHaveCount(0);
  await expect(page.getByRole('complementary').filter({ hasText: /workspace/i }).first()).toBeVisible();
  await expect(input).toHaveValue('existing draft');
});

for (const dismissal of ['Escape', 'outside pointer'] as const) {
  test(`@ux-shared-006 Dismiss Quick actions without side effects: ${dismissal}`, async ({ page, runtime, sel }) => {
    const session = await runtime.newSession();
    await page.goto(session.url);
    const input = page.locator(sel('composeInput'));
    await input.fill('existing draft');
    await focusTimeline(page, sel);
    await page.keyboard.type('x');
    await expect(searchBox(page)).toBeFocused();
    if (dismissal === 'Escape') await page.keyboard.press('Escape');
    else await page.mouse.click(5, 5);
    await expect(searchBox(page)).toHaveCount(0);
    await expect(input).toHaveValue('existing draft');
    expect(page.url()).toContain(encodeURIComponent(session.id));
    await expect(page.getByRole('complementary').filter({ hasText: /workspace/i }).first()).toBeHidden();
  });
}

/** The surfaces a runtime offers on a fresh session, each focused and ready to receive a typed character. */
const surfaces: Record<string, (page: Page, sel: (k: string) => string) => Promise<() => Promise<void>>> = {
  'composer textarea': async (page, sel) => {
    const input = page.locator(sel('composeInput'));
    await input.focus();
    return async () => expect(input).toHaveValue('k');
  },
  'input or select': async page => {
    await page.getByRole('button', { name: /manage sessions|sessions/i }).first().click();
    const search = page.getByRole('searchbox', { name: /search sessions/i });
    await search.focus();
    return async () => expect(search).toHaveValue('k');
  },
  'button or link': async page => {
    const button = page.getByRole('button', { name: /^menu$|workspace menu/i }).first();
    await button.focus();
    return async () => expect(button).toBeFocused();
  },
  'workspace sidebar': async page => {
    await page.getByRole('button', { name: /^menu$|workspace menu/i }).first().click();
    await page.getByRole('menuitem', { name: /show workspace/i }).click();
    const sidebar = page.getByRole('complementary').filter({ hasText: /workspace/i }).first();
    const control = sidebar.locator('button:visible, [tabindex="0"]:visible, input:visible').first();
    await control.focus();
    return async () => expect(sidebar).toBeVisible();
  },
  'session or model picker': async page => {
    await page.getByRole('button', { name: /manage sessions|sessions/i }).first().click();
    const option = page.getByRole('option').or(page.getByRole('menuitem')).first();
    await option.focus();
    return async () => expect(page.getByRole('option').or(page.getByRole('menuitem')).first()).toBeVisible();
  },
};

for (const [surface, prepare] of Object.entries(surfaces)) {
  test(`@ux-shared-004 Do not steal typing from an interactive surface: ${surface}`, async ({ page, runtime, sel }) => {
    await page.goto((await runtime.newSession()).url);
    await expect(page.locator(sel('composeInput'))).toBeVisible();
    const received = await prepare(page, sel);
    await page.keyboard.type('k');
    await page.waitForTimeout(300);
    await expect(searchBox(page)).toHaveCount(0);
    await received();
  });
}

/** Keys that must not open Quick actions from noninteractive timeline content. */
const ignoredKeys: Record<string, (page: Page) => Promise<void>> = {
  whitespace: page => page.keyboard.press('Space'),
  'Control-modified': page => page.keyboard.press('Control+k'),
  'Meta-modified': page => page.keyboard.press('Meta+k'),
  'Alt-modified': page => page.keyboard.press('Alt+k'),
  // Repeat and IME composition flags cannot be produced by the Playwright keyboard; these are dispatched events, and a
  // plain dispatched key is checked below to open Quick actions, so the handler does accept dispatched events.
  repeated: page => page.evaluate(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', repeat: true, bubbles: true, cancelable: true }))),
  composing: page => page.evaluate(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', isComposing: true, keyCode: 229, bubbles: true, cancelable: true }))),
  'already prevented': async page => {
    await page.evaluate(() => (window as any).__preventNext = true);
    await page.keyboard.press('k');
  },
};

test('@ux-shared-005 Ignore consumed, modified and composing keys', async ({ page, runtime, sel }) => {
  // Installed before the app so it runs first and consumes the key, as another component would.
  await page.addInitScript(() => window.addEventListener('keydown', e => {
    if ((window as any).__preventNext) { (window as any).__preventNext = false; e.preventDefault(); }
  }, { capture: true }));
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill('existing draft');
  const failures: string[] = [];
  for (const [kind, press] of Object.entries(ignoredKeys)) {
    await focusTimeline(page, sel);
    await press(page);
    await page.waitForTimeout(300);
    if (await searchBox(page).count()) { failures.push(kind); await page.keyboard.press('Escape'); }
  }
  // Control: a plain dispatched printable key does open Quick actions.
  await focusTimeline(page, sel);
  await page.evaluate(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true })));
  await expect(searchBox(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(input).toHaveValue('existing draft');
  expect(failures, 'keys that opened Quick actions').toEqual([]);
});
