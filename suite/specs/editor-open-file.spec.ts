/**
 * The agent opens workspace files in the editor (features/classic/editor/editor-stability.feature, @ux-editor-006..008).
 * The fixture model calls the runtime's open-file tool (profile tools.openFile) with a workspace-relative path.
 */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { editorText, openWorkspace, purgeUntitled, tab, tabs, uncover, uploadFile } from '../workspace';

type Sel = (k: string) => string;
let created: string[] = [];

/** Run one turn whose agent asks to open `path` in a tab; resolves when the turn has replied. */
async function agentOpens(page: Page, runtime: any, sel: Sel, path: string, tag: string) {
  const call = `[tool:${runtime.toolName('openFile')} ${JSON.stringify({ path, target: 'tab' })}][after-tool:done-${tag}] open ${tag}`;
  await uncover(page, page.locator(sel('composeInput')));
  await page.locator(sel('composeInput')).fill(call);
  await page.locator(sel('sendButton')).click();
  await expect(page.locator(sel('agentPost')).filter({ hasText: `done-${tag}` })).toHaveCount(1, { timeout: 30_000 });
}

async function start(page: Page, runtime: any) {
  created = [];
  await page.goto((await runtime.newSession()).url);
  await openWorkspace(page);
  await purgeUntitled(page);
}

test.afterEach(async ({ page }) => {
  if (created.length && page.url().startsWith('http')) await purgeUntitled(page);
});

test('@ux-editor-006 The agent opens a workspace file in an editor tab', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const name = await uploadFile(page, 'opened by the agent');
  created.push(name);
  await agentOpens(page, runtime, sel, name, 'open');
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
  await expect(editorText(page, sel)).toHaveText('opened by the agent');
});

test('@ux-editor-007 The agent asks to open a file that cannot be opened', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  for (const [path, tag] of [['fx-missing-file.md', 'missing'], ['../outside.md', 'outside']]) {
    await agentOpens(page, runtime, sel, path, tag);
    await page.waitForTimeout(1000);
    await expect(tabs(page).getByRole('tab')).toHaveCount(0);
  }
});

test("@ux-editor-008 Another chat's request does not open files here", async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const name = await uploadFile(page, 'opened elsewhere');
  created.push(name);
  const other = await page.context().newPage();
  try {
    await other.goto((await runtime.newSession()).url);
    await agentOpens(other, runtime, sel, name, 'elsewhere');
    // The chat that asked shows it; the chat being viewed here does not.
    await expect(tab(other, name)).toBeVisible();
  } finally {
    await other.close();
  }
  await page.waitForTimeout(1500);
  await expect(tab(page, name)).toHaveCount(0);
});
