/** Generated widgets (features/classic/canonical/core-interactions.feature @ux-extra-004/005). */
import { test, expect } from '../fixtures';
import { gateName } from '../runtime';
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

type Sel = (k: string) => string;
const esc = (s: string) => s.replace(/[[\]]/g, m => '\\' + m);
async function send(page: Page, sel: Sel, text: string) {
  await page.locator(sel('composeInput')).fill(text);
  await page.locator(sel('composeInput')).press('Enter');
}
async function activate(page: Page, runtime: any, sel: Sel, n: string) {
  const activation = runtime.activationTurn(['send_dashboard_widget']);
  if (!activation) return;
  await send(page, sel, `${activation.replace('activated', `act-${n}`)} activate`);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `act-${n}` })).toHaveCount(1);
}
async function postWidget(page: Page, sel: Sel, n: string, html: string) {
  const widget = { title: `Widget ${n}`, html, content: `fallback ${n}` };
  await send(page, sel, `[tool:send_dashboard_widget ${esc(JSON.stringify(widget))}] widget ${n}`);
  const post = page.locator(sel('agentPost')).filter({ hasText: `Widget ${n}` });
  await expect(post).toHaveCount(1, { timeout: 30_000 });
  return post;
}
const openButton = (scope: ReturnType<Page['locator']>) => scope.getByRole('button', { name: /^open widget$/i });
const widgetFrame = (page: Page, n: string) => page.frameLocator('iframe').getByText(`widget body ${n}`);

test('@ux-extra-004 Interpret persisted and live widget artifacts separately', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  await page.goto((await runtime.newSession()).url);
  await activate(page, runtime, sel, n);
  // A persisted HTML artifact with content is usable: it opens and shows that content, also after a reload.
  const post = await postWidget(page, sel, n, `<p>widget body ${n}</p>`);
  await page.reload();
  await expect(post).toHaveCount(1);
  await openButton(post).click();
  await expect(widgetFrame(page, n)).toBeVisible();
  // Live streaming states are not constructible here: the reference posts widgets from a tool call, final at once.
});

test('@ux-extra-005 Keep widget dismissal separate from queue mutation', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  await page.goto((await runtime.newSession()).url);
  await activate(page, runtime, sel, n);
  const post = await postWidget(page, sel, n, `<p>widget body ${n}</p>`);
  await openButton(post).click();
  await expect(widgetFrame(page, n)).toBeVisible();
  // A held turn with a queued follow-up.
  const gate = gateName('widget');
  await send(page, sel, `[gate:${gate}][reply:held-${n}] held`);
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);
  await send(page, sel, `[reply:follow-${n}] follow ${n}`);
  await expect(page.locator(sel('queueItem'))).toHaveCount(1);
  // Close the floating pane: the queue is untouched.
  await page.getByRole('button', { name: /^close( widget)?$/i }).filter({ visible: true }).first().click();
  await expect(widgetFrame(page, n)).toHaveCount(0);
  await page.waitForTimeout(800);
  await expect(page.locator(sel('queueItem'))).toHaveCount(1);
  expect((await runtime.modelLog()).filter(e => String(e.prompt).includes(`follow ${n}`))).toHaveLength(0);
  // The follow-up still runs once, after the held turn.
  await runtime.openGate(gate);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `follow-${n}` })).toHaveCount(1, { timeout: 30_000 });
  expect((await runtime.modelLog()).filter(e => String(e.prompt).includes(`follow ${n}`) && !e.aborted)).toHaveLength(1);
});
