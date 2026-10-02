/**
 * Picker search, typeahead and keyboard (features/canonical/shared-ux.feature @ux-shared-021).
 * Model picker: only fixture models are ever highlighted for activation; the reference also lists billable models.
 */
import { test, expect } from '../fixtures';
import type { Locator, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const highlighted = (list: Locator) => list.locator('[role=option][aria-selected=true]');

/** Move focus off the search field onto the picker container (its nearest focusable ancestor), keeping it open. */
async function leaveSearch(page: Page, list: Locator) {
  await list.evaluate(el => (el.closest('[tabindex]') as HTMLElement | null ?? el as HTMLElement).focus());
  await expect(list).toBeVisible();
  await expect(page.getByRole('searchbox').or(page.getByRole('combobox')).first()).not.toBeFocused();
}

test('@ux-shared-021 Find and activate picker entries without changing unsupported state: session picker', async ({ page, runtime }) => {
  const n = randomUUID().replace(/-/g, '').slice(0, 6).replace(/^\d/, 'q');
  const home = await runtime.newSession();
  await runtime.newSession(`zz-ta${n}`);
  const prefix = await runtime.newSession(`ta${n}`);
  await page.goto(home.url);
  const opener = page.getByRole('button', { name: /manage sessions/i }).first();
  const list = page.getByTestId('session-popup').getByRole('listbox');
  const search = page.getByRole('searchbox', { name: /search sessions/i });

  // Search by native identifier: only matching entries remain.
  await opener.click();
  await search.fill(`zz-ta${n}`);
  await expect(list.getByRole('option')).toHaveCount(1);
  await search.fill(`ta${n}`);
  await expect(list.getByRole('option')).toHaveCount(2);

  // Typeahead outside the search field prefers the prefix match; keys move within the results.
  await search.fill('');
  await leaveSearch(page, list);
  await page.keyboard.type(`ta${n}`);
  await expect(highlighted(list)).toHaveAccessibleName(new RegExp(`^@ta${n}\\b`));
  await expect(list.getByRole('option')).toHaveCount(2);
  for (const [key, name] of [['ArrowDown', `zz-ta${n}`], ['Home', `ta${n}`], ['End', `zz-ta${n}`], ['PageUp', `ta${n}`], ['PageDown', `zz-ta${n}`], ['ArrowUp', `ta${n}`]] as const) {
    await page.keyboard.press(key);
    await expect(highlighted(list), key).toHaveAccessibleName(new RegExp(`^@${name}\\b`));
  }

  // Escape closes and restores focus without changing the session.
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(opener).toHaveAccessibleName(new RegExp(home.id.replace(/^[a-z]+:/, '')));

  // Enter activates the highlighted entry exactly once.
  await page.keyboard.press('Enter');
  await search.fill(`ta${n}`);
  await expect(highlighted(list)).toHaveAccessibleName(new RegExp(`^@ta${n}\\b`));
  await page.keyboard.press('Enter');
  await expect(opener).toHaveAccessibleName(new RegExp(`@ta${n}\\b`));
  await page.waitForTimeout(1000);
  await expect(opener).toHaveAccessibleName(new RegExp(`@ta${n}\\b`));
  expect(prefix.id).toContain(`ta${n}`);
});

test('@ux-shared-021 Find and activate picker entries without changing unsupported state: model picker', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  await page.goto((await runtime.newSession()).url);
  const composer = page.locator(sel('composeInput'));
  await composer.fill(`[reply:warm-${n}] warm ${n}`);
  await composer.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `warm-${n}` })).toHaveCount(1);
  const opener = page.getByRole('button', { name: /model picker/i }).first();
  await expect(opener).toContainText(/fixture-1|fixture model$/i);
  const list = page.getByRole('listbox', { name: /models/i });
  // aria-selected marks the current model; the keyboard highlight is the combobox's active descendant.
  const activeName = async () => {
    const id = await page.getByRole('combobox').first().getAttribute('aria-activedescendant');
    return id ? (await list.locator(`[id="${id}"]`).getAttribute('aria-label')) ?? '' : '';
  };
  const fixtureOnly = async () => {
    for (const name of await list.getByRole('option').evaluateAll(els => els.map(e => e.getAttribute('aria-label') ?? (e as HTMLElement).innerText))) {
      expect(name, 'filtered list holds only fixture models').toMatch(/^fixture/i);
    }
  };

  // Search by display name: only the fixture models remain.
  await opener.click();
  await page.keyboard.type('fixture');
  await expect(list.getByRole('option')).toHaveCount(2);
  await fixtureOnly();

  // 3.2.5's model picker keeps focus in its search combobox (no out-of-search typeahead; Home/End move the caret),
  // so its keys are Arrow and Page keys within the (fixture-only) results.
  await expect.poll(activeName).toMatch(/^fixture model(?! two)/i);
  for (const [key, two] of [['ArrowDown', true], ['ArrowUp', false], ['PageDown', true], ['PageUp', false]] as const) {
    await page.keyboard.press(key);
    await expect.poll(activeName, { message: key }).toMatch(two ? /^fixture model two/i : /^fixture model(?! two)/i);
  }
  await fixtureOnly();

  // Escape closes and restores focus without changing the model.
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(opener).toContainText(/fixture-1|fixture model$/i);

  // Enter activates the highlighted fixture entry exactly once.
  await opener.click();
  await page.keyboard.type('fixture-2');
  await expect(list.getByRole('option')).toHaveCount(1);
  await fixtureOnly();
  await expect.poll(activeName).toMatch(/^fixture model two/i);
  await page.keyboard.press('Enter');
  await expect(opener).toContainText(/fixture-2|fixture model two/i);
  await composer.fill(`[reply:after-${n}] after ${n}`);
  await composer.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `after-${n}` })).toHaveCount(1);
  const turns = (await runtime.modelLog()).filter(e => !e.toolFollowUp && e.prompt.includes(`after ${n}`));
  expect(turns.map(e => e.model)).toEqual(['fixture-2']);
});
