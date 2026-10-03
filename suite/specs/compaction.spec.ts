/**
 * Classic compaction and model controls (features/classic/compose/compaction-model-switch.feature).
 * Compaction needs history beyond the runtime's kept tail: a short first turn, then two large ones (each under the
 * 100 KB message limit). Summary requests are scripted on the fixture model (control/script), since runtimes word
 * their summary prompts differently; the scripted summaries follow the structured checkpoint format Piclaw validates.
 */
import { test, expect } from '../fixtures';
import { gateName } from '../runtime';
import { entries, modelList, MODEL_ONE, MODEL_TWO } from '../pickers';
import type { Page } from '@playwright/test';

type Sel = (k: string) => string;
const md = (heads: string[], chunk: boolean) => heads.map(h => `## ${h}\\n` + (h !== 'Progress' ? `- fixture ${h.toLowerCase()}.`
  : chunk ? '- Done: fixture turns.\\n- In progress: none.\\n- Blocked: none.'
  : '### Done\\n- fixture turns.\\n### In Progress\\n- none.\\n### Blocked\\n- none.')).join('\\n\\n');
const CHUNK = md(['Chunk Range', 'Goals / User Intent', 'Constraints & Preferences', 'Decisions', 'Files / Commands / Tool Outcomes', 'Progress', 'Open Questions / Next Steps', 'Key Continuity Facts'], true);
const FINAL = md(['Goal', 'Current Active Topic', 'Historical / Background Context', 'Constraints & Preferences', 'Progress', 'Key Decisions', 'Next Steps', 'Critical Context'], false);

const meter = (page: Page) => page.getByRole('button', { name: /^context/i }).first();
const modelButton = (page: Page) => page.getByRole('button', { name: /model picker/i }).first();
const meterName = async (page: Page) => (await meter(page).getAttribute('aria-label')) ?? (await meter(page).innerText());

async function turn(page: Page, sel: Sel, text: string, reply: string) {
  await page.locator(sel('composeInput')).fill(text);
  await page.locator(sel('sendButton')).click();
  await expect(page.locator(sel('agentPost')).filter({ hasText: reply })).toHaveCount(1, { timeout: 30_000 });
}
/** A session with enough history to compact, then compaction started from the meter and held at `gate`. */
async function compacting(page: Page, runtime: any, sel: Sel, gate: string) {
  test.setTimeout(120_000);
  await page.goto((await runtime.newSession()).url);
  await turn(page, sel, '[reply:first-ok] first', 'first-ok');
  const filler = Array.from({ length: 9500 }, (_, i) => `word${i % 97}`).join(' ');
  await turn(page, sel, `[reply:big-ok] ${filler}`, 'big-ok');
  await turn(page, sel, `[reply:big2-ok] ${filler}`, 'big2-ok');
  const before = await meterName(page);
  // Only summary requests take the script: runtimes may make other model calls (titles, estimates) meanwhile.
  await runtime.script([{ when: 'summar', prompt: `[gate:${gate}][reply:${CHUNK}]` }, { when: 'summar', prompt: `[reply:${FINAL}]` }]);
  await meter(page).click();
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0, { timeout: 30_000 }).toBe(1);
  return before;
}

test('@ux-compaction-001 Render compaction using supplied status state', async ({ page, runtime, sel }) => {
  const gate = gateName('compact');
  await compacting(page, runtime, sel, gate);
  // The meter shows the compacting state with a running elapsed label, and says so in its accessible label.
  await expect.poll(() => meterName(page)).toMatch(/compacting/i);
  await expect(meter(page)).toContainText(/\d+:\d{2}/);
  await runtime.openGate(gate);
});

test('@ux-compaction-002 Reconcile compaction events with client status', async ({ page, runtime, sel }) => {
  const gate = gateName('compact');
  await compacting(page, runtime, sel, gate);
  await expect.poll(() => meterName(page)).toMatch(/compacting/i);
  await runtime.openGate(gate);
  // The accepted completion ends the compacting state and reports the outcome.
  await expect(page.locator(sel('agentPost')).filter({ hasText: /compaction complete/i })).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(() => meterName(page), { timeout: 30_000 }).not.toMatch(/compacting/i);
});

test('@ux-compaction-003 Request stop through the visible compaction control', async ({ page, runtime, sel }) => {
  const gate = gateName('compact');
  await compacting(page, runtime, sel, gate);
  const stop = page.getByRole('button', { name: /stop/i }).first();
  await expect(stop).toBeVisible();
  const sent = page.waitForRequest(r => r.method() !== 'GET');
  await stop.click();
  await sent;
  // The held summary request is cancelled, and the display follows the later status: no longer compacting.
  await expect.poll(async () => (await runtime.modelLog()).filter((e: any) => e.scripted).some((e: any) => e.aborted)).toBe(true);
  await expect.poll(() => meterName(page), { timeout: 30_000 }).not.toMatch(/compacting/i);
  await expect(page.locator(sel('agentPost')).filter({ hasText: /compaction (cancel|abort|stop)/i })).toHaveCount(1);
});

test('@ux-compaction-004 Use refreshed usage rather than assume compaction always shrinks context', async ({ page, runtime, sel }) => {
  const gate = gateName('compact');
  const before = await compacting(page, runtime, sel, gate);
  await runtime.openGate(gate);
  await expect(page.locator(sel('agentPost')).filter({ hasText: /compaction complete/i })).toHaveCount(1, { timeout: 30_000 });
  // The meter shows the refreshed usage; whether it went up or down is not asserted (here it rises from the
  // fixture's reported 12 tokens to the runtime's estimate of the compacted context).
  await expect.poll(() => meterName(page), { timeout: 30_000 }).not.toBe(before);
  expect(await meterName(page)).toMatch(/\d[\d.]*K? \/ [\d.]+K/);
});

test('@ux-compaction-006 Check model context compatibility before switching', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  // Reported usage beyond every fixture model's 128K window: the other model cannot take this context.
  await turn(page, sel, '[usage:130000][reply:huge-ok] huge', 'huge-ok');
  await modelButton(page).click();
  await page.keyboard.type('fixture-2');
  const blocked = entries(modelList(page), MODEL_TWO).first();
  await expect(blocked).toHaveAttribute('aria-disabled', 'true');
  await blocked.click({ force: true });
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await expect(modelButton(page)).toContainText(MODEL_ONE);
  await expect(modelButton(page)).not.toContainText(MODEL_TWO);
});

test('@ux-compaction-007 Refresh model information after an accepted switch', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  await turn(page, sel, '[reply:warm-ok] warm', 'warm-ok');
  await modelButton(page).click();
  await page.keyboard.type('fixture-2');
  await entries(modelList(page), MODEL_TWO).first().click();
  // The accepted switch relabels the model; context information is shown against the new model's window.
  await expect(modelButton(page)).toContainText(MODEL_TWO);
  await expect.poll(() => meterName(page)).toMatch(/\/ 128K/);
  const n = gateName('after');
  await turn(page, sel, `[reply:${n}-ok] ${n}`, `${n}-ok`);
  expect((await runtime.modelLog()).filter((e: any) => !e.scripted && e.prompt.includes(n)).map((e: any) => e.model)).toEqual(['fixture-2']);
});

test('@ux-compaction-008 Handle a model command using the configured provider catalogue', async ({ page, runtime, sel }) => {
  const command = runtime.profile.commands?.selectModel;
  if (!command) throw new Error('@cap-compaction requires commands.selectModel');
  await page.goto((await runtime.newSession()).url);
  await turn(page, sel, '[reply:warm-ok] warm', 'warm-ok');
  const send = async (model: string) => {
    await page.locator(sel('composeInput')).fill(command.replace('{model}', model));
    await page.locator(sel('sendButton')).click();
  };
  await send('fixture-2');
  await expect(modelButton(page)).toContainText(MODEL_TWO);
  // An unknown model is an error the user can see, not a selection.
  const unknown = `nope-${gateName('m')}`;
  await send(unknown);
  await expect(page.getByText(new RegExp(`(not found|unknown|invalid).*${unknown}|${unknown}.*(not found|unknown|invalid)`, 'i')).first()).toBeVisible();
  await expect(modelButton(page)).toContainText(MODEL_TWO);
});
