/**
 * Workspace and editor helpers shared by specs. Files are created through the UI under fresh names and removed through
 * the UI again, so specs leave the runtime's workspace as they found it.
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export const menu = (page: Page) => page.getByRole('button', { name: /^menu$|workspace menu/i }).first();
export const pane = (page: Page) => page.getByRole('complementary').filter({ hasText: /workspace/i }).first();
export const tabs = (page: Page) => page.getByRole('tablist').first();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The editor tab for a file name. */
export const tab = (page: Page, name: string) =>
  // The name may carry a state label (e.g. "Pinned"); review views ("Review · name") are not editor tabs.
  tabs(page).getByRole('tab', { name: new RegExp(`(?:^|\\s)${esc(name)}(?![\\w.-])`) }).filter({ hasNotText: /^review\b/i });
/** A tab's close control; while the tab has unsaved changes it reports that instead. */
export const closeControl = (page: Page, name: string) => tab(page, name).getByRole('button');

/** Open the workspace pane unless it is already shown (its visibility persists across reloads). */
export async function openWorkspace(page: Page) {
  await expect(menu(page)).toBeVisible();
  await page.waitForTimeout(300);
  if (await pane(page).isVisible()) return;
  await menu(page).click();
  await page.getByRole('menuitem', { name: /show workspace/i }).click();
  await expect(pane(page)).toBeVisible();
}

export async function previewPath(page: Page) {
  const text = await pane(page).innerText().catch(() => '');
  return text.match(/path:\s*(\S+)/)?.[1] ?? '';
}

/** The tree row for a name, ignoring the selected file's preview (which repeats the name). */
export async function treeRow(page: Page, name: string) {
  const matches = pane(page).getByText(name, { exact: true });
  const index = await pane(page).evaluate((root, wanted) => {
    const del = [...root.querySelectorAll('button, a')].find(b => /delete file/i.test(b.getAttribute('aria-label') ?? b.getAttribute('title') ?? b.textContent ?? ''));
    let preview: Element | null = del ?? null;
    while (preview && preview !== root && !/path:/.test(preview.textContent ?? '')) preview = preview.parentElement;
    const leaves = [...root.querySelectorAll('*')].filter(e => e.textContent?.trim() === wanted && ![...e.children].some(c => c.textContent?.trim() === wanted));
    return leaves.findIndex(e => !(preview && preview !== root && preview.contains(e)));
  }, name);
  return index < 0 ? null : matches.nth(index);
}

/** Create a file with "New file"; it is selected in the preview. Returns its name. */
export async function newFile(page: Page) {
  await openWorkspace(page);
  // The preview of the created file: a changed selection showing an empty file. (A restored selection may name a
  // deleted file that the new one reuses, and a just-saved file's modification time can still update.)
  const shown = async () => {
    const text = await pane(page).innerText().catch(() => '');
    return `${text.match(/path:\s*(\S+)/)?.[1] ?? ''}|${text.match(/modified:\s*([^\n]+)/)?.[1] ?? ''}|${text.match(/size:\s*([^\n]+)/)?.[1] ?? ''}`;
  };
  const previous = await shown();
  let created = '';
  const changed = async () => { const now = await shown(); created = now.split('|')[0]; return created !== '' && now !== previous && /^0\s*B$/i.test(now.split('|')[2]); };
  for (let attempt = 1; ; attempt++) {
    await pane(page).getByRole('button', { name: /^new file$/i }).first().click();
    // Setup only: with a stale tree (rcarmo/piclaw#1520) the client may propose a taken name and create nothing until
    // the tree is refreshed.
    if (await expect.poll(changed, { timeout: 4_000 }).toBe(true).then(() => true, () => false)) break;
    if (attempt === 4) throw new Error(`newFile: nothing created (preview ${await shown()})`);
    if (attempt === 3) {
      // A refresh can stay stale; a reload lists the real tree.
      await page.reload();
      await openWorkspace(page);
      await page.waitForTimeout(1500);
    } else {
      await pane(page).getByRole('button', { name: /^refresh tree$/i }).click();
    }
    await page.waitForTimeout(500);
    if (await changed()) break;
  }
  return created;
}

/** Runtimes may keep one hidden editor per inactive tab: the visible one is the active tab's. */
export const editorText = (page: Page, sel: (k: string) => string) => page.locator(sel('editorText')).filter({ visible: true }).first();

/**
 * Create a file, open it in an editor tab and, when given, type and save `content`. `onCreated` receives the name as
 * soon as the file exists, so callers can clean up even if a later step fails.
 */
export async function editorFile(page: Page, sel: (k: string) => string, content?: string, onCreated?: (name: string) => void) {
  const name = await newFile(page);
  onCreated?.(name);
  // "Open in editor", not "Review file" (a separate review view).
  await pane(page).getByRole('button', { name: /^open in editor$/i }).click();
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
  await uncoverEditor(page, sel);
  if (content !== undefined) {
    // A new file is empty: wait for its editor (another tab's editor may still be showing).
    await expect(editorText(page, sel)).toHaveText('');
    await typeInEditor(page, sel, content);
    await save(page, name, { retry: true });
  }
  return name;
}

/** On narrow layouts the workspace pane overlays the editor: hide it while editing (openWorkspace shows it again). */
export async function uncoverEditor(page: Page, sel: (k: string) => string) {
  const covered = await editorText(page, sel).evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + Math.min(10, r.height / 2));
    return !!hit && !el.contains(hit) && !!hit.closest('aside, [role=complementary]');
  }).catch(() => false);
  if (!covered) return;
  await menu(page).click();
  await page.getByRole('menuitem', { name: /hide workspace/i }).click();
  await expect(pane(page)).toBeHidden();
}

/** Type at the end of the active editor and check the text arrived (a click can land before the editor takes focus). */
export async function typeInEditor(page: Page, sel: (k: string) => string, text: string) {
  for (let attempt = 1; ; attempt++) {
    const before = (await editorText(page, sel).textContent()) ?? '';
    await editorText(page, sel).click();
    // Keys typed without editor focus would reach the page (e.g. open a typeahead menu).
    await expect(editorText(page, sel)).toBeFocused();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(text);
    const arrived = await expect(editorText(page, sel)).toHaveText(before + text, { timeout: 3_000 }).then(() => true, () => false);
    if (arrived) return;
    if (attempt === 2 || ((await editorText(page, sel).textContent()) ?? '') !== before) {
      await expect(editorText(page, sel)).toHaveText(before + text);
      return;
    }
  }
}

/** The active editor's Save control (other panes, e.g. a plan editor, may show a disabled Save). */
export const saveButton = (page: Page) => page.getByRole('button', { name: /^save$/i }).filter({ visible: true }).and(page.locator(':enabled')).first();

/**
 * Save the active tab and wait until it no longer reports unsaved changes. `retry` (setup only) presses Save once more
 * if the first press did not take.
 */
export async function save(page: Page, name: string, { retry = false } = {}) {
  await saveButton(page).click();
  if (retry && !(await expect(closeControl(page, name)).toHaveAccessibleName(/^close\b/i, { timeout: 5_000 }).then(() => true, () => false))) {
    await saveButton(page).click();
  }
  await expect(closeControl(page, name)).toHaveAccessibleName(/^close\b/i);
}

/** Close any open tabs for `names` (discarding changes) and delete the files. Never throws; logs what it could not do. */
export async function removeFiles(page: Page, names: string[]) {
  const t = { timeout: 5_000 };
  const accept = (d: any) => void d.accept().catch(() => {});
  page.on('dialog', accept);
  try {
    for (const name of names) {
      if (await tab(page, name).count().catch(() => 0)) await closeControl(page, name).click(t).catch(e => console.log(`removeFiles: close ${name}: ${e.message.split('\n')[0]}`));
    }
    await openWorkspace(page).catch(() => {});
    for (const name of names) {
      await pane(page).getByRole('button', { name: /^refresh tree$/i }).click(t).catch(() => {});
      await page.waitForTimeout(500);
      let row = await treeRow(page, name).catch(() => null);
      if (!row) {
        // A refresh can leave a root file unlisted (rcarmo/piclaw#1520); a reload lists it.
        await page.reload().catch(() => {});
        await openWorkspace(page).catch(() => {});
        row = await treeRow(page, name).catch(() => null);
      }
      if (!row) { console.log(`removeFiles: no row ${name}`); continue; }
      await row.click(t).catch(() => {});
      const selected = await expect.poll(() => previewPath(page), t).toBe(name).then(() => true, () => false);
      if (!selected) { console.log(`removeFiles: ${name} not previewed (preview ${await previewPath(page)})`); continue; }
      await pane(page).getByRole('button', { name: /^delete file$/i }).click(t).catch(e => console.log(`removeFiles: delete ${name}: ${e.message.split('\n')[0]}`));
      await expect.poll(async () => (await treeRow(page, name)) === null, t).toBe(true).catch(() => console.log(`removeFiles: ${name} still listed`));
    }
  } finally {
    page.off('dialog', accept);
  }
}

/**
 * Delete every "untitled" file New file creates (the suite runs one worker; only specs create these names), so each
 * test starts clean even if an earlier cleanup could not confirm a deletion. Never throws.
 */
export async function purgeUntitled(page: Page) {
  const t = { timeout: 5_000 };
  const accept = (d: any) => void d.accept().catch(() => {});
  page.on('dialog', accept);
  try {
    await openWorkspace(page).catch(() => {});
    for (let i = 0, reloaded = false; i < 40; i++) {
      await pane(page).getByRole('button', { name: /^refresh tree$/i }).click(t).catch(() => {});
      await page.waitForTimeout(400);
      const names = [...new Set((await pane(page).innerText().catch(() => '')).match(/\buntitled(?:-\d+)?\.md\b/g) ?? [])];
      let row = null;
      for (const name of names) if ((row = await treeRow(page, name).catch(() => null))) break;
      if (!row) {
        if (reloaded || !names.length) break;
        // A refresh can leave root entries stale (rcarmo/piclaw#1520); a reload lists them.
        reloaded = true;
        await page.reload().catch(() => {});
        await openWorkspace(page).catch(() => {});
        continue;
      }
      await row.click(t).catch(() => {});
      await page.waitForTimeout(300);
      await pane(page).getByRole('button', { name: /^delete file$/i }).click(t).catch(() => {});
      await page.waitForTimeout(400);
    }
  } finally {
    page.off('dialog', accept);
  }
}

/**
 * Click (or right-click) a point of `target` that is actually exposed. On narrow layouts floating shell controls can
 * cover part of a tab or toolbar button; a user taps the uncovered part.
 */
export async function clickVisible(page: Page, target: Locator, button: 'left' | 'right' = 'left') {
  await expect(target).toBeVisible();
  const box = (await target.boundingBox())!;
  // Hover each candidate first: hover can reveal controls (a tab's close button) that then take the click.
  for (const fy of [0.5, 0.3, 0.7]) for (const fx of [0.5, 0.35, 0.2, 0.1, 0.65, 0.8, 0.9]) {
    const x = box.x + box.width * fx, y = box.y + box.height * fy;
    await page.mouse.move(x, y);
    const exposed = await target.evaluate((el, [px, py]) => {
      const hit = document.elementFromPoint(px, py);
      // Never a nested control unless that control is the target.
      const control = hit?.closest('button, [role=button], a');
      return !!hit && el.contains(hit) && (!control || control === el || !el.contains(control));
    }, [x, y]);
    if (exposed) { await page.mouse.click(x, y, { button }); return; }
  }
  throw new Error('clickVisible: target is fully covered');
}
