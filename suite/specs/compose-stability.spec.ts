/** Composer draft behaviour (features/classic/compose/compose-stability.feature). */
import { test, expect } from '../fixtures';
import { gateName } from '../runtime';
import { randomUUID } from 'node:crypto';

test('@ux-compose-001 Clear captured content while allowing a new draft', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const gate = gateName('compose');
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[gate:${gate}][reply:sent-${n}] first ${n}`);
  await input.press('Enter');
  // The displayed draft clears while the turn is still in flight.
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);
  await expect(input).toHaveValue('');
  await input.fill(`next draft ${n}`);
  await runtime.openGate(gate);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `sent-${n}` })).toHaveCount(1);
  // Typing after submission belongs to the new draft and survives the reply.
  await expect(input).toHaveValue(`next draft ${n}`);
});

test('@ux-compose-003 Reject an entirely empty submission', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:ok-${n}] seed ${n}`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `ok-${n}` })).toHaveCount(1);
  const posts = await page.locator(sel('timelinePost')).count();
  const before = (await runtime.modelLog()).length;
  await input.fill('   \n  ');
  await input.press('Enter');
  await page.waitForTimeout(1500);
  expect(await page.locator(sel('timelinePost')).count()).toBe(posts);
  expect((await runtime.modelLog()).length).toBe(before);
});
