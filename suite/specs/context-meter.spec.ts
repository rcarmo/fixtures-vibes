/** Context meter (features/classic/compose/context-meter-tooltip.feature). Usage comes from the fixture model (128K window). */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

type Sel = (k: string) => string;
const meter = (page: Page) => page.getByRole('button', { name: /^context/i }).first();
const label = async (page: Page) => (await meter(page).getAttribute('aria-label')) ?? (await meter(page).innerText());

async function turn(page: Page, sel: Sel, usage: number, tag: string) {
  await page.locator(sel('composeInput')).fill(`[usage:${usage}][reply:${tag}] go`);
  await page.locator(sel('sendButton')).click();
  await expect(page.locator(sel('agentPost')).filter({ hasText: tag })).toHaveCount(1, { timeout: 30_000 });
}

test('@ux-context-001 Show supplied usage in the context tooltip', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  const n = Math.random().toString(16).slice(2, 8);
  await turn(page, sel, 64000, `half-${n}`);
  await expect.poll(() => label(page)).toMatch(/64K\b.*128K\b.*\b50%/);
  const size = (await meter(page).boundingBox())!;
  // Over capacity: at least 100%, and the meter keeps its size.
  await turn(page, sel, 150000, `over-${n}`);
  await expect.poll(() => label(page)).toMatch(/150K\b.*128K\b/);
  expect(Number((await label(page)).match(/(\d+)%/)?.[1])).toBeGreaterThanOrEqual(100);
  const over = (await meter(page).boundingBox())!;
  expect(Math.abs(over.width - size.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(over.height - size.height)).toBeLessThanOrEqual(1);
});
