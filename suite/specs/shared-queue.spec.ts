/**
 * Shared queue contract (features/canonical/shared-ux.feature @ux-shared-016..019).
 * Follow-ups are queued behind a turn the fixture model holds at a gate.
 */
import { test, expect } from '../fixtures';
import { gateName, type Runtime } from '../runtime';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { failNextNewWrite } from '../net';

const nonce = () => randomUUID().slice(0, 8);

/** Start a held turn in a fresh session and queue `labels` as follow-ups behind it. */
async function heldWithQueue(page: Page, runtime: Runtime, sel: (k: string) => string, n: string, labels: string[]) {
  const gate = gateName('queue');
  const session = await runtime.newSession();
  await page.goto(session.url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[gate:${gate}][reply:held-${n}] held ${n}`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);
  for (const [i, label] of labels.entries()) {
    await input.fill(`[reply:r-${label}-${n}] q-${label} ${n}`);
    await input.press('Enter');
    await expect(page.locator(sel('queueItem'))).toHaveCount(i + 1);
  }
  return { gate, session, input, items: page.locator(sel('queueItem')) };
}

/** Prompts of turns the model actually received for this nonce, in order (tool follow-ups excluded). */
const deliveredPrompts = async (runtime: Runtime, n: string) =>
  (await runtime.modelLog()).filter(e => !e.toolFollowUp && String(e.prompt).includes(n)).map(e => String(e.prompt).trim());

const queueTexts = async (page: Page, sel: (k: string) => string, n: string) =>
  (await page.locator(sel('queueItem')).allInnerTexts()).map(t => (t.match(new RegExp(`q-(\\w+) ${n}`)) ?? [])[1]);

test('@ux-shared-016 Queue two follow-ups exactly once', async ({ page, runtime, sel }) => {
  const n = nonce();
  const other = await runtime.newSession();
  const { gate } = await heldWithQueue(page, runtime, sel, n, ['a', 'b']);
  expect(await queueTexts(page, sel, n)).toEqual(['a', 'b']);
  await page.reload();
  await expect.poll(() => queueTexts(page, sel, n)).toEqual(['a', 'b']);

  await runtime.openGate(gate);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `r-b-${n}` })).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator(sel('queueItem'))).toHaveCount(0);
  expect(await deliveredPrompts(runtime, n)).toEqual([`held ${n}`, `q-a ${n}`, `q-b ${n}`].map(p => expect.stringContaining(p)));
  for (const label of ['a', 'b']) await expect(page.locator(sel('agentPost')).filter({ hasText: `r-${label}-${n}` })).toHaveCount(1);
  await page.goto(other.url);
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await expect(page.locator(sel('timelinePost')).filter({ hasText: n })).toHaveCount(0);
});

test('@ux-shared-017 Return a queued item to the editor', async ({ page, runtime, sel }) => {
  const n = nonce();
  const { gate, input, items } = await heldWithQueue(page, runtime, sel, n, ['a']);
  await items.getByRole('button', { name: /return .*editor|edit in compose/i }).click();
  await expect(input).toHaveValue(`[reply:r-a-${n}] q-a ${n}`);
  await expect(items).toHaveCount(0);
  await page.reload();
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(items).toHaveCount(0);

  await runtime.openGate(gate);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `held-${n}` })).toHaveCount(1);
  await page.waitForTimeout(1500);
  expect((await deliveredPrompts(runtime, n)).filter(p => p.includes(`q-a ${n}`))).toEqual([]);
  await input.fill(`[reply:r-a-${n}] q-a ${n}`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `r-a-${n}` })).toHaveCount(1);
  expect((await deliveredPrompts(runtime, n)).filter(p => p.includes(`q-a ${n}`))).toHaveLength(1);
});

test('@ux-shared-018 Reorder and remove by durable identity', async ({ page, runtime, sel }) => {
  const n = nonce();
  const other = await runtime.newSession();
  const { gate, input, items } = await heldWithQueue(page, runtime, sel, n, ['a', 'b', 'c']);
  await input.fill(`draft ${n}`);

  await items.nth(1).getByRole('button', { name: /move up/i }).click();
  await expect.poll(() => queueTexts(page, sel, n)).toEqual(['b', 'a', 'c']);
  await page.reload();
  await expect.poll(() => queueTexts(page, sel, n)).toEqual(['b', 'a', 'c']);

  await items.filter({ hasText: `q-a ${n}` }).getByRole('button', { name: /cancel|remove/i }).click();
  await expect.poll(() => queueTexts(page, sel, n)).toEqual(['b', 'c']);
  await page.reload();
  await expect.poll(() => queueTexts(page, sel, n)).toEqual(['b', 'c']);
  await input.fill(`draft ${n}`);

  await runtime.openGate(gate);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `r-c-${n}` })).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  expect((await deliveredPrompts(runtime, n)).slice(1)).toEqual(['b', 'c'].map(l => expect.stringContaining(`q-${l} ${n}`)));
  await expect(input).toHaveValue(`draft ${n}`);
  await page.goto(other.url);
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await expect(page.locator(sel('timelinePost')).filter({ hasText: n })).toHaveCount(0);
});

test('@ux-shared-019 Steer a queued item into the matching active run', async ({ page, runtime, sel }) => {
  const n = nonce();
  const other = await runtime.newSession();
  const { gate, items } = await heldWithQueue(page, runtime, sel, n, ['a']);
  await items.getByRole('button', { name: /steer/i }).dblclick();
  await expect(items).toHaveCount(0);
  await runtime.openGate(gate);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `r-a-${n}` })).toHaveCount(1, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  expect((await deliveredPrompts(runtime, n)).filter(p => p.includes(`q-a ${n}`))).toHaveLength(1);
  await page.goto(other.url);
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await expect(page.locator(sel('timelinePost')).filter({ hasText: n })).toHaveCount(0);
});

for (const [action, name] of [['returning to editor', /return .*editor|edit in compose/i], ['cancelling', /cancel|remove/i], ['steering', /steer/i]] as const) {
  test(`@ux-shared-032 A rejected queue action keeps the item recoverable: ${action}`, async ({ page, runtime, sel }) => {
    const n = nonce();
    const fault = await failNextNewWrite(page, { status: 500, error: `queue-boom-${n}` });
    const { gate, input, items } = await heldWithQueue(page, runtime, sel, n, ['a']);
    fault.arm();
    await items.getByRole('button', { name }).click();
    await expect.poll(() => fault.failed).not.toBeNull();
    await expect(page.getByText(/failed|could not|error/i).filter({ hasNotText: `q-a ${n}` }).first()).toBeVisible();
    await expect(page.locator(sel('queueItem')).filter({ hasText: `q-a ${n}` })).toHaveCount(1, { timeout: 5000 });
    // Whatever the user can still see, the agent gets the item at most once.
    await input.fill('');
    await runtime.openGate(gate);
    await expect(page.locator(sel('agentPost')).filter({ hasText: `held-${n}` })).toHaveCount(1);
    await page.waitForTimeout(3000);
    expect((await deliveredPrompts(runtime, n)).filter(p => p.includes(`q-a ${n}`)).length).toBeLessThanOrEqual(1);
  });
}
