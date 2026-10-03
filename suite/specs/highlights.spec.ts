/** Text highlights on posts (features/classic/timeline/annotation-highlights.feature @ux-timeline-008..012). */
import { test, expect } from '../fixtures';
import { rgb } from '../colour';
import { randomUUID } from 'node:crypto';
import type { Page, Locator } from '@playwright/test';

type Sel = (k: string) => string;
const COLOURS = ['yellow', 'green', 'blue', 'pink', 'orange'];
const colourButton = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^highlight ${name}$`, 'i') });

/** An agent post with `body` (unique per test). */
async function textPost(page: Page, runtime: any, sel: Sel, body: string) {
  await page.goto((await runtime.newSession()).url);
  await page.locator(sel('composeInput')).fill(`[reply:${body}] go`);
  await page.locator(sel('composeInput')).press('Enter');
  const post = page.locator(sel('agentPost')).filter({ hasText: body.split(' ')[1] });
  await expect(post).toHaveCount(1);
  return post;
}
/** Select the last occurrence of `phrase` inside `post` (as a user drag would); returns its viewport rect. */
const select = (post: Locator, phrase: string) => post.evaluate((el, phrase) => {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node: Text | null = null;
  while (w.nextNode()) if ((w.currentNode as Text).data.includes(phrase)) node = w.currentNode as Text;
  const at = node!.data.lastIndexOf(phrase);
  const r = document.createRange();
  r.setStart(node!, at); r.setEnd(node!, at + phrase.length);
  getSelection()!.removeAllRanges(); getSelection()!.addRange(r);
  const b = r.getBoundingClientRect();
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}, phrase);
/** The toolbar's extent: the union of its colour buttons. */
async function toolbarBox(page: Page) {
  const boxes = await Promise.all(COLOURS.map(c => colourButton(page, c).boundingBox()));
  const b = boxes.filter(Boolean) as { x: number; y: number; width: number; height: number }[];
  const x = Math.min(...b.map(r => r.x)), y = Math.min(...b.map(r => r.y));
  return { x, y, width: Math.max(...b.map(r => r.x + r.width)) - x, height: Math.max(...b.map(r => r.y + r.height)) - y };
}
/** Highlighted runs in the post: text, background colour and the text just before each. */
const highlights = (post: Locator) => post.evaluate(root => [...root.querySelectorAll('mark')].map(e => {
  const r = document.createRange(); r.setStart(root, 0); r.setEndBefore(e);
  return { text: e.textContent ?? '', bg: getComputedStyle(e).backgroundColor, before: r.toString() };
}));
const hue = (c: string) => { const [r, g, b] = rgb(c); return { r, g, b }; };

test('@ux-timeline-008 Selecting text shows highlight colors', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const post = await textPost(page, runtime, sel, `alpha ${n} bravo charlie`);
  await select(post, 'bravo charlie');
  for (const c of COLOURS) await expect(colourButton(page, c)).toBeVisible();
});

for (const [id, title] of [
  ['@ux-timeline-009', 'Clicking a highlight color persists the saved selection snapshot'],
  ['@ux-timeline-010', 'Highlights persist via post annotations'],
] as const) test(`${id} ${title}`, async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  // The phrase occurs twice; the second one is selected, so the saved position matters.
  const post = await textPost(page, runtime, sel, `alpha charlie ${n} delta echo alpha charlie`);
  await select(post, 'alpha charlie');
  await expect(colourButton(page, 'yellow')).toBeVisible();
  // Pressing the button clears the live selection before the click lands; the snapshot taken at selection is used.
  await page.evaluate(() => window.addEventListener('pointerdown', () => getSelection()?.removeAllRanges(), { capture: true, once: true }));
  await colourButton(page, 'yellow').click();
  const check = async () => {
    await expect.poll(async () => (await highlights(post)).length).toBe(1);
    const [h] = await highlights(post);
    expect(h.text).toBe('alpha charlie');
    expect(h.before).toContain(`${n} delta echo`);
    const { r, g, b } = hue(h.bg);
    expect(r > b && g > b).toBe(true); // yellow
  };
  await check();
  // Saved with the post: text, position and colour survive a reload.
  await page.reload();
  await expect(post).toHaveCount(1);
  await check();
});

test('@ux-timeline-011 Desktop highlight toolbar stays near the selection', async ({ page, runtime, sel }, info) => {
  test.skip(!!info.project.use.hasTouch, 'fine-pointer scenario: this project emulates a touch screen');
  const n = randomUUID().slice(0, 8);
  const post = await textPost(page, runtime, sel, `alpha ${n} bravo charlie`);
  const range = await select(post, 'bravo charlie');
  await expect(colourButton(page, 'yellow')).toBeVisible();
  const bar = await toolbarBox(page), vp = page.viewportSize()!;
  // Just above or below the selection, and on screen.
  const gap = Math.min(Math.abs(range.y - (bar.y + bar.height)), Math.abs(bar.y - (range.y + range.height)));
  expect(gap).toBeLessThan(60);
  expect(bar.x).toBeGreaterThanOrEqual(0);
  expect(bar.y).toBeGreaterThanOrEqual(0);
  expect(bar.x + bar.width).toBeLessThanOrEqual(vp.width);
  expect(bar.y + bar.height).toBeLessThanOrEqual(vp.height);
});

test('@ux-timeline-012 Coarse-pointer highlight toolbar docks away from the selection', async ({ page, runtime, sel }, info) => {
  test.skip(!info.project.use.hasTouch, 'coarse-pointer scenario: this project has a fine pointer');
  const n = randomUUID().slice(0, 8);
  const post = await textPost(page, runtime, sel, `alpha ${n} bravo charlie`);
  await select(post, 'bravo charlie');
  await expect(colourButton(page, 'yellow')).toBeVisible();
  const bar = await toolbarBox(page), vp = page.viewportSize()!;
  // Docked: centred at the bottom of the screen, clear of the system selection menu.
  expect(Math.abs(bar.x + bar.width / 2 - vp.width / 2)).toBeLessThan(40);
  expect(vp.height - (bar.y + bar.height)).toBeLessThan(80);
});
