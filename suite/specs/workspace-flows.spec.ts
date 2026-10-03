/**
 * Workspace explorer file flows (features/classic/canonical/workspace-flows.feature @ux-workspace-001..004). Rows are
 * found with rowOf, which refreshes past the stale-root listing defect (rcarmo/piclaw#1520).
 */
import { test, expect } from '../fixtures';
import { pane, menu, openWorkspace, previewPath, treeRow, newFile, uploadFile, removeFiles, purgeUntitled, rowOf, fixtureName } from '../workspace';
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

const gone = async (page: Page, name: string) => {
  for (let i = 0; i < 3 && (await treeRow(page, name)); i++) {
    await pane(page).getByRole('button', { name: /^refresh tree$/i }).click();
    await page.waitForTimeout(600);
  }
  expect(await treeRow(page, name)).toBeNull();
};

test.beforeEach(async ({ page, runtime }) => {
  await page.goto((await runtime.newSession()).url);
  await openWorkspace(page);
});

test('@ux-workspace-001 Create a new untitled markdown file in the resolved folder', async ({ page }) => {
  await purgeUntitled(page);
  const created: string[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const name = await newFile(page);
      created.push(name);
      // The new file is selected and listed.
      expect(name).toMatch(/^untitled(-\d+)?\.md$/);
      expect(await previewPath(page)).toBe(name);
      await rowOf(page, name);
    }
    // The second try falls back to a numbered name.
    expect(created[0]).toBe('untitled.md');
    expect(created[1]).toMatch(/^untitled-\d+\.md$/);
  } finally {
    await removeFiles(page, created.reverse());
  }
});

test('@ux-workspace-002 Rename a selected non-root workspace entry', async ({ page }) => {
  const from = await uploadFile(page, 'rename me');
  const to = fixtureName();
  try {
    await (await rowOf(page, from)).click();
    await expect.poll(() => previewPath(page)).toBe(from);
    await (await rowOf(page, from)).dblclick();
    const box = pane(page).locator('input:not([type=file]):not([type=hidden])').first();
    await expect(box).toBeFocused();
    await box.fill(`  ${to}  `);
    await box.press('Enter');
    // The renamed path is selected and previewed; the old one is gone.
    await expect.poll(() => previewPath(page)).toBe(to);
    await rowOf(page, to);
    await gone(page, from);
  } finally {
    await removeFiles(page, [to, from]);
  }
});

test('@ux-workspace-003 Delete a selected file after confirmation', async ({ page }) => {
  const name = await uploadFile(page, 'delete me');
  try {
    await (await rowOf(page, name)).click();
    await expect.poll(() => previewPath(page)).toBe(name);
    // Declined: nothing is deleted.
    page.once('dialog', d => void d.dismiss());
    await pane(page).getByRole('button', { name: /^delete file$/i }).click();
    await page.waitForTimeout(800);
    await rowOf(page, name);
    // Confirmed with the filename: the file goes and the selection clears.
    await (await rowOf(page, name)).click();
    await expect.poll(() => previewPath(page)).toBe(name);
    page.once('dialog', d => void d.accept(d.type() === 'prompt' ? name : undefined));
    await pane(page).getByRole('button', { name: /^delete file$/i }).click();
    await expect.poll(() => previewPath(page)).not.toBe(name);
    await gone(page, name);
    await page.reload();
    await openWorkspace(page);
    expect(await treeRow(page, name)).toBeNull();
  } finally {
    await removeFiles(page, [name]).catch(() => {});
  }
});

test('@ux-workspace-004 Toggle hidden files and reload the visible tree state', async ({ page }) => {
  const hidden = `.fx-${randomUUID().slice(0, 8)}.md`;
  await uploadFile(page, 'hidden', hidden).catch(() => {});
  const toggle = async () => {
    await menu(page).click();
    await page.getByRole('menuitem', { name: /hidden/i }).first().click();
    await page.waitForTimeout(800);
  };
  const shown = async () => !!(await treeRow(page, hidden));
  const initially = await shown();
  try {
    await toggle();
    await expect.poll(shown).toBe(!initially);
    // The choice survives a reload.
    await page.reload();
    await openWorkspace(page);
    await expect.poll(shown).toBe(!initially);
    await toggle();
    await expect.poll(shown).toBe(initially);
  } finally {
    if (!(await shown())) await toggle();
    await removeFiles(page, [hidden]).catch(() => {});
    if (initially !== (await shown())) await toggle();
  }
});
