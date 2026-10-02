/**
 * Plan sidebar (shared @ux-shared-009..012 and Classic @ux-original-009..012 describe the same contracts).
 * The model drives the session-scoped "plan" tool through fixture tool directives; the UI is read via its editor textbox.
 */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import type { Runtime } from '../runtime';
import { randomUUID } from 'node:crypto';

const esc = (s: string) => s.replace(/[[\]]/g, m => '\\' + m);

async function send(page: Page, sel: (k: string) => string, text: string, reply: string) {
  const input = page.locator(sel('composeInput'));
  // Start each turn from an idle composer, and confirm the submission was accepted.
  await expect(page.locator(sel('stopButton'))).toHaveCount(0, { timeout: 20_000 });
  await input.fill(text);
  // A submit can be dropped while the previous turn settles; the draft stays put, so resubmitting is safe.
  await expect(async () => {
    if ((await input.inputValue()) === text) await input.press('Enter');
    await expect(input).toHaveValue('', { timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.locator(sel('agentPost')).filter({ hasText: reply })).toHaveCount(1, { timeout: 20_000 });
}

/** Run one plan tool call; returns the tool result text the model received. */
async function planTool(page: Page, runtime: Runtime, sel: (k: string) => string, args: object, n: string) {
  const activation = runtime.activationTurn(['plan']);
  if (activation) await send(page, sel, `${activation.replace('[after-tool:activated]', `[after-tool:activated-${n}]`)} activate ${n}`, `activated-${n}`);
  const tag = `plan-${randomUUID().slice(0, 6)}`;
  await send(page, sel, `[tool:plan ${esc(JSON.stringify(args))}][after-tool:${tag}] plan ${n}`, tag);
  const log = await runtime.modelLog();
  return String(log.filter(e => e.toolFollowUp).at(-1)?.toolResult ?? '');
}

async function showPlan(page: Page) {
  const editor = page.getByRole('region', { name: /checklist editor/i }).getByRole('textbox');
  // The add-on mounts after the shell; retry the toggle until the editor is shown.
  await expect(async () => {
    if (!(await editor.isVisible())) {
      const show = page.getByRole('button', { name: /^Show plan\b/i });
      if (await show.count()) await show.first().click();
    }
    await expect(editor).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  return editor;
}

const editorText = async (editor: ReturnType<Page['locator']>) => (await editor.innerText()).replace(/\u00a0/g, ' ').trim();

async function replaceEditor(page: Page, editor: ReturnType<Page['locator']>, text: string) {
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(text);
}

for (const id of ['@ux-shared-009', '@ux-original-009']) {
  test(`${id} Edit and save Plan Markdown`, async ({ page, runtime, sel }) => {
    const n = randomUUID().slice(0, 8);
    await page.goto((await runtime.newSession()).url);
    const editor = await showPlan(page);
    await replaceEditor(page, editor, `- [ ] saved ${n}`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    expect(await planTool(page, runtime, sel, { action: 'read' }, n)).toContain(`saved ${n}`);
    await page.reload();
    await expect.poll(async () => editorText(await showPlan(page))).toContain(`saved ${n}`);
  });
}

for (const id of ['@ux-shared-010', '@ux-original-010']) {
  test(`${id} Preserve dirty Plan text on a remote update`, async ({ page, runtime, sel }) => {
    const n = randomUUID().slice(0, 8);
    await page.goto((await runtime.newSession()).url);
    const editor = await showPlan(page);
    await replaceEditor(page, editor, `- [ ] local ${n}`);
    await planTool(page, runtime, sel, { action: 'write', markdown: `- [ ] remote ${n}` }, n);
    await page.waitForTimeout(1500);
    expect(await editorText(editor)).toContain(`local ${n}`);
    page.on('dialog', d => void d.accept());
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(async () => editorText(editor)).toContain(`remote ${n}`);
  });
}

for (const id of ['@ux-shared-011', '@ux-original-011']) {
  test(`${id} Submit Plan to the captured session`, async ({ page, runtime, sel }) => {
    const n = randomUUID().slice(0, 8);
    await page.goto((await runtime.newSession()).url);
    const editor = await showPlan(page);
    await replaceEditor(page, editor, `- [ ] submit ${n}`);
    const input = page.locator(sel('composeInput'));
    await input.fill(`draft ${n}`);
    await page.getByRole('button', { name: /submit to model/i }).click();
    // The saved Plan becomes a message in this session; the composer draft is untouched.
    await expect(page.locator(sel('timelinePost')).filter({ hasText: `submit ${n}` }).first()).toBeVisible({ timeout: 20_000 });
    await expect(input).toHaveValue(`draft ${n}`);
    await page.reload();
    await expect.poll(async () => editorText(await showPlan(page))).toContain(`submit ${n}`);
  });
}

for (const id of ['@ux-shared-012', '@ux-original-012']) {
  test(`${id} Plan Markdown, progress and the session-scoped plan tool`, async ({ page, runtime, sel }) => {
    const n = randomUUID().slice(0, 8);
    const markdown = `## Heading ${n}\n- [ ] pending ${n}\n- [-] doing ${n}\n- [x] done ${n}`;
    await page.goto((await runtime.newSession()).url);
    expect(await planTool(page, runtime, sel, { action: 'write', markdown }, n)).not.toMatch(/error|not found/i);
    await page.reload();
    const editor = await showPlan(page);
    const text = await editorText(editor);
    for (const line of markdown.split('\n')) expect(text).toContain(line);
    // Progress derives from checklist items only (the heading is not an item).
    await expect(page.getByText(/1\s*\/\s*3/).or(page.getByRole('button', { name: /1\/3/ })).first()).toBeAttached();
    expect(await planTool(page, runtime, sel, { action: 'read' }, n)).toContain(`- [-] doing ${n}`);
    // Another session's Plan is unchanged.
    await page.goto((await runtime.newSession()).url);
    expect(await editorText(await showPlan(page))).not.toContain(n);
  });
}
