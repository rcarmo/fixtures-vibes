/**
 * Timeline message deletion (features/classic/timeline/message-deletion.feature).
 * A turn's assistant reply is a visible thread reply of the user's prompt, which gives a parent with one visible reply.
 */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { failNextNewWrite } from '../net';

const nonce = () => randomUUID().slice(0, 8);

async function turn(page: Page, sel: (k: string) => string, n: string) {
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:reply-${n}] parent-${n}`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `reply-${n}` })).toHaveCount(1);
  return {
    parent: page.locator(sel('timelinePost')).filter({ hasText: `parent-${n}` }),
    reply: page.locator(sel('agentPost')).filter({ hasText: `reply-${n}` }),
  };
}

const deleteButton = (post: ReturnType<Page['locator']>) => post.getByRole('button', { name: /delete/i });

test('@ux-timeline-017 Delete a single message without visible replies', async ({ page, runtime, sel }) => {
  const n = nonce();
  await page.goto((await runtime.newSession()).url);
  const { reply } = await turn(page, sel, n);
  let prompted = false;
  page.on('dialog', d => { prompted = true; void d.dismiss(); });
  await reply.hover();
  await deleteButton(reply).click();
  await expect(reply).toHaveCount(0);
  expect(prompted).toBe(false);
  await page.reload();
  await expect(page.locator(sel('timelinePost')).filter({ hasText: `parent-${n}` }).first()).toBeVisible();
  await expect(page.locator(sel('agentPost')).filter({ hasText: `reply-${n}` })).toHaveCount(0);
});

test('@ux-timeline-020 Deleting a message with visible replies asks for cascade confirmation', async ({ page, runtime, sel }) => {
  const n = nonce();
  await page.goto((await runtime.newSession()).url);
  const { parent } = await turn(page, sel, n);
  const prompt = new Promise<string>(resolve => page.once('dialog', d => { resolve(d.message()); void d.dismiss(); }));
  await parent.hover();
  await deleteButton(parent).click();
  expect(await prompt).toBe('Delete this message and its 1 replies?');
});

test('@ux-timeline-021 Confirming cascade deletes the parent and visible replies together', async ({ page, runtime, sel }) => {
  const n = nonce();
  await page.goto((await runtime.newSession()).url);
  const { parent, reply } = await turn(page, sel, n);
  page.once('dialog', d => void d.accept());
  await parent.hover();
  await deleteButton(parent).click();
  await expect(parent).toHaveCount(0);
  await expect(reply).toHaveCount(0);
  await page.reload();
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await expect(page.locator(sel('timelinePost')).filter({ hasText: `-${n}` })).toHaveCount(0);
});

test('@ux-timeline-022 Cancelling cascade preserves the parent and visible replies', async ({ page, runtime, sel }) => {
  const n = nonce();
  await page.goto((await runtime.newSession()).url);
  const { parent, reply } = await turn(page, sel, n);
  page.once('dialog', d => void d.dismiss());
  await parent.hover();
  await deleteButton(parent).click();
  await page.waitForTimeout(800);
  await expect(parent).toBeVisible();
  await expect(reply).toBeVisible();
  await page.reload();
  await expect(page.locator(sel('agentPost')).filter({ hasText: `reply-${n}` })).toHaveCount(1);
});

test('@ux-timeline-019 A synthetic Replies exist rejection exposes the otherwise dormant retry prompt', async ({ page, runtime, sel }) => {
  const n = nonce();
  // Each armed delete has its first request rejected; the confirmed cascade retry reaches the runtime.
  // Installed before navigation so background writes are known and never mistaken for the action.
  const fault = await failNextNewWrite(page, { status: 409, error: 'Replies exist' });
  await page.goto((await runtime.newSession()).url);
  const { reply } = await turn(page, sel, n);
  const prompts: string[] = [];
  page.on('dialog', d => { prompts.push(d.message()); void (prompts.length === 1 ? d.dismiss() : d.accept()); });

  fault.arm();
  await reply.hover();
  await deleteButton(reply).click();
  await expect.poll(() => prompts).toEqual(['Delete this message and its replies?']);
  expect(fault.failed).not.toBeNull();
  await page.waitForTimeout(800);
  await expect(reply).toHaveCount(1);
  await page.reload();
  await expect(reply).toHaveCount(1);

  fault.arm();
  await reply.hover();
  await deleteButton(reply).click();
  await expect.poll(() => prompts.length).toBe(2);
  expect(prompts[1]).toBe('Delete this message and its replies?');
  await expect(reply).toHaveCount(0);
  await page.reload();
  await expect(page.locator(sel('timelinePost')).filter({ hasText: `parent-${n}` }).first()).toBeVisible();
  await expect(reply).toHaveCount(0);
});
