/** Stop across SSE reconnect (features/canonical/shared-ux.feature @ux-shared-023). */
import { test, expect } from '../fixtures';
import { gateName } from '../runtime';
import { installSseDrop } from '../net';
import { randomUUID } from 'node:crypto';

test('@ux-shared-023 Cancel the captured active turn across reconnect', async ({ page, context, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const held = gateName('main'), otherGate = gateName('other'), newer = gateName('newer');
  const main = await runtime.newSession();
  const other = await runtime.newSession();
  const waiting = async (gate: string) => (await runtime.gates())[gate]?.waiting ?? 0;
  const stop = (p = page) => p.getByRole('button', { name: /^stop/i });

  // A turn in another session is running too; it must survive the stop.
  const otherPage = await context.newPage();
  await otherPage.goto(other.url);
  await otherPage.locator(sel('composeInput')).fill(`[say:other-${n}][gate:${otherGate}] other ${n}`);
  await otherPage.locator(sel('composeInput')).press('Enter');

  const sse = await installSseDrop(page);
  await page.goto(main.url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[say:main-${n}][gate:${held}] main ${n}`);
  await input.press('Enter');
  await expect.poll(() => waiting(held)).toBe(1);
  await expect.poll(() => waiting(otherGate)).toBe(1);
  await input.fill(`[reply:queued-${n}] queued ${n}`);
  await input.press('Enter');
  await expect(page.getByText(`queued ${n}`).first()).toBeVisible();
  await input.fill(`keep-${n}`);

  // The connection drops and comes back; the busy turn is still shown as main's, with its Stop control.
  let reconnects = 0;
  page.on('request', r => { if (r.url().includes('/sse/stream')) reconnects++; });
  expect(await sse.drop(), 'the page had an open SSE connection').toBeGreaterThan(0);
  await expect.poll(() => reconnects, { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(page.getByText(`main-${n}`, { exact: true })).toBeVisible();
  await expect(stop()).toBeVisible();

  await stop().click();
  await expect.poll(async () => (await runtime.modelLog()).find(e => e.prompt.includes(`main ${n}`))?.aborted).toBe(true);
  // Only that turn: the other session's turn is still running.
  expect(await waiting(otherGate)).toBe(1);
  await expect(stop(otherPage)).toBeVisible();
  // Composer and queue are preserved: the draft stays and the queued follow-up still runs.
  await expect(input).toHaveValue(`keep-${n}`);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `queued-${n}` })).toHaveCount(1);

  // A newer turn is not stopped by the old turn's late terminal events.
  await input.fill(`[say:newer-${n}][gate:${newer}] newer ${n}`);
  await input.press('Enter');
  await expect.poll(() => waiting(newer)).toBe(1);
  await page.waitForTimeout(2000);
  expect(await waiting(newer)).toBe(1);
  await expect(stop()).toBeVisible();
  await runtime.openGate(newer);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `newer-${n}` })).toHaveCount(1);
  await runtime.openGate(otherGate);
  await expect(otherPage.locator(sel('agentPost')).filter({ hasText: `other-${n}` })).toHaveCount(1);
  await otherPage.close();
});
