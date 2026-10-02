/**
 * Thought panel disclosure (features/classic/compose/thoughts-panel.feature), observed through the rendered page only.
 * A turn streams numbered thought lines and is held at a gate so the status panel stays on screen.
 */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { gateName, type Runtime } from '../runtime';
import { randomUUID } from 'node:crypto';

const lines = (n: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `t${n}-${String(from + i).padStart(2, '0')}`);

async function holdThinking(page: Page, runtime: Runtime, sel: (k: string) => string, first: string[], gate: string, more: string[] = [], gate2?: string) {
  const directives = `[think:${first.join('\\n')}][gate:${gate}]` + (gate2 ? `[think:\\n${more.join('\\n')}][gate:${gate2}]` : '') + '[say:done]';
  const input = page.locator(sel('composeInput'));
  await input.fill(`${directives} think`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);
}

/** Visible page text outside timeline posts, one rendered line per entry (the prompt itself contains every line). */
async function statusLines(page: Page, postSel: string): Promise<Set<string>> {
  const text = await page.evaluate(ps => {
    let t = document.body.innerText;
    for (const post of document.querySelectorAll(ps)) t = t.replace((post as HTMLElement).innerText, '');
    return t;
  }, postSel);
  return new Set(text.split(/\n/).map(l => l.trim()));
}
const shown = (page: Page, postSel: string, line: string) => expect.poll(async () => (await statusLines(page, postSel)).has(line));
/** The Thoughts disclosure control: its title or accessible name mentions Thoughts (other panels have their own toggles). */
const moreControl = (page: Page) => page.getByTitle(/\bthoughts\b/i)
  .or(page.getByRole('button', { name: /\b(more|less|expand|collapse)\b.*\bthoughts\b|\bthoughts\b.*\b(more|less|expand|collapse)\b/i }))
  .first();

test('@ux-thoughts-001 Render collapsed thought content with disclosure state', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 6);
  const gate = gateName('think');
  await page.goto((await runtime.newSession()).url);
  const all = lines(n, 1, 15);
  await holdThinking(page, runtime, sel, all, gate);
  try {
    // Collapsed: the newest nine lines are shown, earlier ones are not.
    await expect.poll(async () => {
      const seen = await statusLines(page, sel('timelinePost'));
      return all.slice(-9).every(l => seen.has(l)) && all.slice(0, 6).every(l => !seen.has(l));
    }).toBe(true);
    await expect(moreControl(page)).toBeVisible();
  } finally { await runtime.openGate(gate); }
});

test('@ux-thoughts-002 Continue updating content independently of disclosure', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 6);
  const g1 = gateName('think1'), g2 = gateName('think2');
  await page.goto((await runtime.newSession()).url);
  await holdThinking(page, runtime, sel, lines(n, 1, 3), g1, lines(n, 4, 5), g2);
  try {
    await shown(page, sel('timelinePost'), `t${n}-03`).toBe(true);
    await runtime.openGate(g1);
    await expect.poll(async () => (await runtime.gates())[g2]?.waiting ?? 0).toBe(1);
    await shown(page, sel('timelinePost'), `t${n}-05`).toBe(true);
  } finally { await runtime.openGate(g1); await runtime.openGate(g2); }
});

test('@ux-thoughts-003 Toggle thought panel expansion', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 6);
  const gate = gateName('think');
  await page.goto((await runtime.newSession()).url);
  const all = lines(n, 1, 15);
  await holdThinking(page, runtime, sel, all, gate);
  try {
    await moreControl(page).click();
    await shown(page, sel('timelinePost'), all[0]).toBe(true);
    await shown(page, sel('timelinePost'), all[14]).toBe(true);
    await moreControl(page).click();
    await shown(page, sel('timelinePost'), all[0]).toBe(false);
    await shown(page, sel('timelinePost'), all[14]).toBe(true);
  } finally { await runtime.openGate(gate); }
});

test('@ux-thoughts-004 Collapse an expanded status panel with Escape', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 6);
  const gate = gateName('think');
  await page.goto((await runtime.newSession()).url);
  const all = lines(n, 1, 15);
  await holdThinking(page, runtime, sel, all, gate);
  try {
    await moreControl(page).click();
    await shown(page, sel('timelinePost'), all[0]).toBe(true);
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.keyboard.press('Escape');
    await shown(page, sel('timelinePost'), all[0]).toBe(false);
    await shown(page, sel('timelinePost'), all[14]).toBe(true);
  } finally { await runtime.openGate(gate); }
});

test('@ux-thoughts-005 Preserve text when changing disclosure state', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 6);
  const gate = gateName('think');
  await page.goto((await runtime.newSession()).url);
  const all = lines(n, 1, 15);
  await holdThinking(page, runtime, sel, all, gate);
  try {
    await moreControl(page).click();
    await moreControl(page).click();
    await moreControl(page).click();
    await expect.poll(async () => { const seen = await statusLines(page, sel('timelinePost')); return all.every(l => seen.has(l)); }).toBe(true);
  } finally { await runtime.openGate(gate); }
});
