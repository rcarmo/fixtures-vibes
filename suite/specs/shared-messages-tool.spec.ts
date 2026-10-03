/** Model-facing messages tool (features/canonical/shared-ux.feature @ux-shared-025). */
import { test, expect } from '../fixtures';
import { randomUUID } from 'node:crypto';

for (const [id, name] of [
  ['@ux-shared-025', 'Let the model identify bounded ranges of persisted messages'],
  ['@ux-original-025', 'Retrieve explicit message IDs and bounded row windows'],
] as const) test(`${id} ${name}`, async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const main = await runtime.newSession();
  const other = await runtime.newSession();
  const input = page.locator(sel('composeInput'));
  const turn = async (text: string, reply: string) => {
    await input.fill(`[reply:${reply}] ${text}`);
    await input.press('Enter');
    await expect(page.locator(sel('agentPost')).filter({ hasText: reply })).toHaveCount(1);
  };
  // Durable row IDs, read from each post's permalink.
  const rowIds = () => page.locator(sel('timelinePost')).evaluateAll(els =>
    els.map(e => Number((e.querySelector('a[href^="#msg-"]')?.getAttribute('href') ?? '').replace('#msg-', ''))));

  await page.goto(main.url);
  for (const k of [1, 2, 3]) await turn(`u${k} ${n}`, `r${k}-${n}`);
  const [u1, r1, u2, r2, u3, r3] = await rowIds();
  expect([u1, r1, u2, r2, u3, r3].every((id, i, all) => id > 0 && (i === 0 || id > all[i - 1]))).toBe(true);

  await page.goto(other.url);
  await turn(`foreign ${n}`, `foreign-${n}`);
  await page.goto(main.url);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `r3-${n}` })).toHaveCount(1);

  const callTool = async (tag: string, args: object) => {
    const json = JSON.stringify(args).replace(/[[\]]/g, m => `\\${m}`);
    await input.fill(`[tool:messages ${json}][after-tool:done-${tag}-${n}] ${tag} ${n}`);
    await input.press('Enter');
    await expect(page.locator(sel('agentPost')).filter({ hasText: `done-${tag}-${n}` })).toHaveCount(1);
    const followUps = (await runtime.modelLog()).filter(e => e.toolFollowUp && JSON.stringify(e.directives).includes(`done-${tag}-${n}`));
    expect(followUps).toHaveLength(1);
    return String(followUps[0].toolResult);
  };
  const rowsIn = (text: string) => [...text.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1]));

  const missing = 2_000_000_000;
  const got = await callTool('get', { action: 'get', row_ids: [u2, u3, missing], context_before: 1, context_after: 1 });
  expect(new Set(rowsIn(got))).toEqual(new Set([r1, u2, r2, u3, r3]));
  expect(got).not.toContain(String(missing));
  expect(got).not.toContain(`foreign-${n}`);

  const found = await callTool('win', { action: 'search', query: n, after_row: u2, limit: 2 });
  const count = Number(found.match(/Found (\d+) messages?/)?.[1]);
  const rows = rowsIn(found);
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(2);
  expect(rows).toHaveLength(count);
  expect(rows.every(id => id > u2)).toBe(true);
  expect(found).not.toContain(`foreign ${n}`);

  if (id === '@ux-original-025') {
    // Single-user mode: an explicit all-chat scope may be requested and then reaches other sessions.
    const all = await callTool('all', { action: 'search', query: `foreign ${n}`, chat_jid: '*', limit: 5 });
    expect(all).toContain(`foreign ${n}`);
  }

  // Returned content is data: no further model turn starts from it.
  await page.waitForTimeout(1500);
  expect((await runtime.modelLog()).filter(e => !e.toolFollowUp && e.prompt.includes(`win ${n}`))).toHaveLength(1);
});
