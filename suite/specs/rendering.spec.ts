/** Timeline rendering and post actions (features/classic/timeline/rendering.feature). */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { recordClipboard } from '../clipboard';

type Sel = (k: string) => string;
const tag = () => `r-${Math.random().toString(16).slice(2, 8)}`;

/** One turn whose agent reply is `markdown` (\n escapes become newlines); returns the reply post. */
async function agentPosts(page: Page, runtime: any, sel: Sel, markdown: string) {
  await page.goto((await runtime.newSession()).url);
  const t = tag();
  // Brackets inside a directive value are escaped for the fixture model.
  const value = markdown.replace(/[[\]]/g, m => `\\${m}`);
  await page.locator(sel('composeInput')).fill(`[reply:${t}\\n\\n${value}] go`);
  await page.locator(sel('sendButton')).click();
  const post = page.locator(sel('agentPost')).filter({ hasText: t });
  await expect(post).toHaveCount(1, { timeout: 30_000 });
  return post;
}

test('@ux-timeline-023 Markdown tables render as full-width tables with automatic layout', async ({ page, runtime, sel }) => {
  const post = await agentPosts(page, runtime, sel, '| Name | Value |\\n|---|---|\\n| alpha | 1 |\\n| beta | 2 |');
  const table = post.locator('table').first();
  await expect(table).toBeVisible();
  const style = await table.evaluate(t => ({ display: getComputedStyle(t).display, layout: getComputedStyle(t).tableLayout, width: t.getBoundingClientRect().width, parent: (t.closest('.post, article, [class*=post]') ?? t.parentElement!).getBoundingClientRect().width }));
  expect(style.display).toBe('table');
  expect(style.layout).toBe('auto');
  // Spans the post's content width (allowing for the post's padding).
  expect(style.width).toBeGreaterThan(style.parent * 0.8);
});

test('@ux-timeline-024 Code blocks expose a copy button in the top-right corner', async ({ page, runtime, sel }) => {
  const clip = await recordClipboard(page);
  const post = await agentPosts(page, runtime, sel, '```\\nconst answer = 42;\\n```');
  const block = post.locator('pre').first();
  await block.hover();
  const copy = post.getByRole('button', { name: /copy/i }).filter({ visible: true }).first();
  await expect(copy).toBeVisible();
  const b = (await block.boundingBox())!;
  const c = (await copy.boundingBox())!;
  // Top-right corner of the block.
  expect(c.x + c.width / 2).toBeGreaterThan(b.x + b.width / 2);
  expect(c.y + c.height / 2).toBeLessThan(b.y + b.height / 2);
  await copy.click();
  await expect.poll(async () => (await clip()).join('\n')).toContain('const answer = 42;');
});

test('@ux-timeline-025 Resource links and link previews open in a new tab', async ({ page, runtime, sel }) => {
  const post = await agentPosts(page, runtime, sel, '[fixture link](https://example.com/fixture)');
  const link = post.getByRole('link', { name: 'fixture link' });
  await expect(link).toHaveAttribute('target', '_blank');
  expect((await link.getAttribute('rel')) ?? '').toMatch(/(?=.*\bnoopener\b)(?=.*\bnoreferrer\b)/);
  const opened = page.context().waitForEvent('page');
  await link.click();
  const tab = await opened;
  expect(tab.url()).toContain('example.com/fixture');
  await tab.close();
});

test('@ux-timeline-026 Outcome chips render after the timestamp in post metadata', async ({ page, runtime, sel }) => {
  test.setTimeout(120_000);
  await page.goto((await runtime.newSession()).url);
  const t = tag();
  // A turn the provider refuses ends with an outcome (failure) marker on the agent post.
  await page.locator(sel('composeInput')).fill(`[fail:400] outcome ${t}`);
  await page.locator(sel('sendButton')).click();
  const post = page.locator(sel('agentPost')).last();
  await expect(post).toBeVisible({ timeout: 90_000 });
  // The timestamp is the post's permalink; the chip is the next item on its row.
  const time = post.getByRole('link').first();
  const chip = time.locator('xpath=following-sibling::*[1]');
  await expect(chip).toBeVisible({ timeout: 30_000 });
  await expect(chip).toHaveText(/\S/);
  const [a, b] = [(await time.boundingBox())!, (await chip.boundingBox())!];
  expect(b.x).toBeGreaterThanOrEqual(a.x + a.width - 1);
  expect(Math.abs((b.y + b.height / 2) - (a.y + a.height / 2))).toBeLessThan(10);
});

/** A scripted speech engine: records speak/cancel and reports what is speaking. */
const fakeSpeech = (page: Page) => page.addInitScript(() => {
  const log: string[] = [];
  let current: any = null;
  class Utterance { text: string; onend: any = null; onerror: any = null; onstart: any = null; constructor(t: string) { this.text = t; } }
  const synth = {
    get speaking() { return !!current; }, pending: false, paused: false,
    speak(u: any) { log.push(`speak:${u.text}`); current = u; u.onstart?.({}); },
    cancel() { log.push('cancel'); const u = current; current = null; u?.onend?.({}); },
    pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => synth });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: Utterance });
  (window as any).__speechLog = log;
});

test('@ux-timeline-027 Read aloud appears only when browser speech support and speakable text both exist', async ({ page, runtime, sel, browser }) => {
  await fakeSpeech(page);
  const post = await agentPosts(page, runtime, sel, 'Some speakable words.');
  await expect(post.getByRole('button', { name: /^read aloud$/i })).toHaveCount(1);
  // Without speech synthesis the action is absent.
  const other = await browser.newContext(test.info().project.use);
  try {
    const bare = await other.newPage();
    await bare.addInitScript(() => {
      delete (Window.prototype as any).speechSynthesis; delete (window as any).speechSynthesis;
      delete (window as any).SpeechSynthesisUtterance;
    });
    await bare.goto(page.url());
    const same = bare.locator(sel('agentPost')).filter({ hasText: 'Some speakable words.' });
    await expect(same).toHaveCount(1);
    await expect(same.getByRole('button', { name: /read aloud/i })).toHaveCount(0);
  } finally { await other.close(); }
});

test('@ux-timeline-028 Starting read aloud on another post transfers playback ownership', async ({ page, runtime, sel }) => {
  await fakeSpeech(page);
  const first = await agentPosts(page, runtime, sel, 'First words to read.');
  const t = tag();
  await page.locator(sel('composeInput')).fill(`[reply:${t} Second words to read.] again`);
  await page.locator(sel('sendButton')).click();
  const second = page.locator(sel('agentPost')).filter({ hasText: t });
  await expect(second).toHaveCount(1);
  await first.getByRole('button', { name: /^read aloud$/i }).click();
  await expect(first.getByRole('button', { name: /stop reading/i })).toHaveCount(1);
  await second.getByRole('button', { name: /^read aloud$/i }).click();
  // The earlier playback is cancelled; the new post is the speaking one.
  await expect(second.getByRole('button', { name: /stop reading/i })).toHaveCount(1);
  await expect(first.getByRole('button', { name: /^read aloud$/i })).toHaveCount(1);
  const log: string[] = await page.evaluate(() => (window as any).__speechLog);
  const speaks = log.map((e, i) => [e, i] as const).filter(([e]) => e.startsWith('speak:'));
  expect(speaks).toHaveLength(2);
  expect(speaks[1][0]).toContain('Second words');
  expect(log.slice(speaks[0][1] + 1, speaks[1][1])).toContain('cancel');
});
