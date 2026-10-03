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

test('@ux-workspace-005 Expose reindex controls without a verified in-pane file-search field', async ({ page }) => {
  await menu(page).click();
  for (const item of [/^refresh tree$/i, /^reindex workspace$/i, /hidden/i, /new file/i])
    await expect(page.getByRole('menuitem', { name: item }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  // Upload is offered in the explorer itself (folder actions may be revealed on hover, so read the markup).
  const labels = await pane(page).locator('button, [role=button], [role=menuitem]').evaluateAll(es => es.map(e => e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || ''));
  expect(labels.some(l => /upload/i.test(l))).toBe(true);
  await expect(pane(page).getByRole('searchbox')).toHaveCount(0);
});

test('@ux-workspace-006 Single-click previews files and double-click enters rename', async ({ page }) => {
  const name = await uploadFile(page, 'click me');
  try {
    const other = await uploadFile(page, 'other');
    await (await rowOf(page, other)).click();
    await expect.poll(() => previewPath(page)).toBe(other);
    await (await rowOf(page, name)).click();
    await expect.poll(() => previewPath(page)).toBe(name);
    await (await rowOf(page, name)).dblclick();
    const box = pane(page).locator('input:not([type=file]):not([type=hidden])').first();
    await expect(box).toBeFocused();
    await expect(box).toHaveValue(name);
    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);
    await rowOf(page, name);
    await removeFiles(page, [other]);
  } finally {
    await removeFiles(page, [name]);
  }
});

/** Pick files in the explorer's upload input, as a user choosing them would. */
const pick = (page: Page, files: { name: string; text: string }[]) => pane(page).locator('input[type=file]').first().evaluate((input, files) => {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(new File([f.text], f.name, { type: 'text/markdown' }));
  (input as HTMLInputElement).files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}, files);

test('@ux-workspace-007 Upload files to the resolved folder with progress and overwrite prompts', async ({ page }, info) => {
  test.skip(/webkit/.test(info.project.name), "environment limit: Playwright's WebKit on Linux uploads files without their bytes");
  const n = randomUUID().slice(0, 8);
  const [a, b] = [fixtureName(), fixtureName()];
  try {
    // Two files at once: both land, and the last one is selected.
    await pick(page, [{ name: a, text: `first ${n}` }, { name: b, text: `second ${n}` }]);
    await rowOf(page, a);
    await rowOf(page, b);
    await expect.poll(() => previewPath(page)).toBe(b);
    // The same name again asks before overwriting; declining keeps the original.
    const prompts: string[] = [];
    page.on('dialog', d => { prompts.push(d.message()); void (prompts.length === 1 ? d.dismiss() : d.accept()); });
    await pick(page, [{ name: a, text: `replaced ${n}` }]);
    await expect.poll(() => prompts.length).toBe(1);
    expect(prompts[0]).toContain(a);
    await pick(page, [{ name: a, text: `replaced ${n}` }]);
    await expect.poll(() => prompts.length).toBe(2);
    await expect.poll(() => previewPath(page)).toBe(a);
    await expect(pane(page)).toContainText(`replaced ${n}`);
  } finally {
    await removeFiles(page, [a, b]);
  }
});
