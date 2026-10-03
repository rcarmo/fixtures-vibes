/**
 * Shared model picker contract (features/canonical/shared-ux.feature @ux-shared-020).
 * Only fixture models are ever selected: reference instances may list real, billable providers too.
 */
import { ENTRY, entries, modelList, sessionList, nameRe, MODEL_ONE, MODEL_TWO } from '../pickers';
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { holdWrites, bodyHas } from '../net';

const modelButton = (page: Page) => page.getByRole('button', { name: /model picker/i }).first();

/** The model the fixture server saw for the turn carrying this nonce. */
const modelUsed = async (runtime: any, n: string) =>
  (await runtime.modelLog()).filter((e: any) => !e.toolFollowUp && String(e.prompt).includes(n)).map((e: any) => String(e.model));

for (const [id, name] of [
  ['@ux-shared-020', 'Search and select a model authoritatively'],
  ['@ux-original-020', 'Select a model for the selected chat'],
] as const) for (const input of ['pointer', 'keyboard'] as const) {
  test(`${id} ${name}: ${input}`, async ({ page, runtime, sel }) => {
    const n = randomUUID().slice(0, 8);
    const other = await runtime.newSession();
    const main = await runtime.newSession();
    await page.goto(main.url);
    const composer = page.locator(sel('composeInput'));
    await composer.fill(`unsent ${n}`);
    if (id === '@ux-original-020') {
      // A rejected request declares nothing: the previous model and the draft stay (3.2.5 shows no message).
      const rejected = await holdWrites(page, bodyHas('fixture-2'), { status: 500, error: `rejected-${n}` });
      await modelButton(page).click();
      await page.keyboard.type('fixture-2');
      await modelList(page).locator(ENTRY).filter({ hasText: MODEL_TWO }).click();
      await expect.poll(() => rejected.count).toBe(1);
      rejected.release();
      await page.waitForTimeout(1000);
      await expect(modelButton(page)).not.toContainText(MODEL_TWO);
      await expect(composer).toHaveValue(`unsent ${n}`);
      rejected.disarm();
      if (await modelList(page).count()) await page.keyboard.press('Escape');
      await expect(modelList(page)).toHaveCount(0);
    }

    if (input === 'pointer') await modelButton(page).click();
    else { await modelButton(page).focus(); await page.keyboard.press('Enter'); }
    await expect(modelList(page)).toBeVisible();
    await page.keyboard.type('fixture-2');
    const second = modelList(page).locator(ENTRY).filter({ hasText: MODEL_TWO });
    await expect(second).toHaveCount(1);
    if (input === 'pointer') await second.click();
    else {
      // Enter acts on the highlighted entry; wait until the search field's active descendant is the filtered option.
      const id = await second.getAttribute('id');
      await expect(page.getByRole('combobox').first()).toHaveAttribute('aria-activedescendant', id!);
      await page.keyboard.press('Enter');
    }
    // The switch may be a rate-limited chat command; allow for the suite's 429 backoff.
    await expect(modelList(page)).toHaveCount(0, { timeout: 40_000 });
    await expect(modelButton(page)).toContainText(MODEL_TWO);
    await expect(composer).toHaveValue(`unsent ${n}`);

    // The next turn uses the selected model; the choice survives reload for this session only.
    await composer.fill(`[reply:ok-${n}] use ${n}`);
    await composer.press('Enter');
    await expect(page.locator(sel('agentPost')).filter({ hasText: `ok-${n}` })).toHaveCount(1);
    expect(await modelUsed(runtime, n)).toEqual(['fixture-2']);
    await page.reload();
    await expect(modelButton(page)).toContainText(MODEL_TWO);
    // Only this session changed: the other session's next turn still uses the default fixture model.
    await page.goto(other.url);
    await expect(modelButton(page)).not.toContainText(MODEL_TWO);
    const m = randomUUID().slice(0, 8);
    await page.locator(sel('composeInput')).fill(`[reply:ok-${m}] use ${m}`);
    await page.locator(sel('composeInput')).press('Enter');
    await expect(page.locator(sel('agentPost')).filter({ hasText: `ok-${m}` })).toHaveCount(1);
    expect(await modelUsed(runtime, m)).toEqual(['fixture-1']);
  });
}

for (const [id, name] of [
  ['@ux-shared-022', 'Reject stale or unsupported model state'],
  ['@ux-original-022', 'Render model capabilities without inventing values'],
] as const) test(`${id} ${name}`, async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const key = `fr${n.replace(/-/g, '')}`;
  const research = await runtime.newSession(key);
  const main = await runtime.newSession();
  const composer = page.locator(sel('composeInput'));
  const pickFixtureTwo = async () => {
    await modelButton(page).click();
    await expect(modelList(page)).toBeVisible();
    await page.keyboard.type('fixture-2');
    await modelList(page).locator(ENTRY).filter({ hasText: MODEL_TWO }).click();
  };
  // A turn in each session, so both show an authoritative model label.
  for (const s of [research, main]) {
    await page.goto(s.url);
    await composer.fill(`[reply:warm-${n}] warm ${n}`);
    await composer.press('Enter');
    await expect(page.locator(sel('agentPost')).filter({ hasText: `warm-${n}` })).toHaveCount(1);
    await expect(modelButton(page)).toContainText(MODEL_ONE);
  }

  // A switch is pending for "main" when the view moves to "research"; the late result must not relabel "research".
  const pending = await holdWrites(page, bodyHas('fixture-2'));
  await pickFixtureTwo();
  await expect.poll(() => pending.count).toBe(1);
  // Keyboard: on phone widths 3.2.5's disabled Thinking level select overlaps the session button (rcarmo/piclaw#1518).
  await page.getByRole('button', { name: /manage sessions/i }).first().focus();
  await page.keyboard.press('Enter');
  await page.getByRole('searchbox', { name: /search sessions/i }).fill(key);
  await expect(entries(sessionList(page), nameRe(key))).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /manage sessions/i }).first()).toHaveAccessibleName(nameRe(key));
  pending.release();
  await page.waitForTimeout(2000);
  await expect(modelButton(page)).toContainText(MODEL_ONE);

  // A rejected switch keeps the prior model and the composer draft.
  pending.disarm();
  const rejected = await holdWrites(page, bodyHas('fixture-2'), { status: 500, error: `rejected-${n}` });
  await composer.fill(`draft-${n}`);
  await pickFixtureTwo();
  await expect.poll(() => rejected.count).toBe(1);
  rejected.release();
  await page.waitForTimeout(1500);
  await expect(modelButton(page)).toContainText(MODEL_ONE);
  await expect(composer).toHaveValue(`draft-${n}`);
  rejected.disarm();
  await composer.fill(`[reply:still-${n}] still ${n}`);
  await composer.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `still-${n}` })).toHaveCount(1);
  expect(await modelUsed(runtime, `still ${n}`)).toEqual(['fixture-1']);

  // The fixture models advertise no reasoning, so no thinking level is offered: any visible thinking control is
  // disabled or offers only "off" (3.2.5 shows such a select). Context is known (usage is reported), so the
  // "unknown context" and "local estimate" clauses are not constructible here; native compaction is actionable.
  for (const control of await page.getByLabel(/thinking|reasoning/i).all()) {
    if (!(await control.isVisible()) || (await control.isDisabled())) continue;
    const levels = await control.evaluate(el => el instanceof HTMLSelectElement ? [...el.options].map(o => o.value) : ['?']);
    expect(levels).toEqual(['off']);
  }
  await expect(page.getByRole('button', { name: /compact/i }).first()).toBeEnabled();
});
