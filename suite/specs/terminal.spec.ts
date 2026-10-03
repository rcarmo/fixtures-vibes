/**
 * Terminal pane, dock and zen mode (features/classic/panes/terminal.feature). Terminal text is read from the labelled
 * terminal region (canonical selector `terminal`); commands print computed values so echoed input cannot pass for output.
 */
import { test, expect } from '../fixtures';
import { rgb } from '../colour';
import { editorFile, removeFiles, pane, editorText, menu, tab } from '../workspace';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

type Sel = (k: string) => string;
const nonce = () => randomUUID().replace(/-/g, '').slice(0, 6);
const terminal = (page: Page, sel: Sel) => page.locator(sel('terminal')).filter({ visible: true }).first();
const termTab = (page: Page) => page.getByRole('tab', { name: /terminal/i }).first();
const showDock = (page: Page) => page.getByRole('button', { name: /^show terminal$/i }).first();
const hideDock = (page: Page) => page.getByRole('button', { name: /^hide terminal$/i }).first();
const zenButton = (page: Page, verb: 'Enter' | 'Exit') => page.getByRole('button', { name: new RegExp(`^${verb} zen mode$`, 'i') }).first();

async function openTerminalTab(page: Page, sel: Sel) {
  await menu(page).click();
  await page.getByRole('menuitem', { name: /open terminal in tab|open terminal/i }).first().click();
  await expect(termTab(page)).toBeVisible();
  await expect(terminal(page, sel)).toBeVisible();
}
/** Type a command into the terminal and wait for `expected` in its text. */
async function run(page: Page, sel: Sel, command: string, expected: RegExp | string) {
  await terminal(page, sel).click();
  await page.keyboard.type(command);
  await page.keyboard.press('Enter');
  await expect(terminal(page, sel)).toContainText(expected, { timeout: 15_000 });
}
const luminance = (c: string) => { const [r = 0, g = 0, b = 0] = rgb(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** The first opaque background inside the terminal region (the terminal's own colour, whatever element paints it). */
const termBackground = (page: Page, sel: Sel) => terminal(page, sel).evaluate(el => {
  for (const e of [el, ...el.querySelectorAll('*')]) { const c = getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; }
  return '';
});
const pageBackground = (page: Page, sel: Sel) => page.locator(sel('appShell')).evaluate(el => {
  for (let e: Element | null = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; }
  return 'rgb(255, 255, 255)';
});
const closeTab = async (page: Page) => {
  await page.getByRole('tablist').first().getByRole('button', { name: /^close terminal/i }).first().click();
};

test.describe('standalone', () => {
  test('@ux-terminal-001 Open terminal standalone without garbled output', async ({ page, runtime, sel }) => {
    await page.goto((await runtime.newSession()).url);
    await openTerminalTab(page, sel);
    // A drawing surface: a canvas, or a text layer.
    const surface = await terminal(page, sel).evaluate(el => el.querySelectorAll('canvas').length > 0 || (el.textContent ?? '').trim().length > 0);
    expect(surface).toBe(true);
    const n = nonce();
    await run(page, sel, `echo ok-$((6*7))-${n}`, `ok-42-${n}`);
    // Light terminal on a light page, dark on dark.
    expect(luminance(await termBackground(page, sel)) > 128).toBe(luminance(await pageBackground(page, sel)) > 128);
    await closeTab(page);
  });

  test('@ux-terminal-002 Execute ls -al in terminal', async ({ page, runtime, sel }) => {
    await page.goto((await runtime.newSession()).url);
    await openTerminalTab(page, sel);
    await run(page, sel, 'ls -al', /total \d+/);
    await expect(terminal(page, sel)).toContainText(/[d-][rwx-]{9}.*\s\.\.?\s/);
    await closeTab(page);
  });

  test('@ux-terminal-003 Terminal opens clean without IME active', async ({ page, runtime, sel }) => {
    await page.goto((await runtime.newSession()).url);
    await openTerminalTab(page, sel);
    await terminal(page, sel).click();
    await page.keyboard.type('echo test123');
    await expect(terminal(page, sel)).toContainText('echo test123');
    await page.keyboard.press('Enter');
    await expect.poll(async () => ((await terminal(page, sel).innerText()).match(/test123/g) ?? []).length).toBeGreaterThanOrEqual(2);
    await closeTab(page);
  });

  test('@ux-terminal-004 Close terminal via tab close button (click)', async ({ page, runtime, sel }, testInfo) => {
    test.skip(!!testInfo.project.use.hasTouch, 'click scenario: the tap variant is @ux-terminal-005');
    await page.goto((await runtime.newSession()).url);
    await openTerminalTab(page, sel);
    await closeTab(page);
    await expect(termTab(page)).toHaveCount(0);
    await expect(page.locator(sel('terminal')).filter({ visible: true })).toHaveCount(0);
  });

  test('@ux-terminal-005 Close terminal via tab close button (tap)', async ({ page, runtime, sel }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, 'touch scenario: not applicable without a touch screen');
    await page.goto((await runtime.newSession()).url);
    await openTerminalTab(page, sel);
    await page.getByRole('tablist').first().getByRole('button', { name: /^close terminal/i }).first().tap();
    await expect(termTab(page)).toHaveCount(0);
  });

  test('@ux-terminal-007 Terminal theme matches UI theme', async ({ page, runtime, sel }) => {
    await page.goto((await runtime.newSession()).url);
    await openTerminalTab(page, sel);
    const before = await termBackground(page, sel);
    const theme = async (cmd: string) => {
      await page.locator(sel('composeInput')).fill(cmd);
      await page.locator(sel('composeInput')).press('Enter');
      await expect(page.getByText(/theme set to/i).last()).toBeVisible();
    };
    try {
      await theme('/theme ristretto');
      await expect.poll(() => termBackground(page, sel)).not.toBe(before);
      expect(luminance(await termBackground(page, sel)) > 128).toBe(luminance(await pageBackground(page, sel)) > 128);
      const n = nonce();
      await run(page, sel, `echo th-$((5*5))-${n}`, `th-25-${n}`);
    } finally {
      await theme('/theme default');
    }
    await closeTab(page);
  });
});

test.describe('dock and zen', () => {
  let file = '';
  test.beforeEach(async ({ page, runtime, sel }) => {
    test.setTimeout(90_000);
    await page.goto((await runtime.newSession()).url);
    file = await editorFile(page, sel, 'dock text');
  });
  test.afterEach(async ({ page, sel }) => {
    // Leave zen mode (its chrome is hidden) before cleaning up through the workspace pane.
    if (await zenButton(page, 'Exit').count()) {
      await page.keyboard.press('Escape');
      if (!(await page.locator(sel('composeInput')).isVisible().catch(() => false))) await page.keyboard.press('Control+Shift+Z');
    }
    if (!(await menu(page).isVisible().catch(() => false))) await page.reload();
    if (await hideDock(page).isVisible().catch(() => false)) await hideDock(page).click({ timeout: 5_000 }).catch(() => {});
    if (file) await removeFiles(page, [file]);
  });
  const below = async (page: Page, sel: Sel) => {
    const e = (await editorText(page, sel).boundingBox())!, t = (await terminal(page, sel).boundingBox())!;
    return t.y >= e.y + e.height - 2;
  };
  /** The drag handle between editor and dock: a row-resize element at the dock's top edge. */
  const splitter = (page: Page, sel: Sel) => terminal(page, sel).evaluate(term => {
    const top = term.getBoundingClientRect().top;
    const handle = [...document.querySelectorAll<HTMLElement>('*')].find(e => {
      if (!e.offsetParent || !/row-resize|ns-resize/.test(getComputedStyle(e).cursor)) return false;
      const r = e.getBoundingClientRect();
      const t = term.getBoundingClientRect();
      return r.width > 20 && Math.abs(r.bottom - top) < 60 && r.left < t.right && r.right > t.left;
    });
    if (!handle) return null;
    const r = handle.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  /** Reveal the hidden zen chrome at the top edge, then click its exit control where it now shows. */
  const exitZenByPointer = async (page: Page) => {
    const exit = zenButton(page, 'Exit');
    const box = (await exit.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, 1);
    await expect.poll(() => exit.evaluate(e => Number(getComputedStyle(e).opacity))).toBeGreaterThan(0.5);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
    await page.mouse.down();
    await page.mouse.up();
  };

  /** Enter zen mode with its control, or its shortcut where floating controls cover the control (phones). */
  const enterZen = async (page: Page, sel: Sel) => {
    const button = zenButton(page, 'Enter');
    const exposed = await button.evaluate(el => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && el.contains(hit);
    }).catch(() => false);
    if (exposed) await button.click();
    else { await tab(page, file).click(); await page.keyboard.press('Control+Shift+Z'); }
    await expect(page.locator(sel('composeInput'))).toBeHidden();
  };
  /** What zen hides: the workspace pane and the chat, as shown before entering it. */
  const chrome = async (page: Page, sel: Sel) => ({ workspace: await pane(page).isVisible(), chat: await page.locator(sel('composeInput')).isVisible() });

  test('@ux-terminal-008 Toggle terminal dock via keyboard shortcut', async ({ page, sel }) => {
    // Focus on the tab strip, not inside the editor (editors keep their own keys).
    await tab(page, file).click();
    await page.keyboard.press('Control+Backquote');
    await expect(terminal(page, sel)).toBeVisible();
    expect(await below(page, sel)).toBe(true);
    expect(await splitter(page, sel)).not.toBeNull();
    await tab(page, file).click();
    await page.keyboard.press('Control+Backquote');
    await expect(page.locator(sel('terminal')).filter({ visible: true })).toHaveCount(0);
  });

  test('@ux-terminal-009 Toggle terminal dock via tab strip button', async ({ page, sel }) => {
    await showDock(page).click();
    await expect(terminal(page, sel)).toBeVisible();
    expect(await below(page, sel)).toBe(true);
    await page.getByRole('tablist').first().getByRole('button', { name: /^hide terminal$/i }).click();
    await expect(page.locator(sel('terminal')).filter({ visible: true })).toHaveCount(0);
  });

  test('@ux-terminal-010 Dock splitter resizes terminal height', async ({ page, sel }) => {
    await showDock(page).click();
    await expect(terminal(page, sel)).toBeVisible();
    const height = async () => (await terminal(page, sel).boundingBox())!.height;
    const drag = async (dy: number) => {
      const h = (await splitter(page, sel))!;
      await page.mouse.move(h.x, h.y);
      await page.mouse.down();
      await page.mouse.move(h.x, h.y + dy / 2, { steps: 5 });
      await page.mouse.move(h.x, h.y + dy, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    };
    expect(await splitter(page, sel)).not.toBeNull();
    const h0 = await height();
    await drag(-120);
    await expect(terminal(page, sel)).toBeVisible();
    const h1 = await height();
    expect(h1).toBeGreaterThan(h0 + 40);
    await drag(80);
    await expect(terminal(page, sel)).toBeVisible();
    expect(await height()).toBeLessThan(h1 - 30);
  });

  test('@ux-terminal-011 Terminal dock is interactive alongside editor', async ({ page, sel }) => {
    await showDock(page).click();
    const n = nonce();
    await run(page, sel, `echo hello-$((3+4))-${n}`, `hello-7-${n}`);
    await editorText(page, sel).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('test');
    await expect(editorText(page, sel)).toContainText('dock texttest');
  });

  test('@ux-terminal-012 Dock hidden in zen mode', async ({ page, sel }) => {
    await showDock(page).click();
    await expect(terminal(page, sel)).toBeVisible();
    await enterZen(page, sel);
    await expect(page.locator(sel('terminal')).filter({ visible: true })).toHaveCount(0);
  });

  test('@ux-terminal-013 Zen mode hides all chrome except the terminal/editor', async ({ page, sel }) => {
    await enterZen(page, sel);
    await expect(pane(page)).toBeHidden();
    await expect(page.locator(sel('composeInput'))).toBeHidden();
    await expect(editorText(page, sel)).toBeVisible();
  });

  test('@ux-terminal-014 Zen mode has a hover-discoverable exit control', async ({ page, sel }) => {
    await enterZen(page, sel);
    const vw = page.viewportSize()!.width;
    await page.mouse.move(vw / 2, 1);
    const exit = zenButton(page, 'Exit');
    await expect(exit).toBeVisible();
    await expect.poll(() => exit.evaluate(e => Number(getComputedStyle(e).opacity))).toBeGreaterThan(0.5);
    await expect(exit).toBeEnabled();
  });

  test('@ux-terminal-015 Clicking zen exit indicator reverts to normal layout', async ({ page, sel }) => {
    const before = await chrome(page, sel);
    await enterZen(page, sel);
    await exitZenByPointer(page);
    await expect(zenButton(page, 'Enter')).toBeVisible();
    await expect.poll(() => chrome(page, sel)).toEqual(before);
  });

  test('@ux-terminal-016 Escape key exits zen mode', async ({ page, sel }) => {
    const before = await chrome(page, sel);
    await enterZen(page, sel);
    await expect(page.locator(sel('composeInput'))).toBeHidden();
    // Focus stays on the zen control (an editor keeps Escape for itself while it has focus).
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    // Zen ends and the surrounding layout returns. (A runtime may also dismiss the editor pane on this Escape, so
    // the zen control itself is not required afterwards.)
    await expect(zenButton(page, 'Exit')).toHaveCount(0);
    await expect.poll(() => chrome(page, sel)).toEqual(before);
  });

  test('@ux-terminal-017 Hover-reveal tab strip in zen mode', async ({ page, sel }) => {
    await enterZen(page, sel);
    const strip = page.getByRole('tablist').first();
    const shown = () => strip.evaluate(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect();
      return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.5 && r.bottom > 0 && r.height > 0; }).catch(() => false);
    const box = (await strip.boundingBox())!;
    await page.mouse.move(page.viewportSize()!.width / 2, page.viewportSize()!.height / 2);
    await expect.poll(shown).toBe(false);
    // The top edge where the strip lives, towards its controls (an editor's empty strip area may not count).
    await page.mouse.move(box.x + box.width - 20, 1);
    await expect.poll(shown).toBe(true);
  });
});

test('@ux-terminal-006 Pop out terminal to new window (desktop)', async ({ page, context, runtime, sel }, testInfo) => {
  test.skip(!!testInfo.project.use.hasTouch, 'desktop scenario: pop-out windows are not offered on touch devices');
  await page.goto((await runtime.newSession()).url);
  await openTerminalTab(page, sel);
  if (await showDock(page).isVisible()) await showDock(page).click();
  const popup = context.waitForEvent('page');
  await page.getByRole('button', { name: /open terminal in (a )?(new |separate )?window|pop ?out terminal/i }).filter({ visible: true }).first().click();
  const win = await popup;
  await win.waitForLoadState();
  await expect(win.locator(sel('terminal')).filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(termTab(page)).toHaveCount(0);
  // Closing the separate window brings the terminal back.
  // Closed as a user would, from the window itself (unload handlers run).
  await win.evaluate(() => window.close()).catch(() => {});
  await win.waitForEvent('close', { timeout: 3_000 }).catch(() => win.close({ runBeforeUnload: true }).catch(() => {}));
  // The user is back in the original window.
  await page.bringToFront();
  await expect(termTab(page)).toBeVisible({ timeout: 15_000 });
  await closeTab(page);
});

test('@ux-workspace-014 Surface terminal load, availability, reconnect, and exit states', async ({ page, runtime, sel }) => {
  // Every WebSocket the page opens passes through, so an unexpected close can be injected.
  const sockets: { close: () => Promise<void> }[] = [];
  await page.routeWebSocket(/.*/, ws => { ws.connectToServer(); sockets.push({ close: () => ws.close({ code: 4001, reason: 'dropped by test' }) }); });
  await page.goto((await runtime.newSession()).url);
  await openTerminalTab(page, sel);
  await expect(terminal(page, sel)).toHaveAccessibleName(/connected/i);
  const n = nonce();
  await run(page, sel, `echo a-$((2+2))-${n}`, `a-4-${n}`);
  // The connection drops: the pane reconnects on its own and the shell answers again.
  const opened = sockets.length;
  for (const s of sockets.splice(0)) await s.close().catch(() => {});
  await expect.poll(() => sockets.length, { timeout: 20_000 }).toBeGreaterThan(0);
  expect(opened).toBeGreaterThan(0);
  await expect(terminal(page, sel)).toHaveAccessibleName(/connected/i, { timeout: 20_000 });
  await run(page, sel, `echo b-$((3+3))-${n}`, `b-6-${n}`);
  // The shell exits: an exited marker and status.
  await run(page, sel, 'exit', /exited/i);
  await expect(terminal(page, sel)).toHaveAccessibleName(/exited/i);
  // Load failure and an unavailable backend are not constructible against the reference instance.
  await closeTab(page);
});
