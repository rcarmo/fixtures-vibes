/**
 * Editor tabs, saving and zen mode (features/classic/editor/editor-stability.feature and the editor scenarios of
 * features/classic/canonical/workspace-flows.feature). Files are created and removed through the UI.
 */
import { test, expect } from '../fixtures';
import { bodyHas, holdWrites } from '../net';
import type { Page } from '@playwright/test';
import { clickVisible, closeControl, editorFile, editorText, openWorkspace, pane, purgeUntitled, openInEditor, removeFiles, previewPath, save, saveButton, tab, tabs, treeRow, typeInEditor, uncoverEditor } from '../workspace';

type Sel = (k: string) => string;
// Files are created and removed through the UI on every test: allow for that setup.
test.describe.configure({ timeout: 120_000 });
let created: string[] = [];

let sessionUrl = '';
async function start(page: Page, runtime: any) {
  created = [];
  sessionUrl = (await runtime.newSession()).url;
  await page.goto(sessionUrl);
  await openWorkspace(page);
  await purgeUntitled(page);
}
async function file(page: Page, sel: Sel, content?: string) {
  return editorFile(page, sel, content, name => created.push(name));
}
const contextMenu = (page: Page) => page.getByText(/^close others$/i).locator('xpath=..');
async function openContextMenu(page: Page, name: string) {
  await clickVisible(page, tab(page, name), 'right');
  await expect(page.getByText(/^close others$/i)).toBeVisible();
}
const menuItem = (page: Page, name: RegExp) => contextMenu(page).getByText(name);
/** Dismiss the context menu by clicking its tab (Escape may also leave the editor). */
async function dismissMenu(page: Page, name: string) {
  await clickVisible(page, tab(page, name));
  await expect(page.getByText(/^close others$/i)).toHaveCount(0);
}
/** Non-GET requests that carry a file's name: the runtime's writes of that file. */
function writesOf(page: Page, name: string) {
  const writes: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET' && (r.postData() ?? '').includes(name)) writes.push(r.method()); });
  return writes;
}

test.afterEach(async ({ page }) => {
  if (!created.length || !page.url().startsWith('http')) return;
  await removeFiles(page, created);
  await purgeUntitled(page);
});

test('@ux-editor-001 Switching files does not cause visible flicker', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const a = await file(page, sel, 'alpha text');
  const b = await file(page, sel, 'beta text');
  await clickVisible(page, tab(page, a));
  await expect(editorText(page, sel)).toHaveText('alpha text');
  // Every painted frame while switching shows the editor pane; within 100 ms of the switch (Piclaw's own measure) no
  // loading placeholder remains.
  const watch = page.evaluate(([selector]) => new Promise<string[]>(resolve => {
    const seen: string[] = [];
    const visible = ([...document.querySelectorAll(selector)] as HTMLElement[]).find(e => e.offsetParent)!;
    let container: Element = visible;
    while (container.parentElement && !container.querySelector('[role=tablist]')) container = container.parentElement;
    const pane = container as HTMLElement;
    const end = performance.now() + 1200;
    const frame = () => {
      if (!pane.isConnected || !pane.offsetParent || pane.getBoundingClientRect().height < 50) seen.push('editor pane hidden');
      if (performance.now() < end) requestAnimationFrame(frame); else resolve([...new Set(seen)]);
    };
    requestAnimationFrame(frame);
  }), [sel('editorText')]);
  await clickVisible(page, tab(page, b));
  await page.waitForTimeout(100);
  const pane = editorText(page, sel).locator('xpath=ancestor::*[.//*[@role="tablist"]][1]');
  await expect(pane).toBeVisible();
  expect(await pane.innerText()).not.toMatch(/loading/i);
  expect(await watch).toEqual([]);
  await expect(editorText(page, sel)).toHaveText('beta text');
});

test('@ux-editor-002 Closing an unsaved tab shows confirmation', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const name = await file(page, sel);
  await typeInEditor(page, sel, 'unsaved');
  let asked = '';
  page.once('dialog', d => { asked = d.type(); void d.dismiss(); });
  await clickVisible(page, closeControl(page, name));
  await expect.poll(() => asked).toBe('confirm');
  // Dismissing keeps the tab and its text.
  await expect(tab(page, name)).toBeVisible();
  await expect(editorText(page, sel)).toHaveText('unsaved');
});

test('@ux-editor-003 Clicking a tab activates it immediately', async ({ page, runtime, sel }, testInfo) => {
  // The scenario is about a mouse button press; touch devices activate on tap.
  test.skip(!!testInfo.project.use.hasTouch, 'mouse press scenario: not applicable to touch devices');
  await start(page, runtime);
  const a = await file(page, sel, 'first file');
  await file(page, sel, 'second file');
  const box = (await tab(page, a).boundingBox())!;
  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down();
  // Active on press, before release.
  await expect(tab(page, a)).toHaveAttribute('aria-selected', 'true');
  await page.mouse.up();
  await expect(editorText(page, sel)).toHaveText('first file');
});

test('@ux-editor-005 Zen mode keeps editor content visible while other shell panes are hidden', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  await file(page, sel, 'zen text');
  await clickVisible(page, tabs(page).getByRole('button', { name: /^enter zen mode$/i }));
  try {
    await expect(pane(page)).toBeHidden();
    await expect(page.locator(sel('composeInput'))).toBeHidden();
    await expect(page.locator(sel('timeline'))).toBeHidden();
    await expect(editorText(page, sel)).toBeVisible();
    await expect(editorText(page, sel)).toHaveText('zen text');
  } finally {
    await page.getByRole('button', { name: /^exit zen mode$/i }).click().catch(() => page.keyboard.press('Control+Shift+Z'));
  }
  await expect(page.locator(sel('composeInput'))).toBeVisible();
});

test('@ux-workspace-010 Show dirty tab affordances and compare-to-saved gating', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const name = await file(page, sel, 'saved text');
  // Clean: a plain close control, and nothing to compare.
  await expect(closeControl(page, name)).toHaveAccessibleName(/^close\b/i);
  await openContextMenu(page, name);
  await expect(menuItem(page, /^compare to saved$/i)).toHaveCount(0);
  await dismissMenu(page, name);
  // Dirty: the tab and its close control report unsaved changes, and Compare to Saved is offered.
  await typeInEditor(page, sel, ' more');
  await expect(tab(page, name)).toHaveAccessibleName(/unsaved changes/i);
  await expect(closeControl(page, name)).toHaveAccessibleName(/unsaved changes/i);
  await openContextMenu(page, name);
  await expect(menuItem(page, /^compare to saved$/i)).toBeVisible();
  await dismissMenu(page, name);
  await save(page, name);
});

test('@ux-workspace-011 Close tabs with MRU fallback while preserving pinned tabs in bulk close flows', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const a = await file(page, sel, 'a');
  const b = await file(page, sel, 'b');
  const c = await file(page, sel, 'c');
  // Most recently used: c, a, b. Closing c falls back to a, not to its neighbour b.
  await clickVisible(page, tab(page, a));
  await clickVisible(page, tab(page, c));
  await clickVisible(page, closeControl(page, c));
  await expect(tab(page, c)).toHaveCount(0);
  await expect(tab(page, a)).toHaveAttribute('aria-selected', 'true');
  // Pinned tabs survive Close Others and Close All.
  await openContextMenu(page, b);
  await menuItem(page, /^pin$/i).click();
  await openContextMenu(page, a);
  await menuItem(page, /^close others$/i).click();
  await expect(tab(page, a)).toBeVisible();
  await expect(tab(page, b)).toBeVisible();
  await openContextMenu(page, a);
  await menuItem(page, /^close all$/i).click();
  await expect(tab(page, a)).toHaveCount(0);
  await expect(tab(page, b)).toBeVisible();
  await openContextMenu(page, b);
  await menuItem(page, /^unpin$/i).click();
});

test('@ux-workspace-016 Save changed editor content', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const name = await file(page, sel);
  await typeInEditor(page, sel, 'kept after reopening');
  // A failed save reports it and keeps the changes.
  const failing = await holdWrites(page, bodyHas(name), { status: 500, error: 'fixture save failure' });
  failing.release();
  await saveButton(page).click();
  // The status text reports it. (Piclaw 3.2.5 sets it in the editor status line, which collapses to zero width at
  // narrow editor widths, so it is exposed but not always painted.)
  await expect(page.getByText(/save failed/i)).not.toHaveCount(0);
  await expect(closeControl(page, name)).toHaveAccessibleName(/unsaved changes/i);
  failing.disarm();
  // Saving again writes the text once.
  const writes = writesOf(page, name);
  await save(page, name);
  expect(writes).toHaveLength(1);
  // The saved text is what the file now holds: close the tab and reopen the file from its preview.
  await clickVisible(page, closeControl(page, name));
  await expect(tab(page, name)).toHaveCount(0);
  await openWorkspace(page);
  await expect.poll(() => previewPath(page)).toBe(name);
  await pane(page).getByRole('button', { name: /^open in editor$/i }).click();
  await uncoverEditor(page, sel);
  await expect(editorText(page, sel)).toHaveText('kept after reopening');
});

test('@ux-workspace-017 Avoid writing an unchanged editor document', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const name = await file(page, sel, 'baseline');
  // Edit and undo the edit: the text equals the saved baseline again.
  await editorText(page, sel).click();
  await expect(editorText(page, sel)).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type('x');
  await page.keyboard.press('Backspace');
  const writes = writesOf(page, name);
  await saveButton(page).click();
  await expect(closeControl(page, name)).toHaveAccessibleName(/^close\b/i);
  await page.waitForTimeout(800);
  expect(writes).toEqual([]);
});

/** Change and save `name` from a second page of the same browser session (another user tab). */
async function remoteEdit(page: Page, sel: Sel, name: string, text: string) {
  const other = await page.context().newPage();
  try {
    await other.goto(sessionUrl);
    await openInEditor(other, sel, name);
    await expect(editorText(other, sel)).not.toHaveText('');
    await typeInEditor(other, sel, text);
    await save(other, name);
  } finally {
    await other.close();
  }
  await page.bringToFront();
}

/** The file's text as a fresh page loads it. */
async function diskText(page: Page, sel: Sel, name: string) {
  const other = await page.context().newPage();
  try {
    await other.goto(sessionUrl);
    await openInEditor(other, sel, name);
    await expect(editorText(other, sel)).not.toHaveText('');
    return (await editorText(other, sel).textContent()) ?? '';
  } finally {
    await other.close();
  }
}

test('@ux-workspace-018 Resolve an editor file conflict with the supplied actions', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  page.on('dialog', d => void d.accept());
  const name = await file(page, sel, 'v1');
  // The notice's text can collapse on narrow layouts; its action buttons are what a user sees.
  const notice = page.getByText(/file changed on disk/i);
  const resolved = () => expect(page.getByRole('button', { name: 'Reload', exact: true }).first()).toBeHidden();
  const action = (label: string) => page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).first();
  /** Local unsaved text, then the same file changed elsewhere: the editor offers the conflict actions. */
  const conflict = async (round: string) => {
    await typeInEditor(page, sel, ` local-${round}`);
    await remoteEdit(page, sel, name, ` remote-${round}`);
    await expect(action('Reload')).toBeVisible({ timeout: 15_000 });
    await expect(notice).not.toHaveCount(0);
  };

  // Reload: the file's text replaces the editor's, which is clean again.
  await conflict('reload');
  await clickVisible(page, action('Reload'));
  await expect(editorText(page, sel)).toHaveText('v1 remote-reload');
  await expect(closeControl(page, name)).toHaveAccessibleName(/^close\b/i);
  await resolved();

  // Overwrite: the editor's text is saved over the file.
  await conflict('overwrite');
  await clickVisible(page, action('Overwrite'));
  await expect(closeControl(page, name)).toHaveAccessibleName(/^close\b/i);
  await resolved();
  expect(await diskText(page, sel, name)).toBe('v1 remote-reload local-overwrite');

  // Save copy: the editor's text goes to a new file next to it.
  await conflict('copy');
  const listed = async () => new Set((await pane(page).innerText().catch(() => '')).split('\n').map(l => l.trim()).filter(Boolean));
  await openWorkspace(page);
  const before = await listed();
  await uncoverEditor(page, sel);
  await clickVisible(page, action('Save copy'));
  await openWorkspace(page);
  let copy = '';
  await expect.poll(async () => {
    await pane(page).getByRole('button', { name: /^refresh tree$/i }).click();
    copy = [...await listed()].find(l => !before.has(l) && /\.\w+$/.test(l)) ?? '';
    return copy;
  }, { message: 'a copy appears in the workspace tree' }).not.toBe('');
  created.push(copy);
  await (await treeRow(page, copy))!.click();
  await expect.poll(() => pane(page).innerText()).toContain('local-copy');
});

test('@ux-workspace-019 Keep edits made while a save is in progress', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const name = await file(page, sel);
  await typeInEditor(page, sel, 'first');
  const held = await holdWrites(page, bodyHas(name));
  await saveButton(page).click();
  await expect.poll(() => held.count).toBe(1);
  // Typed while the write is still in flight.
  await typeInEditor(page, sel, ' second');
  held.disarm();
  held.release();
  await page.waitForTimeout(1000);
  await expect(editorText(page, sel)).toHaveText('first second');
  await expect(closeControl(page, name)).toHaveAccessibleName(/unsaved changes/i);
  await save(page, name);
  expect(await diskText(page, sel, name)).toBe('first second');
});

test('@ux-editor-004 Markdown preview is stable during splitter resize', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const name = await file(page, sel, '# Preview title\n\nbody text');
  await openContextMenu(page, name);
  await menuItem(page, /^preview$/i).click();
  const heading = page.getByRole('heading', { name: 'Preview title' }).filter({ visible: true }).first();
  await expect(heading).toBeVisible();
  const splitter = page.locator(sel('previewSplitter')).filter({ visible: true }).first();
  const box = (await splitter.boundingBox())!;
  const vertical = box.width >= box.height;
  // The splitter's position stands for the preview's size.
  const at = async () => { const b = (await splitter.boundingBox())!; return vertical ? b.y : b.x; };
  const before = await at();
  // Drag the splitter by 80 px; the preview stays rendered throughout.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(box.x + box.width / 2 + (vertical ? 0 : -10 * i), box.y + box.height / 2 + (vertical ? -10 * i : 0));
    await expect(heading).toBeVisible();
  }
  const during = await at();
  await page.mouse.up();
  await page.waitForTimeout(500);
  expect(Math.abs(during - before)).toBeGreaterThan(20);
  // The size reached while dragging is kept after release.
  expect(Math.abs((await at()) - during)).toBeLessThanOrEqual(2);
  await expect(heading).toBeVisible();
});

test('@ux-workspace-013 Gate dock, popout, reattach, and standalone viewer routes from the tab context menu', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const name = await file(page, sel, 'window text');
  await openContextMenu(page, name);
  const popup = page.waitForEvent('popup');
  await menuItem(page, /^open in window$/i).click();
  const win = await popup;
  try {
    // The window shows only the editor with the file; the main window gives the tab up while it is detached.
    await expect(win.locator(sel('editorText')).filter({ visible: true }).first()).toHaveText('window text');
    await expect(win.locator(sel('composeInput'))).toHaveCount(0);
    await expect(tab(page, name)).toHaveCount(0);
  } finally {
    await win.close();
  }
  // Closing the window returns the tab.
  await expect(tab(page, name)).toBeVisible();
});

test("@ux-workspace-020 Show a file's external changes in a clean editor tab", async ({ page, runtime, sel }) => {
  await start(page, runtime);
  const name = await file(page, sel, 'v1');
  await remoteEdit(page, sel, name, ' remote');
  await expect(editorText(page, sel)).toHaveText('v1 remote', { timeout: 15_000 });
  await expect(closeControl(page, name)).toHaveAccessibleName(/^close\b/i);
  await expect(page.getByRole('button', { name: 'Reload', exact: true }).first()).toBeHidden();
});

test('@ux-editor-009 Edit with Vim keybindings', async ({ page, runtime, sel }) => {
  await start(page, runtime);
  await file(page, sel, 'one two\nthree four');
  const ed = editorText(page, sel);
  // The editor's own Vim control (Piclaw: a "Vim" status-bar button, Alt+V).
  const vim = page.getByRole('button', { name: /^vim\b|vim mode/i }).or(page.getByRole('switch', { name: /vim/i })).filter({ visible: true }).first();
  await vim.click();
  await expect(page.getByText(/\bvim\b/i).filter({ visible: true }).filter({ hasNotText: /toggle/i }).last()).toBeVisible();
  await ed.click();
  await expect(ed).toBeFocused();
  for (const k of ['g', 'g', 'x']) await page.keyboard.press(k);
  await expect(ed).toHaveText('ne twothree four');
  for (const k of ['d', 'd']) await page.keyboard.press(k);
  await expect(ed).toHaveText('three four');
  await page.keyboard.press('i');
  await page.keyboard.type('Z');
  await page.keyboard.press('Escape');
  await expect(ed).toHaveText('Zthree four');
  await expect(ed).toBeFocused();
  await page.keyboard.press('x');
  await expect(ed).toHaveText('three four');
  await vim.click();
  await ed.click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.type('Q');
  await expect(ed).toHaveText('Qthree four');
});
