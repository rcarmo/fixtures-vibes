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
  await input.fill(`[tool:${runtime.toolName('shell')} ${cmd}][after-tool:Tool finished ${n}] run tool ${n}`);
  await input.press('Enter');

  // While the tool runs, its streamed output is shown in the Output pane and the status names the tool.
  // The pane label may be generated content, so read the accessibility tree rather than DOM text.
  await expect.poll(async () => {
    const tree = await page.locator('body').ariaSnapshot();
    // Ignore the prompt bubble, which contains the directive text itself.
    const own = tree.split('\n').filter(l => !l.includes('[tool:'));
    return own.some(l => /^\s*- text: Output\s*$/i.test(l))
      && own.some(l => new RegExp(`^\\s*- (paragraph|text|code): "?out-start-${n}"?\\s*$`).test(l))
      && own.some(l => l.includes(runtime.toolName('shell')));
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
  await input.fill(`[think:thinking-${n}][say:preview-${n}][tool:${runtime.toolName('shell')} ${cmd}] failing turn ${n}`);
  await input.press('Enter');
  // Previews stream and the tool starts; then the provider goes down for every follow-up and recovery attempt.
  // The tool call has been issued once the model has seen this prompt; the shell tool then runs for ~3s.
  await expect.poll(async () => (await runtime.modelLog()).some(e => !e.toolFollowUp && String(e.prompt).includes(`failing turn ${n}`)), { timeout: 15_000 }).toBe(true);
  try {
    await runtime.outage(400, 50);
    const error = page.locator(sel('agentPost')).filter({ hasText: /error|fail|exhausted/i });
    await expect(error).toHaveCount(1, { timeout: 120_000 });
  } finally {
    await runtime.outage(400, 0);
  }
  // The tool really ran: its output reached the model in the (failed) follow-up request.
  expect((await runtime.modelLog()).some(e => e.toolFollowUp && String(e.toolResult ?? '').includes(`tool-${n}`))).toBe(true);
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

test('@ux-chat-lifecycle-006 A streaming draft keeps every chunk in order', async ({ page, runtime, sel }) => {
  const n = nonce();
  const gate = gateName('chunks');
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill(`[say:alpha-${n} ][say:beta-${n} ][say:gamma-${n}][gate:${gate}] chunks ${n}`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);
  // The draft is transient UI outside the timeline; it must hold all three chunks in order.
  const inOrder = new RegExp(`alpha-${n}\\s*beta-${n}\\s*gamma-${n}`);
  await expect.poll(async () => inOrder.test(await page.locator('body').innerText().then(t => t.replace(new RegExp(`\\[say:[^\\]]*\\]`, 'g'), '')))).toBe(true);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `gamma-${n}` })).toHaveCount(0);
  await runtime.openGate(gate);
  const reply = page.locator(sel('agentPost')).filter({ hasText: `gamma-${n}` });
  await expect(reply).toHaveCount(1);
  expect((await reply.innerText()).replace(/\s+/g, ' ')).toMatch(inOrder);
});
