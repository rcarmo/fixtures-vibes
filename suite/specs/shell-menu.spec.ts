/**
 * Classic workspace menu and shell layout (features/classic/compose/hamburger-layout-scale.feature).
 */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

const menuButton = (page: Page) => page.getByRole('button', { name: /^menu$/i }).first();
const item = (page: Page, name: RegExp) => page.getByRole('menuitem', { name });
const WORKSPACE_ACTIONS = [/^new file$/i, /^refresh tree$/i, /^reindex workspace$/i];
const HIDDEN = /hidden files/i;

async function openMenu(page: Page) {
  await menuButton(page).click();
  await expect(page.getByRole('menuitem').first()).toBeVisible();
}
/** Show or hide the workspace through the menu; leaves the menu closed. */
async function setWorkspace(page: Page, visible: boolean) {
  await openMenu(page);
  const toggle = item(page, visible ? /^show workspace$/i : /^hide workspace$/i);
  if (await toggle.count()) await toggle.click();
  else await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem')).toHaveCount(0);
}
async function open(page: Page, runtime: any, sel: (k: string) => string) {
  await page.goto((await runtime.newSession()).url);
  await expect(page.locator(sel('composeInput'))).toBeVisible();
}

test('@ux-shell-001 Menu contains New file, Refresh tree, Reindex workspace', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await setWorkspace(page, true);
  await openMenu(page);
  for (const name of WORKSPACE_ACTIONS) await expect(item(page, name)).toBeEnabled();
  // Refresh tree is dispatched to the runtime's workspace, and the menu closes.
  const dispatched = page.waitForRequest(r => /workspace/i.test(new URL(r.url()).pathname));
  await item(page, /^refresh tree$/i).click();
  await dispatched;
  await expect(page.getByRole('menuitem')).toHaveCount(0);
});

test('@ux-shell-002 Menu contains hidden files toggle', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await setWorkspace(page, true);
  const stored = () => page.evaluate(() => localStorage.getItem('workspaceShowHidden'));
  const before = await stored();
  // The workspace listing changes with the setting: the dot-entries of the workspace root appear or disappear.
  const dotEntries = () => page.getByText(/^\.pi(claw)?$/).count();
  const shownBefore = await dotEntries();
  await openMenu(page);
  await item(page, HIDDEN).click();
  try {
    await expect.poll(stored).not.toBe(before);
    await expect.poll(dotEntries).not.toBe(shownBefore);
  } finally {
    // The setting is stored by the runtime too: always toggle it back.
    await openMenu(page);
    await item(page, HIDDEN).click();
    await expect.poll(stored).toBe(before ?? 'false');
  }
  await expect.poll(dotEntries).toBe(shownBefore);
});

test('@ux-shell-003 Workspace items disabled in chat-only mode', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await setWorkspace(page, false);
  await openMenu(page);
  for (const name of [...WORKSPACE_ACTIONS, HIDDEN]) await expect(item(page, name)).toBeDisabled();
});

test('@ux-shell-004 Terminal and VNC menu controls depend on callbacks', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  for (const [action, tab] of [[/^open terminal in tab$/i, /^terminal/i], [/^open vnc in tab$/i, /^vnc/i]] as const) {
    await openMenu(page);
    await expect(item(page, action)).toBeEnabled();
    await item(page, action).click();
    // The client's opener ran: its tab is open and active.
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
  }
});

test('@ux-shell-005 Compose box spans full width', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  const column = (await page.locator(sel('timeline')).boundingBox())!;
  const input = (await page.locator(sel('composeInput')).boundingBox())!;
  // The input fills the chat column apart from symmetric padding.
  expect(input.width).toBeGreaterThanOrEqual(column.width - 48);
  const left = input.x - column.x;
  const right = column.x + column.width - (input.x + input.width);
  expect(Math.abs(left - right)).toBeLessThanOrEqual(4);
});

test('@ux-shell-006 Hamburger button visible and above safe area', async ({ page, runtime, sel }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, runtime, sel);
  const trigger = (await menuButton(page).boundingBox())!;
  const composer = (await page.locator(sel('composeInput')).boundingBox())!;
  // Fully inside the viewport, below the top safe-area padding, and clear of the composer.
  expect(trigger.x).toBeGreaterThanOrEqual(0);
  expect(trigger.x + trigger.width).toBeLessThanOrEqual(390);
  const safeTop = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px)';
    document.body.append(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  });
  expect(trigger.y).toBeGreaterThanOrEqual(safeTop);
  expect(trigger.y + trigger.height <= composer.y || trigger.y >= composer.y + composer.height).toBe(true);
  await openMenu(page);
});

test('@ux-shell-007 Tab close does not activate tab', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  for (const action of [/^open terminal in tab$/i, /^open vnc in tab$/i]) {
    await openMenu(page);
    await item(page, action).click();
  }
  const terminal = page.getByRole('tab', { name: /^terminal/i });
  const vnc = page.getByRole('tab', { name: /^vnc/i });
  await expect(vnc).toHaveAttribute('aria-selected', 'true');
  await expect(terminal).toHaveAttribute('aria-selected', 'false');
  // Closing the inactive tab removes it without activating it first: by keyboard everywhere, and by pointer where
  // the close control is reachable by hovering (on phone layouts it is not offered on inactive tabs).
  const activated: string[] = [];
  await page.exposeFunction('fxTabActivated', (name: string) => activated.push(name));
  const watch = (tab: typeof terminal) => tab.evaluate(el => new MutationObserver(() => {
    if (el.getAttribute('aria-selected') === 'true') (window as any).fxTabActivated(el.textContent);
  }).observe(el, { attributes: true }));
  const close = page.getByRole('button', { name: /^close terminal$/i });
  await watch(terminal);
  await close.focus();
  await page.keyboard.press('Enter');
  await expect(terminal).toHaveCount(0);
  await expect(vnc).toHaveAttribute('aria-selected', 'true');
  expect(activated).toEqual([]);
  if (!test.info().project.name.includes('phone')) {
    await openMenu(page);
    await item(page, /^open terminal in tab$/i).click();
    await openMenu(page);
    await item(page, /^open vnc in tab$/i).click();
    await expect(vnc).toHaveAttribute('aria-selected', 'true');
    await watch(terminal);
    await terminal.hover();
    await close.click();
    await expect(terminal).toHaveCount(0);
    await expect(vnc).toHaveAttribute('aria-selected', 'true');
    expect(activated).toEqual([]);
  }
});

test('@ux-shell-008 Menu contains display scale control', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await openMenu(page);
  const scale = page.getByRole('spinbutton', { name: /scale/i }).or(page.getByRole('slider', { name: /scale/i })).first();
  test.skip(!(await scale.isVisible().catch(() => false)),
    'environment-limit: the display scale control is offered only in an installed app (display-mode standalone), which browser tabs cannot emulate');
  const stored = await scale.inputValue();
  const next = stored === '90' ? '95' : '90';
  try {
    await scale.fill(next);
    await scale.press('Enter');
    await page.reload();
    await expect(page.locator(sel('composeInput'))).toBeVisible();
    await openMenu(page);
    await expect(scale).toHaveValue(next);
  } finally {
    await scale.fill(stored).catch(() => {});
    await scale.press('Enter').catch(() => {});
  }
});

test('@ux-shell-009 Inline code in editor preview is monospaced', async ({ page, runtime, sel }) => {
  await open(page, runtime, sel);
  await setWorkspace(page, true);
  await page.getByText('README.md', { exact: true }).first().click();
  await page.getByRole('button', { name: /open in editor/i }).first().click();
  const editor = page.locator('[contenteditable="true"]').filter({ hasText: 'Sample workspace file' }).first();
  await expect(editor).toBeVisible();
  // Inline code typed into the Markdown editor is rendered in the code font; the edit is undone, never saved.
  await editor.focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' `fx-code`');
  try {
    // The innermost element holding the code text, once the editor has decorated it.
    const fonts = () => editor.evaluate(root => {
      const hits = Array.from(root.querySelectorAll('*')).filter(e => e.textContent?.includes('fx-code'));
      const el = hits.find(e => !Array.from(e.children).some(c => c.textContent?.includes('fx-code'))) ?? root;
      return { code: getComputedStyle(el).fontFamily, body: getComputedStyle(root).fontFamily };
    });
    await expect.poll(async () => (await fonts()).code).toMatch(/mono/i);
    expect((await fonts()).code).not.toBe((await fonts()).body);
  } finally {
    for (let i = 0; i < 12 && (await editor.innerText()).includes('fx-code'); i++) await page.keyboard.press('Control+z');
  }
  await expect(editor).not.toContainText('fx-code');
});
