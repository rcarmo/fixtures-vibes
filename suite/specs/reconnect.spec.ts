/** Classic SSE reconnection and refresh (features/classic/compose/sse-reconnection.feature @ux-reconnect-001..003). */
import { test, expect } from '../fixtures';
import { gateName } from '../runtime';
import { installSseDrop, blockSse } from '../net';
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

const nonce = () => randomUUID().slice(0, 8);

/** Cut the page's event streams and keep them down until `back()`. Returns once the page has tried to reconnect. */
async function offline(page: Page, sse: { drop: () => Promise<number> }, gate: Awaited<ReturnType<typeof blockSse>>) {
  gate.block();
  expect(await sse.drop(), 'the page had an open SSE connection').toBeGreaterThan(0);
  await expect.poll(() => gate.attempts, { timeout: 30_000 }).toBeGreaterThan(0);
}
const reconnected = async (page: Page, gate: Awaited<ReturnType<typeof blockSse>>) => {
  let streams = 0;
  page.on('request', r => { if (/event-stream/.test(r.headers()['accept'] ?? '')) streams++; });
  gate.unblock();
  await expect.poll(() => streams, { timeout: 30_000 }).toBeGreaterThan(0);
};

test('@ux-reconnect-001 Clear transient agent displays while disconnected', async ({ page, runtime, sel }) => {
  const n = nonce();
  const held = gateName('held');
  const sse = await installSseDrop(page);
  const gate = await blockSse(page);
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[think:pondering ${n}][say:Partial ${n}][gate:${held}][say: rest ${n}] stream ${n}`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[held]?.waiting ?? 0).toBe(1);
  await expect(page.getByText(`Partial ${n}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`pondering ${n}`, { exact: true })).toBeVisible();
  await input.fill(`keep-${n}`);

  await offline(page, sse, gate);
  // Agent previews go; the user's own composer draft does not.
  await expect(page.getByText(`Partial ${n}`, { exact: true })).toHaveCount(0);
  await expect(page.getByText(`pondering ${n}`, { exact: true })).toHaveCount(0);
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(input).toHaveValue(`keep-${n}`);

  await reconnected(page, gate);
  await runtime.openGate(held);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `Partial ${n} rest ${n}` })).toHaveCount(1, { timeout: 30_000 });
  await expect(input).toHaveValue(`keep-${n}`);
});

test('@ux-reconnect-002 Refresh authoritative chat state after reconnect', async ({ page, runtime, sel }) => {
  const n = nonce();
  const held = gateName('held');
  const sse = await installSseDrop(page);
  const gate = await blockSse(page);
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:warm-${n}] warm`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `warm-${n}` })).toHaveCount(1);
  const meter = page.getByRole('button', { name: /^context/i }).first();
  expect(await meter.getAttribute('aria-label')).not.toMatch(/\b64(\.\d)?K\b/);
  await input.fill(`[gate:${held}][reply:late-${n}] late ${n}`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[held]?.waiting ?? 0).toBe(1);
  await input.fill(`[usage:64000][reply:queued-${n}] queued ${n}`);
  await input.press('Enter');
  await expect(page.locator(sel('queueItem'))).toHaveCount(1);

  // While offline the turn finishes and the queued follow-up runs; nothing reaches the page.
  await offline(page, sse, gate);
  await runtime.openGate(held);
  await expect.poll(async () => (await runtime.modelLog()).some(e => e.prompt.includes(`queued ${n}`) && !e.aborted), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(1500);

  // Reconnected: status, queue, context and the main timeline are refreshed without a reload.
  await reconnected(page, gate);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `late-${n}` })).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator(sel('agentPost')).filter({ hasText: `queued-${n}` })).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator(sel('queueItem'))).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^stop/i })).toHaveCount(0);
  // The last turn reported 64000 prompt tokens.
  await expect.poll(() => meter.getAttribute('aria-label')).toMatch(/\b64(\.\d)?K\b/);
});

test('@ux-reconnect-003 Avoid replacing an active search with main-timeline refresh', async ({ page, runtime, sel }) => {
  const n = nonce();
  const sse = await installSseDrop(page);
  const gate = await blockSse(page);
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:found-${n} and more] needle${n}`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `found-${n}` })).toHaveCount(1);
  await input.fill(`[reply:other-${n}] unrelated`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `other-${n}` })).toHaveCount(1);

  // A search view showing only the match.
  await page.getByRole('button', { name: /^search$/i }).first().click();
  await input.fill(`found-${n}`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `other-${n}` })).toHaveCount(0);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `found-${n}` })).toHaveCount(1);

  await offline(page, sse, gate);
  await reconnected(page, gate);
  await page.waitForTimeout(3000);
  // The search results are still what is shown.
  await expect(page.locator(sel('agentPost')).filter({ hasText: `found-${n}` })).toHaveCount(1);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `other-${n}` })).toHaveCount(0);
});
