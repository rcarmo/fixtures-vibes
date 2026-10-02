/**
 * Shared model picker contract (features/canonical/shared-ux.feature @ux-shared-020).
 * Only fixture models are ever selected: reference instances may list real, billable providers too.
 */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const modelButton = (page: Page) => page.getByRole('button', { name: /model picker/i }).first();
const modelList = (page: Page) => page.getByRole('listbox', { name: /models/i });

/** The model the fixture server saw for the turn carrying this nonce. */
const modelUsed = async (runtime: any, n: string) =>
  (await runtime.modelLog()).filter((e: any) => !e.toolFollowUp && String(e.prompt).includes(n)).map((e: any) => String(e.model));

for (const input of ['pointer', 'keyboard'] as const) {
  test(`@ux-shared-020 Search and select a model authoritatively: ${input}`, async ({ page, runtime, sel }) => {
    const n = randomUUID().slice(0, 8);
    const other = await runtime.newSession();
    const main = await runtime.newSession();
    await page.goto(main.url);
    const composer = page.locator(sel('composeInput'));
    await composer.fill(`unsent ${n}`);

    if (input === 'pointer') await modelButton(page).click();
    else { await modelButton(page).focus(); await page.keyboard.press('Enter'); }
    await expect(modelList(page)).toBeVisible();
    await page.keyboard.type('fixture-2');
    const second = modelList(page).getByRole('option', { name: /fixture model two|fixture-2/i });
    await expect(second).toHaveCount(1);
    if (input === 'pointer') await second.click();
    else await page.keyboard.press('Enter');
    // The switch may be a rate-limited chat command; allow for the suite's 429 backoff.
    await expect(modelList(page)).toHaveCount(0, { timeout: 40_000 });
    await expect(modelButton(page)).toContainText(/fixture-2|fixture model two/i);
    await expect(composer).toHaveValue(`unsent ${n}`);

    // The next turn uses the selected model; the choice survives reload for this session only.
    await composer.fill(`[reply:ok-${n}] use ${n}`);
    await composer.press('Enter');
    await expect(page.locator(sel('agentPost')).filter({ hasText: `ok-${n}` })).toHaveCount(1);
    expect(await modelUsed(runtime, n)).toEqual(['fixture-2']);
    await page.reload();
    await expect(modelButton(page)).toContainText(/fixture-2|fixture model two/i);
    // Only this session changed: the other session's next turn still uses the default fixture model.
    await page.goto(other.url);
    await expect(modelButton(page)).not.toContainText(/fixture-2|fixture model two/i);
    const m = randomUUID().slice(0, 8);
    await page.locator(sel('composeInput')).fill(`[reply:ok-${m}] use ${m}`);
    await page.locator(sel('composeInput')).press('Enter');
    await expect(page.locator(sel('agentPost')).filter({ hasText: `ok-${m}` })).toHaveCount(1);
    expect(await modelUsed(runtime, m)).toEqual(['fixture-1']);
  });
}
