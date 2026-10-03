/**
 * Picker search, typeahead and keyboard (features/canonical/shared-ux.feature @ux-shared-021).
 * Model picker: only fixture models are ever highlighted for activation; the reference also lists billable models.
 */
import { ENTRY, entries, highlighted, modelList, sessionList, nameRe, MODEL_ONE, MODEL_TWO } from '../pickers';
import { test, expect } from '../fixtures';
import type { Locator, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

/** Move focus off the search field onto the picker container (its nearest focusable ancestor), keeping it open. */
async function leaveSearch(page: Page, list: Locator) {
  await list.evaluate(el => (el.closest('[tabindex]') as HTMLElement | null ?? el as HTMLElement).focus());
  await expect(list).toBeVisible();
  await expect(page.getByRole('searchbox').or(page.getByRole('combobox')).first()).not.toBeFocused();
}

for (const [id, name] of [
  ['@ux-shared-021', 'Find and activate picker entries without changing unsupported state'],
  ['@ux-original-021', 'Navigate the Classic picker lists'],
] as const) test(`${id} ${name}: session picker`, async ({ page, runtime, sel }) => {
  const n = randomUUID().replace(/-/g, '').slice(0, 6).replace(/^\d/, 'q');
  // The home name shares nothing with n: typeahead may match loosely.
  const homeName = `fh${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const home = await runtime.newSession(homeName);
  await runtime.newSession(`zz-ta${n}`);
  await runtime.newSession(`ta${n}`);
  await page.goto(home.url);
  const opener = page.getByRole('button', { name: /manage sessions/i }).first();
  const list = sessionList(page);
  const search = page.getByRole('searchbox', { name: /search sessions/i });

  // Search by native identifier: only matching entries remain.
  await opener.click();
  await search.fill(`zz-ta${n}`);
  await expect(list.locator(ENTRY)).toHaveCount(1);
  await search.fill(`ta${n}`);
  await expect(list.locator(ENTRY)).toHaveCount(2);

  // Typeahead outside the search field prefers the prefix match; keys move within the results.
  await search.fill('');
  // Let the full list come back before typing, so no keystroke lands mid-render.
  await expect.poll(() => list.locator(ENTRY).count()).toBeGreaterThan(2);
  await leaveSearch(page, list);
  await page.keyboard.type(`ta${n}`, { delay: 50 });
  // Only the highlight is contract: runtimes may or may not also filter the list while typing ahead.
  await expect(highlighted(list, sel)).toHaveAccessibleName(nameRe(`ta${n}`));

  // Keys move within the search results.
  await search.fill(`ta${n}`);
  await expect(list.locator(ENTRY)).toHaveCount(2);
  await leaveSearch(page, list);
  for (const [key, name] of [['Home', `ta${n}`], ['ArrowDown', `zz-ta${n}`], ['End', `zz-ta${n}`], ['PageUp', `ta${n}`], ['PageDown', `zz-ta${n}`], ['ArrowUp', `ta${n}`]] as const) {
    await page.keyboard.press(key);
    await expect(highlighted(list, sel), key).toHaveAccessibleName(nameRe(name));
  }

  // Escape closes and restores focus without changing the session.
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(opener).toHaveAccessibleName(nameRe(homeName));

  // Enter activates the highlighted entry exactly once. (Reopening is not under test here.)
  await opener.click();
  await search.fill(`ta${n}`);
  await expect(highlighted(list, sel)).toHaveAccessibleName(nameRe(`ta${n}`));
  await page.keyboard.press('Enter');
  await expect(opener).toHaveAccessibleName(nameRe(`ta${n}`));
  await page.waitForTimeout(1000);
  await expect(opener).toHaveAccessibleName(nameRe(`ta${n}`));
});

for (const [id, name] of [
  ['@ux-shared-021', 'Find and activate picker entries without changing unsupported state'],
  ['@ux-original-021', 'Navigate the Classic picker lists'],
] as const) test(`${id} ${name}: model picker`, async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  await page.goto((await runtime.newSession()).url);
  const composer = page.locator(sel('composeInput'));
  await composer.fill(`[reply:warm-${n}] warm ${n}`);
  await composer.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `warm-${n}` })).toHaveCount(1);
  const opener = page.getByRole('button', { name: /model picker/i }).first();
  await expect(opener).toContainText(MODEL_ONE);
  const list = modelList(page);
  // aria-selected marks the current model; the keyboard highlight is the combobox's active descendant.
  // The search combobox that controls the model list (a <select>, e.g. Thinking level, is also a combobox).
  const modelSearch = async () => {
    const listId = await list.getAttribute('id');
    const owner = listId ? page.locator(`[role=combobox][aria-controls="${listId}"]`) : page.getByRole('combobox');
    return (await owner.count()) ? owner.first() : page.getByRole('combobox').first();
  };
  const activeName = async () => {
    // A combobox points at the highlight with aria-activedescendant; a menu moves focus to it instead.
    const id = await (await modelSearch()).getAttribute('aria-activedescendant');
    const active = id ? list.locator(`[id="${id}"]`) : list.locator(ENTRY).and(list.locator(':focus'));
    if (!(await active.count())) return '';
    return (await active.first().getAttribute('aria-label')) ?? (await active.first().innerText());
  };
  const fixtureOnly = async () => {
    for (const name of await list.locator(ENTRY).evaluateAll(els => els.map(e => e.getAttribute('aria-label') ?? (e as HTMLElement).innerText))) {
      expect(name, 'filtered list holds only fixture models').toMatch(/^fixture/i);
    }
  };

  // Search by display name: only the fixture models remain.
  await opener.click();
  await expect(list).toBeVisible();
  await expect(await modelSearch()).toBeFocused();
  await page.keyboard.type('fixture');
  await expect(list.locator(ENTRY)).toHaveCount(2);
  await fixtureOnly();

  // 3.2.5's model picker keeps focus in its search combobox (no out-of-search typeahead; Home/End move the caret),
  // so its keys are Arrow and Page keys within the (fixture-only) results.
  await expect.poll(activeName).toMatch(MODEL_ONE);
  for (const [key, two] of [['ArrowDown', true], ['ArrowUp', false], ['PageDown', true], ['PageUp', false]] as const) {
    await page.keyboard.press(key);
    await expect.poll(activeName, { message: key }).toMatch(two ? MODEL_TWO : MODEL_ONE);
  }
  await fixtureOnly();
  if (id === '@ux-original-021') {
    // With focus in the search input, Home/End need Control or Meta to move the highlight.
    await page.keyboard.press('Control+End');
    await expect.poll(activeName).toMatch(MODEL_TWO);
    await page.keyboard.press('Control+Home');
    await expect.poll(activeName).toMatch(MODEL_ONE);
  }

  // Escape closes and restores focus without changing the model.
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(opener).toContainText(MODEL_ONE);

  // Enter activates the highlighted fixture entry exactly once.
  await opener.click();
  await expect(list).toBeVisible();
  await expect(await modelSearch()).toBeFocused();
  await page.keyboard.type('fixture-2');
  await expect(list.locator(ENTRY)).toHaveCount(1);
  await fixtureOnly();
  await expect.poll(activeName).toMatch(MODEL_TWO);
  await page.keyboard.press('Enter');
  await expect(opener).toContainText(MODEL_TWO);
  await composer.fill(`[reply:after-${n}] after ${n}`);
  await composer.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `after-${n}` })).toHaveCount(1);
  const turns = (await runtime.modelLog()).filter(e => !e.toolFollowUp && e.prompt.includes(`after ${n}`));
  expect(turns.map(e => e.model)).toEqual(['fixture-2']);
});
