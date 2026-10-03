/**
 * Shared shell and session-picker contract (features/canonical/shared-ux.feature @ux-shared-001, 002, 013).
 */
import { test, expect } from '../fixtures';
import { searchField } from '../pickers';
import { quietTimelinePoint } from '../points';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const menuButton = (page: Page) => page.getByRole('button', { name: /^menu$|workspace menu/i }).first();
const focusedTag = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement | null;
  return el && el !== document.body ? `${el.tagName.toLowerCase()}:${el.getAttribute('aria-label') ?? el.getAttribute('role') ?? ''}` : 'body';
});

for (const id of ['@ux-shared-001', '@ux-original-001'] as const) for (const [input, dismissal] of [['pointer', 'outside pointer'], ['keyboard', 'Escape']] as const) {
  test(`${id} Open and dismiss the workspace menu: ${input} / ${dismissal}`, async ({ page, runtime, sel }) => {
    await page.goto((await runtime.newSession()).url);
    await expect(page.locator(sel('composeInput'))).toBeVisible();
    const url = page.url();
    await expect(page.getByRole('menu')).toHaveCount(0);

    if (input === 'pointer') await menuButton(page).click();
    else { await menuButton(page).focus(); await page.keyboard.press('Enter'); }
    await expect(page.getByRole('menu')).toHaveCount(1);
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'true');
    for (const item of await page.getByRole('menu').getByRole('menuitem').all()) {
      if (await item.isDisabled()) continue;
      await item.focus();
      await expect(item).toBeFocused();
    }

    if (dismissal === 'Escape') await page.keyboard.press('Escape');
    else {
      // Dismiss on a timeline point that is neither a control nor part of the open menu, so nothing underneath activates.
      const point = await quietTimelinePoint(page, sel('timeline'), 'bottom-up');
      expect(point, 'a non-interactive timeline point').not.toBeNull();
      const [x, y] = point!;
      await page.mouse.click(x, y);
    }
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
    expect(page.url()).toBe(url);
    // After keyboard dismissal focus returns to the menu button. A pointer dismissal leaves focus where the browser
    // puts it for a click on non-focusable content.
    // (@ux-original-001 requires only that the menu opens and closes.)
    if (dismissal === 'Escape' && id === '@ux-shared-001') await expect(menuButton(page), `focus after Escape: ${await focusedTag(page)}`).toBeFocused();
  });
}

for (const [id, name] of [
  ['@ux-shared-002', 'Show and hide the native workspace'],
  ['@ux-original-002', 'Toggle workspace visibility without submitting the draft'],
] as const) test(`${id} ${name}`, async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const session = await runtime.newSession();
  await page.goto(session.url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`unsent ${n}`);
  await menuButton(page).click();
  await page.getByRole('menuitem', { name: /show workspace/i }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('complementary').filter({ hasText: /workspace/i }).first()).toBeVisible();
  await menuButton(page).click();
  await page.getByRole('menuitem', { name: /hide workspace/i }).click();
  // Hidden may mean removed or collapsed to zero size.
  await expect(page.getByRole('complementary').filter({ hasText: /workspace/i }).first()).toBeHidden();
  await expect(input).toHaveValue(`unsent ${n}`);
  expect(page.url()).toContain(encodeURIComponent(session.id));
});

for (const [id, name] of [
  ['@ux-shared-013', 'Open, search and dismiss the session picker'],
  ['@ux-original-013', 'Open and dismiss the Classic session picker'],
] as const) for (const input of ['pointer', 'keyboard'] as const) {
  test(`${id} ${name}: ${input}`, async ({ page, runtime, sel }) => {
    const other = await runtime.newSession();
    const mine = await runtime.newSession();
    await page.goto(mine.url);
    await expect(page.locator(sel('composeInput'))).toBeVisible();
    const trigger = page.getByRole('button', { name: /manage sessions|sessions/i }).first();
    if (input === 'pointer') await trigger.click();
    else { await trigger.focus(); await page.keyboard.press('Enter'); }
    const search = searchField(page, /search sessions/i);
    await expect(search).toBeFocused();
    const key = (id: string) => id.replace(/^[a-z]+:/, '');
    for (const s of [mine, other]) {
      await search.fill(key(s.id));
      const name = new RegExp(key(s.id));
      await expect(page.getByRole('option', { name }).or(page.getByRole('menuitem', { name })).first()).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(search).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(page.url()).toContain(encodeURIComponent(mine.id));
  });
}
