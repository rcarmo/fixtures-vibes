/**
 * Adaptive Card submissions (features/classic/canonical/core-interactions.feature @ux-extra-002/003). The agent posts
 * a card through the runtime's card tool; the user submits it.
 */
import { test, expect } from '../fixtures';
import { failNextNewWrite } from '../net';
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

type Sel = (k: string) => string;
const esc = (s: string) => s.replace(/[[\]]/g, m => '\\' + m);

async function send(page: Page, sel: Sel, text: string) {
  await page.locator(sel('composeInput')).fill(text);
  await page.locator(sel('composeInput')).press('Enter');
}
/** A card with a Submit action, posted by the agent; returns its post. */
async function postCard(page: Page, runtime: any, sel: Sel, n: string) {
  await page.goto((await runtime.newSession()).url);
  const activation = runtime.activationTurn(['send_adaptive_card']);
  if (activation) {
    await send(page, sel, `${activation.replace('activated', `act-${n}`)} activate`);
    await expect(page.locator(sel('agentPost')).filter({ hasText: `act-${n}` })).toHaveCount(1);
  }
  const card = { content: `card ${n}`, card_id: `card-${n}`, payload: { type: 'AdaptiveCard', version: '1.5',
    body: [{ type: 'TextBlock', text: `Pick ${n}` }], actions: [{ type: 'Action.Submit', title: 'Submit', data: { ok: 1 } }] } };
  await send(page, sel, `[tool:send_adaptive_card ${esc(JSON.stringify(card))}] card ${n}`);
  const post = page.locator(sel('agentPost')).filter({ hasText: `Pick ${n}` });
  await expect(post).toHaveCount(1, { timeout: 30_000 });
  await expect(post.getByRole('button', { name: /^submit$/i })).toBeEnabled();
  return post;
}

test('@ux-extra-002 Validate the identity of a card submission', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const post = await postCard(page, runtime, sel, n);
  await post.getByRole('button', { name: /^submit$/i }).click();
  // A well-formed submission (card, source post, time, Action.Submit) is accepted once: the card records which action
  // was taken and when, and the submission itself appears in the chat.
  await expect(post).toContainText(/submitted/i, { timeout: 20_000 });
  await expect(post).toContainText(/submit\s*·\s*\S/i);
  await expect(post.getByRole('button', { name: /^submit$/i })).toHaveCount(0);
  await expect(page.locator(sel('userPost')).filter({ hasText: /submitted/i })).toHaveCount(1);
});

test('@ux-extra-003 Display a rejected card action', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const post = await postCard(page, runtime, sel, n);
  const fail = await failNextNewWrite(page, { status: 500, error: `rejected-${n}` });
  fail.arm();
  await post.getByRole('button', { name: /^submit$/i }).click();
  await expect.poll(() => fail.failed).not.toBeNull();
  // The card reports the error and is not shown as submitted.
  await expect(post).toContainText(`rejected-${n}`);
  await page.waitForTimeout(1000);
  await expect(post).not.toContainText(/submitted/i);
  await expect(post.getByRole('button', { name: /^submit$/i })).toBeVisible();
  await expect(page.locator(sel('userPost')).filter({ hasText: /submitted/i })).toHaveCount(0);
});
