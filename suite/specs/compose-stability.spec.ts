/** Composer draft behaviour (features/classic/compose/compose-stability.feature). */
import { test, expect } from '../fixtures';
import { gateName } from '../runtime';
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { holdWrites, bodyHas, uploadOf } from '../net';

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
  // The seed's own user post may arrive after its reply; take the baseline once both are shown.
  await expect(page.locator(sel('userPost')).filter({ hasText: `seed ${n}` })).toHaveCount(1);
  const posts = await page.locator(sel('timelinePost')).count();
  const before = (await runtime.modelLog()).length;
  await input.fill('   \n  ');
  await input.press('Enter');
  await page.waitForTimeout(1500);
  expect(await page.locator(sel('timelinePost')).count()).toBe(posts);
  expect((await runtime.modelLog()).length).toBe(before);
});

const attach = (page: Page, n: string) => page.locator('.compose-box input[type=file]')
  .setInputFiles({ name: `att-${n}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`filebody-${n}\n`) });

test('@ux-compose-002 Restore a failed submission alongside newer text', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  for (const newer of [`newer-${n}`, `first-${n}`]) {
    const send = await holdWrites(page, bodyHas(`first-${n}`), { status: 500, error: `boom-${n}` });
    await input.fill(`first-${n}`);
    await input.press('Enter');
    await expect.poll(() => send.count).toBe(1);
    await input.fill(newer);
    send.release();
    await expect(page.getByRole('alert').filter({ hasText: `boom-${n}` })).toBeVisible();
    await expect(input).toHaveValue(newer === `first-${n}` ? `first-${n}` : `first-${n}\n\n${newer}`);
  }
  await page.waitForTimeout(500);
  await expect(page.locator(sel('timelinePost')).filter({ hasText: `first-${n}` })).toHaveCount(0);
  expect((await runtime.modelLog()).some(e => String(e.prompt).includes(`first-${n}`))).toBe(false);
});

test('@ux-compose-004 Return a queued message replaces the current editor draft', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const gate = gateName('return');
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[gate:${gate}][reply:first-${n}] one ${n}`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);
  const queued = `[reply:second-${n}] two ${n}`;
  await input.fill(queued);
  await input.press('Enter');
  await expect(page.locator(sel('queueItem'))).toHaveCount(1);

  // A failed send leaves an alert; then a newer draft with an attachment.
  const send = await holdWrites(page, bodyHas(`lost-${n}`), { status: 500, error: `boom-${n}` });
  await input.fill(`lost-${n}`);
  await input.press('Enter');
  await expect.poll(() => send.count).toBe(1);
  send.release();
  await expect(page.getByRole('alert').filter({ hasText: `boom-${n}` })).toBeVisible();
  await attach(page, n);
  await expect(page.getByText(`att-${n}.txt`)).toBeVisible();
  await input.fill(`newer draft ${n}`);

  await page.locator(sel('queueItem')).getByRole('button', { name: /return .*editor|edit/i }).click();
  await expect(input).toHaveValue(queued);
  await expect(page.getByText(`att-${n}.txt`)).toHaveCount(0);
  await expect(page.getByRole('alert').filter({ hasText: `boom-${n}` })).toHaveCount(0);
  await expect(page.locator(sel('queueItem'))).toHaveCount(0);
  await expect(input).toBeFocused();
  expect(await input.evaluate((e: HTMLTextAreaElement) => [e.selectionStart, e.selectionEnd])).toEqual([queued.length, queued.length]);
  await runtime.openGate(gate);
});

test('@ux-compose-005 Keep upload progress separate from sending state', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  await page.goto((await runtime.newSession()).url);
  const upload = await holdWrites(page, uploadOf(`att-${n}.txt`));
  const message = await holdWrites(page, bodyHas(`msg-${n}`));
  await attach(page, n);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:ok-${n}] msg-${n}`);
  await input.press('Enter');
  await expect.poll(() => upload.count).toBe(1);
  const uploadStatus = page.getByRole('status').filter({ hasText: `att-${n}.txt` });
  await expect(uploadStatus).toBeVisible();
  await expect(uploadStatus.getByRole('progressbar')).toBeVisible();
  // The submit button's own state label; other upload controls (e.g. Cancel uploads) may stay enabled.
  await expect(page.getByRole('button', { name: /^uploading/i })).toBeDisabled();

  upload.release();
  await expect.poll(() => message.count).toBe(1);
  await expect(uploadStatus).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^sending/i })).toBeDisabled();
  message.release();
  await expect(page.locator(sel('agentPost')).filter({ hasText: `ok-${n}` })).toHaveCount(1);
});

test('@ux-compose-006 Submit captures the destination chat', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const other = await runtime.newSession();
  const mine = await runtime.newSession();
  await page.goto(mine.url);
  const upload = await holdWrites(page, uploadOf(`att-${n}.txt`));
  await attach(page, n);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:ok-${n}] msg-${n}`);
  await input.press('Enter');
  await expect.poll(() => upload.count).toBe(1);

  // Switch sessions through the in-app picker while the upload is held. Pickers may expose entries as options or
  // menu items; match the entry by the session identifier. If the switch did not happen, the delivery check below fails.
  const otherKey = other.id.replace(/^[a-z]+:/, '');
  const entryName = new RegExp(otherKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  await page.getByRole('button', { name: /manage sessions|sessions/i }).first().click();
  await page.getByRole('searchbox', { name: /search sessions/i }).fill(otherKey);
  await page.getByRole('option', { name: entryName }).or(page.getByRole('menuitem', { name: entryName })).first().click();

  upload.release();
  // The logged prompt is only its last line (attachments follow the text), so match the directive.
  await expect.poll(async () => (await runtime.modelLog()).some(e => JSON.stringify(e.directives ?? '').includes(`ok-${n}`)), { timeout: 15_000 }).toBe(true);
  await page.waitForTimeout(1000);
  await expect(page.locator(sel('timelinePost')).filter({ hasText: `msg-${n}` })).toHaveCount(0);
  await page.goto(mine.url);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `ok-${n}` })).toHaveCount(1);
  await page.goto(other.url);
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await expect(page.locator(sel('timelinePost')).filter({ hasText: `msg-${n}` })).toHaveCount(0);
});
