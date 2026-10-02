/**
 * First Classic compliance scenarios. Test titles start with the scenario ID so evidence manifests can be generated.
 */
import { test, expect } from '../fixtures';
import { gateName } from '../runtime';
import { randomUUID } from 'node:crypto';

/** Unique markers keep assertions valid when a runtime has a single shared session. */
const nonce = () => randomUUID().slice(0, 8);

test('@ux-chat-lifecycle-004 A persisted assistant reply retains its identity and Markdown', async ({ page, runtime, sel }) => {
  const session = await runtime.newSession();
  const n = nonce();
  await page.goto(session.url);
  await expect(page.locator(sel('appShell'))).toBeVisible();
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:Some *emphasis* ${n}\\n\\n- first item ${n}\\n- second item] markdown check`);
  await input.press('Enter');

  const reply = page.locator(sel('agentPost')).filter({ hasText: `first item ${n}` });
  await expect(reply).toHaveCount(1);
  await expect(reply.locator('em')).toHaveText('emphasis');
  await expect(reply.locator('li')).toHaveText([`first item ${n}`, 'second item']);

  // The reply survives reload as an agent post and is not attributed to the user.
  await page.reload();
  const persisted = page.locator(sel('agentPost')).filter({ hasText: `first item ${n}` });
  await expect(persisted).toHaveCount(1);
  await expect(page.locator(`${sel('timelinePost')}:not(.agent-post)`).filter({ has: page.locator('li', { hasText: `first item ${n}` }) })).toHaveCount(0);
});

test('@ux-original-016 Display queued follow-ups during a busy turn', async ({ page, runtime, sel }) => {
  const session = await runtime.newSession();
  const gate = gateName('queue');
  await page.goto(session.url);
  const input = page.locator(sel('composeInput'));

  const first = `FIRST_${nonce()}`, second = `SECOND_${nonce()}`;
  await input.fill(`[gate:${gate}][reply:${first}] busy turn`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);

  await input.fill(`[reply:${second}] queued follow-up ${second}`);
  await input.press('Enter');
  const queued = page.locator(sel('queueItem'));
  await expect(queued).toHaveCount(1);
  await expect(queued).toContainText(`queued follow-up ${second}`);

  await runtime.openGate(gate);
  // The queue reconciles with server state and both replies arrive in order.
  await expect(queued).toHaveCount(0);
  const replies = page.locator(sel('agentPost'));
  await expect(replies.filter({ hasText: first })).toHaveCount(1);
  await expect(replies.filter({ hasText: second })).toHaveCount(1);
  const texts = await replies.allTextContents();
  expect(texts.findIndex(t => t.includes(first))).toBeLessThan(texts.findIndex(t => t.includes(second)));
});
