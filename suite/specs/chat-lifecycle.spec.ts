/**
 * Chat lifecycle: conversation vs transient agent activity (features/classic/compose/chat-lifecycle.feature).
 * Labels asserted here ("Thoughts", "Draft", "Writing response") are the scenario's own visible wording.
 */
import { test, expect } from '../fixtures';
import { gateName } from '../runtime';
import { randomUUID } from 'node:crypto';

const nonce = () => randomUUID().slice(0, 8);

test('@ux-chat-lifecycle-001 An idle chat does not manufacture an activity pane', async ({ page, runtime, sel }) => {
  const n = nonce();
  const session = await runtime.newSession();
  await page.goto(session.url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[reply:Done ${n}] idle check ${n}`);
  await input.press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: `Done ${n}` })).toHaveCount(1);

  for (const phase of ['settled', 'reloaded']) {
    if (phase === 'reloaded') await page.reload();
    await expect(page.locator(sel('composeInput')), phase).toBeVisible();
    await expect(page.locator(sel('agentPost')).filter({ hasText: `Done ${n}` }), phase).toHaveCount(1);
    await expect(page.getByText(/^(idle|working)(\.\.\.|…)?$/i), phase).toHaveCount(0);
    await expect(page.getByText(/^completed$/i), phase).toHaveCount(0);
  }
});

test('@ux-chat-lifecycle-002 Streaming thoughts and response drafts have separate panes', async ({ page, runtime, sel }) => {
  const n = nonce();
  const gate = gateName('draft');
  const session = await runtime.newSession();
  await page.goto(session.url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[think:pondering ${n}][say:Partial ${n}][gate:${gate}][say: rest ${n}] stream ${n}`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);

  // Thoughts and Draft panes hold their own text while the turn is held mid-stream.
  await expect(page.getByText('Thoughts', { exact: true })).toBeVisible();
  await expect(page.getByText(`pondering ${n}`, { exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await expect(page.getByText(`Partial ${n}`, { exact: true })).toBeVisible();
  await expect(page.getByText(/Writing response/)).toBeVisible();
  // Previews are not user messages and carry no tool-call markers.
  // The prompt itself contains the directives, so only exact preview text counts.
  await expect(page.locator(sel('timelinePost')).getByText(`Partial ${n}`, { exact: true })).toHaveCount(0);
  await expect(page.locator(sel('timelinePost')).getByText(`pondering ${n}`, { exact: true })).toHaveCount(0);

  await runtime.openGate(gate);
  const reply = page.locator(sel('agentPost')).filter({ hasText: `Partial ${n} rest ${n}` });
  await expect(reply).toHaveCount(1);
  await expect(reply).not.toContainText(/tool_call|<\/?tool|\[tool:/);
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
});

test('@ux-chat-lifecycle-003 Tool output belongs to the Output status pane', async ({ page, runtime, sel }) => {
  const n = nonce();
  const session = await runtime.newSession();
  await page.goto(session.url);
  const input = page.locator(sel('composeInput'));
  const cmd = JSON.stringify({ command: `echo out-start-${n}; sleep 4; echo out-end-${n}` });
  await input.fill(`[tool:bash ${cmd}][after-tool:Tool finished ${n}] run tool ${n}`);
  await input.press('Enter');

  // While the tool runs, its streamed output is shown in the Output pane and the status names the tool.
  // The pane label may be generated content, so read the accessibility tree rather than DOM text.
  await expect.poll(async () => {
    const tree = await page.locator('body').ariaSnapshot();
    return /^\s*- text: Output\s*$/im.test(tree) && tree.includes(`out-start-${n}`) && /bash/i.test(tree);
  }, { timeout: 15_000 }).toBe(true);

  const reply = page.locator(sel('agentPost')).filter({ hasText: `Tool finished ${n}` });
  await expect(reply).toHaveCount(1, { timeout: 20_000 });
  // Raw tool results are not conversation posts and are never attributed to the user.
  await expect(page.locator(sel('timelinePost')).filter({ hasText: `out-end-${n}` }).filter({ hasNotText: 'run tool' })).toHaveCount(0);
  await expect(page.locator(`${sel('timelinePost')}:not(.agent-post)`).filter({ hasText: `out-start-${n}` }).filter({ hasNotText: 'run tool' })).toHaveCount(0);
});

test('@ux-chat-lifecycle-005 A terminal provider error is not a user input or a tool success', async ({ page, runtime, sel }) => {
  test.setTimeout(150_000);
  const n = nonce();
  const session = await runtime.newSession();
  await page.goto(session.url);
  const input = page.locator(sel('composeInput'));
  const cmd = JSON.stringify({ command: `echo tool-${n}; sleep 3` });
  await input.fill(`[think:thinking-${n}][say:preview-${n}][tool:bash ${cmd}] failing turn ${n}`);
  await input.press('Enter');
  // Previews stream and the tool starts; then the provider goes down for every follow-up and recovery attempt.
  await expect.poll(async () => (await page.locator('body').ariaSnapshot()).includes(`tool-${n}`), { timeout: 15_000 }).toBe(true);
  try {
    await runtime.outage(400, 50);
    const error = page.locator(sel('agentPost')).filter({ hasText: /error|fail|exhausted/i });
    await expect(error).toHaveCount(1, { timeout: 120_000 });
  } finally {
    await runtime.outage(400, 0);
  }
  // The error is an agent presentation, never a user post; previews are cleared; no Completed footer stands in.
  await expect(page.locator(`${sel('timelinePost')}:not(.agent-post)`).filter({ hasText: /error|fail|exhausted/i }).filter({ hasNotText: `failing turn ${n}` })).toHaveCount(0);
  await expect(page.getByText(`preview-${n}`, { exact: true })).toHaveCount(0);
  await expect(page.getByText(`thinking-${n}`, { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^completed$/i)).toHaveCount(0);
  await page.reload();
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await expect.poll(async () => /^\s*- text: Output\s*$/im.test(await page.locator('body').ariaSnapshot())).toBe(false);
  await expect(page.getByText(/^completed$/i)).toHaveCount(0);
});
