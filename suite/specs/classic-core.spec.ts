/**
 * First Classic compliance scenarios. Test titles start with the scenario ID so evidence manifests can be generated.
 */
import { test, expect, requires } from '../fixtures';
import { gateName } from '../runtime';

test('@ux-chat-lifecycle-004 A persisted assistant reply retains its identity and Markdown', async ({ page, runtime, sel }) => {
  const session = await runtime.newSession();
  await page.goto(session.url);
  await expect(page.locator(sel('appShell'))).toBeVisible();
  const input = page.locator(sel('composeInput'));
  await input.fill('[reply:Some *emphasis* here\\n\\n- first item\\n- second item] markdown check');
  await input.press('Enter');

  const reply = page.locator(sel('agentPost')).filter({ hasText: 'first item' });
  await expect(reply).toHaveCount(1);
  await expect(reply.locator('em')).toHaveText('emphasis');
  await expect(reply.locator('li')).toHaveText(['first item', 'second item']);

  // The reply survives reload as an agent post and is not attributed to the user.
  await page.reload();
  const persisted = page.locator(sel('agentPost')).filter({ hasText: 'first item' });
  await expect(persisted).toHaveCount(1);
  await expect(page.locator(`${sel('timelinePost')}:not(.agent-post)`).filter({ has: page.locator('li', { hasText: 'first item' }) })).toHaveCount(0);
});

test('@ux-original-016 Display queued follow-ups during a busy turn', async ({ page, runtime, sel }) => {
  requires(runtime, '@cap-queue');
  const session = await runtime.newSession();
  const gate = gateName('queue');
  await page.goto(session.url);
  const input = page.locator(sel('composeInput'));

  await input.fill(`[gate:${gate}][reply:FIRST_DONE] busy turn`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);

  await input.fill('[reply:SECOND_DONE] queued follow-up');
  await input.press('Enter');
  const queued = page.locator(sel('queueItem'));
  await expect(queued).toHaveCount(1);
  await expect(queued).toContainText('queued follow-up');

  await runtime.openGate(gate);
  // The queue reconciles with server state and both replies arrive in order.
  await expect(queued).toHaveCount(0);
  const replies = page.locator(sel('agentPost'));
  await expect(replies.filter({ hasText: 'FIRST_DONE' })).toHaveCount(1);
  await expect(replies.filter({ hasText: 'SECOND_DONE' })).toHaveCount(1);
  const texts = await replies.allTextContents();
  expect(texts.findIndex(t => t.includes('FIRST_DONE'))).toBeLessThan(texts.findIndex(t => t.includes('SECOND_DONE')));
});
