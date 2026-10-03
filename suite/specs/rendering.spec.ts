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
