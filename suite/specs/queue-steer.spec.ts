/** Steering a queued follow-up (features/classic/canonical/canonical-ux.feature). */
import { test, expect } from '../fixtures';
import { gateName } from '../runtime';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { failNextNewWrite } from '../net';

async function queueBehindHeldTurn(page: Page, runtime: any, sel: (k: string) => string, n: string) {
  const gate = gateName('steer');
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[gate:${gate}][reply:first-${n}] one ${n}`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);
  await input.fill(`[reply:second-${n}] two ${n}`);
  await input.press('Enter');
  const item = page.locator(sel('queueItem')).filter({ hasText: `two ${n}` });
  await expect(item).toHaveCount(1);
  return { gate, item, steer: item.getByRole('button', { name: /steer/i }) };
}

test('@ux-original-019 Steer a queued item using the backend-authoritative action', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const { gate, item, steer } = await queueBehindHeldTurn(page, runtime, sel, n);
  await steer.click();
  await expect(item).toHaveCount(0, { timeout: 1000 });
  await runtime.openGate(gate);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `second-${n}` })).toHaveCount(1);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `first-${n}` })).toHaveCount(1);
  expect((await runtime.modelLog()).filter(e => !e.toolFollowUp && String(e.prompt).includes(`two ${n}`)).length).toBe(1);
  await expect(page.locator(sel('queueItem'))).toHaveCount(0);
});

test('@ux-original-030 A failed Steer warns and keeps the item queued', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  // The steer request (the first write to a new endpoint after arming) fails.
  const fault = await failNextNewWrite(page, { status: 500, error: `steer-boom-${n}` });
  const { gate, item, steer } = await queueBehindHeldTurn(page, runtime, sel, n);
  fault.arm();
  await steer.click();
  await expect.poll(() => fault.failed).not.toBeNull();
  await expect(page.getByText(/could not be sent as steering/i)).toBeVisible();
  await expect(item).toHaveCount(1, { timeout: 5000 });
  await runtime.openGate(gate);
});
