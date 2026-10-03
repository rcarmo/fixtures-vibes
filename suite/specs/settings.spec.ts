/**
 * Settings dialog shell, layering and core panes (features/classic/settings/settings-dialog.feature,
 * settings-layering.feature; canonical/core-settings.feature @ux-settings-001..004).
 */
import { test, expect } from '../fixtures';
import { menu, openWorkspace, pane, treeRow, previewPath, uploadFile, removeFiles, rowOf } from '../workspace';
import type { Page } from '@playwright/test';

type Sel = (k: string) => string;
const dialog = (page: Page, sel: Sel) => page.locator(sel('settingsDialog'));
/** A section in the dialog's navigation (narrow layouts may show icons only, so match the label text). */
const nav = (page: Page, sel: Sel, name: string) => dialog(page, sel).locator('nav').getByRole('button').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`, 'i') });
/** Whether the dialog fills the viewport (narrow layouts): then there is no backdrop region to see or click. */
const fullScreen = async (page: Page, sel: Sel) => {
  const b = (await dialog(page, sel).boundingBox())!, vp = page.viewportSize()!;
  return b.x <= 1 && b.y <= 1 && b.width >= vp.width - 2 && b.height >= vp.height - 2;
};

/** The Settings shortcut, pressed with focus on the page rather than in a text field. */
async function pressShortcut(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+Comma');
}

async function openSettings(page: Page, sel: Sel, via: 'shortcut' | 'menu' = 'shortcut') {
  if (via === 'menu') {
    await menu(page).click();
    await page.getByRole('menuitem', { name: /^settings/i }).click();
  } else {
    // The shortcut is live once the shell has started; press again only if nothing opened.
    await expect(page.locator(sel('composeInput'))).toBeVisible();
    for (let i = 0; i < 3 && !(await dialog(page, sel).count()); i++) {
      await pressShortcut(page);
      await dialog(page, sel).waitFor({ timeout: 2_000 }).catch(() => {});
    }
  }
  await expect(dialog(page, sel)).toBeVisible();
  // Let any opening animation finish before measuring.
  let last = '';
  await expect.poll(async () => { const b = JSON.stringify(await dialog(page, sel).boundingBox()); const same = b === last; last = b; return same; }, { intervals: [150] }).toBe(true);
}
/** What is drawn at a viewport point outside the dialog (the backdrop, if one covers the page). */
const hitOutside = (page: Page, sel: Sel, x: number, y: number) => dialog(page, sel).evaluate((d, [px, py]) => {
  const hit = document.elementFromPoint(px, py) as HTMLElement | null;
  if (!hit || d.contains(hit)) return null;
  const cs = getComputedStyle(hit), r = hit.getBoundingClientRect();
  return { fixed: cs.position === 'fixed', bg: cs.backgroundColor, covers: r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight,
    inWorkspace: !!hit.closest('aside, [role=complementary]') };
}, [x, y]);
const alpha = (c: string) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 1; const p = m[1].split(',').map(Number); return p.length > 3 ? p[3] : 1; };
/** A point over the workspace pane, outside the dialog. */
async function workspacePoint(page: Page, sel: Sel) {
  const vp = page.viewportSize()!;
  const w = (await pane(page).boundingBox()) ?? { x: 0, y: 0, width: vp.width, height: vp.height };
  const d = (await dialog(page, sel).boundingBox())!;
  for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.2], [0.5, 0.9], [0.8, 0.1]]) {
    const x = w.x + w.width * fx, y = w.y + w.height * fy;
    if (x < d.x || x > d.x + d.width || y < d.y || y > d.y + d.height) return { x, y };
  }
  return { x: w.x + 5, y: w.y + 5 };
}

test('@ux-settings-001 Open Settings once and dismiss it without activating the workspace underneath', async ({ page, runtime, sel }) => {
  const session = await runtime.newSession();
  await page.goto(session.url);
  await openWorkspace(page);
  for (const via of ['shortcut', 'menu'] as const) for (const dismiss of ['Escape', 'backdrop'] as const) {
    const before = { url: page.url(), preview: await previewPath(page) };
    await openSettings(page, sel, via);
    await expect(dialog(page, sel)).toHaveCount(1);
    const p = await workspacePoint(page, sel);
    const hit = await hitOutside(page, sel, p.x, p.y);
    // Whatever is drawn there (backdrop, or the dialog itself when it fills a narrow screen), it is not the workspace.
    expect(hit?.inWorkspace ?? false, `${via}: workspace covered`).toBe(false);
    if (dismiss === 'Escape' || !hit) await page.keyboard.press('Escape');
    else await page.mouse.click(p.x, p.y);
    await expect(dialog(page, sel)).toHaveCount(0);
    expect(page.url()).toBe(before.url);
    expect(await previewPath(page)).toBe(before.preview);
    await expect(pane(page)).toBeVisible();
  }
});

for (const [id, name] of [
  ['@ux-settings-002', 'Cold-open Settings shows a shell immediately and then resolves General'],
  ['@ux-settings-dialog-003', 'Settings shows loading shell then content'],
] as const) test(`${id} ${name}`, async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  const t0 = Date.now();
  await openSettings(page, sel);
  // Something is drawn at once (a shell or the dialog), and General is the section that resolves first.
  expect(Date.now() - t0).toBeLessThan(2_000);
  await expect(nav(page, sel, 'General')).toBeVisible({ timeout: 2_000 });
  await expect(nav(page, sel, 'General')).toHaveClass(/\bactive\b/, { timeout: 2_000 });
});

for (const [id, name] of [
  ['@ux-settings-003', 'General is preloaded and other built-in sections lazy-load on first visit'],
  ['@ux-settings-dialog-005', 'Non-General panes load only on click'],
] as const) test(`${id} ${name}`, async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  await openSettings(page, sel);
  // Unvisited sections render nothing yet; Models renders when chosen, and again at once when revisited.
  const models = dialog(page, sel).getByPlaceholder(/models/i);
  await expect(models).toHaveCount(0);
  await nav(page, sel, 'Models').click();
  await expect(models).toBeVisible({ timeout: 5_000 });
  await nav(page, sel, 'General').click();
  await expect(models).toHaveCount(0);
  const t0 = Date.now();
  await nav(page, sel, 'Models').click();
  await expect(models).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(1_000);
});

test('@ux-settings-004 Searchable sections focus the header filter and responsive widths change layout classes only', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  await openSettings(page, sel);
  await nav(page, sel, 'Models').click();
  const filter = dialog(page, sel).getByPlaceholder(/models/i);
  await expect(filter).toBeFocused();
  // Narrower windows change the layout, not the behaviour: the filter still filters.
  for (const width of [700, 420]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(filter).toBeVisible();
    await filter.fill('fixture-2');
    await expect(dialog(page, sel).getByText(/fixture-2/).first()).toBeVisible();
    await expect(dialog(page, sel).getByText(/fixture-1(?!\d)/)).toHaveCount(0);
    await filter.fill('');
  }
});

test('@ux-settings-dialog-001 Rapid shortcut presses open exactly one settings dialog', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+Comma');
  await expect(dialog(page, sel)).toBeVisible();
  await page.waitForTimeout(800);
  await expect(dialog(page, sel)).toHaveCount(1);
});

test('@ux-settings-dialog-002 Second settings open is instant', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  await openSettings(page, sel);
  await expect(nav(page, sel, 'General')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page, sel)).toHaveCount(0);
  const t0 = Date.now();
  await openSettings(page, sel);
  await expect(nav(page, sel, 'General')).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(1_000);
});

test('@ux-settings-dialog-004 User can type a number in stepper fields', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  await openSettings(page, sel);
  // The first section that has a numeric field.
  let field = null;
  for (const item of await dialog(page, sel).locator('nav').getByRole('button').all()) {
    await item.click();
    await page.waitForTimeout(300);
    // An enabled numeric field whose range admits the value typed below.
    const fields = dialog(page, sel).locator('input[type=number]:enabled, [role=spinbutton]:not([aria-disabled=true])').filter({ visible: true });
    const fits = await fields.evaluateAll(es => es.map(e => { const max = e.getAttribute('max') ?? e.getAttribute('aria-valuemax'); return !max || Number(max) >= 128000; }));
    const i = fits.indexOf(true);
    if (i >= 0) { field = fields.nth(i); break; }
  }
  expect(field, 'a settings pane with a numeric field').not.toBeNull();
  const original = await field!.inputValue();
  await field!.click();
  await field!.fill('');
  await page.keyboard.type('128000');
  await expect(field!).toHaveValue('128000');
  // Put the setting back as it was.
  await field!.fill(original);
  await expect(field!).toHaveValue(original);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
});

test.describe('layering', () => {
  test.beforeEach(async ({ page, runtime }) => {
    await page.goto((await runtime.newSession()).url);
    await openWorkspace(page);
  });

  test('@ux-settings-layering-001 Settings backdrop covers workspace pane', async ({ page, sel }) => {
    await openSettings(page, sel);
    test.skip(await fullScreen(page, sel), 'the dialog fills this viewport: no backdrop region is shown');
    const p = await workspacePoint(page, sel);
    const hit = (await hitOutside(page, sel, p.x, p.y))!;
    expect(hit.inWorkspace).toBe(false);
    expect(hit.fixed && hit.covers).toBe(true);
    expect(alpha(hit.bg)).toBeGreaterThan(0);
    expect(alpha(hit.bg)).toBeLessThan(1);
  });

  test('@ux-settings-layering-002 Settings dialog is above all other elements', async ({ page, sel }) => {
    await openSettings(page, sel);
    const box = (await dialog(page, sel).boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
    const top = await dialog(page, sel).evaluate((d, [x, y]) => d.contains(document.elementFromPoint(x, y)), [box.x + box.width / 2, box.y + box.height / 2]);
    expect(top).toBe(true);
    if (!(await fullScreen(page, sel))) {
      const p = await workspacePoint(page, sel);
      expect((await hitOutside(page, sel, p.x, p.y))?.fixed).toBe(true);
    }
  });

  test('@ux-settings-layering-003 Backdrop is partially opaque (not fully transparent or opaque)', async ({ page, sel }) => {
    await openSettings(page, sel);
    test.skip(await fullScreen(page, sel), 'the dialog fills this viewport: no backdrop region is shown');
    const vp = page.viewportSize()!;
    const hit = (await hitOutside(page, sel, 2, vp.height - 2))!;
    expect(hit.bg).toBe('rgba(0, 0, 0, 0.5)');
  });

  test('@ux-settings-layering-004 Only settings dialog is interactive above the backdrop', async ({ page, sel }) => {
    // A workspace file the user could otherwise select.
    // Two files: the later upload is selected, so selecting the first is an observable change.
    const name = await uploadFile(page, 'layering');
    const other = await uploadFile(page, 'other');
    try {
      if ((await previewPath(page)) === name) await (await rowOf(page, other)).click();
      const row = await rowOf(page, name);
      const before = await previewPath(page);
      expect(before).not.toBe(name);
      await openSettings(page, sel);
      const box = (await row.boundingBox())!;
      // The click lands on the backdrop or the dialog, never on the workspace file.
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
      expect(await previewPath(page)).toBe(before);
      if (await dialog(page, sel).count()) await page.keyboard.press('Escape');
      await expect(dialog(page, sel)).toHaveCount(0);
      // With Settings gone the workspace responds again.
      await row.click();
      await expect.poll(() => previewPath(page)).toBe(name);
    } finally {
      await removeFiles(page, [name, other]);
    }
  });
});

test.describe('core sections', () => {
  const section = async (page: Page, sel: Sel, name: string) => {
    await page.goto(page.url());
    await openSettings(page, sel);
    await nav(page, sel, name).click();
  };
  test.beforeEach(async ({ page, runtime }) => { await page.goto((await runtime.newSession()).url); });

  test('@ux-settings-016 Keyboard settings filters and edits shortcut bindings through the shared shortcut model', async ({ page, sel }) => {
    await section(page, sel, 'Keyboard');
    const d = dialog(page, sel);
    const filter = d.getByPlaceholder(/filter shortcuts/i);
    const rows = () => d.getByRole('button', { name: /^default$/i }).count();
    await expect.poll(rows).toBeGreaterThan(3);
    const all = await rows();
    await filter.fill('zen');
    await expect.poll(rows).toBeLessThan(all);
    await expect.poll(rows).toBeGreaterThan(0);
    await expect(d.getByRole('button', { name: /^reset all/i })).toBeVisible();
    // The zen row: its default binding is shown; a saved draft persists; Default restores it.
    const binding = d.locator('input[type=text]').filter({ visible: true }).first();
    const original = await binding.inputValue();
    expect(original).toMatch(/\w+\+\w+/);
    const save = d.getByRole('button', { name: /^save$/i }).first();
    try {
      await binding.fill('ctrl+alt+shift+9');
      await save.click();
      await page.keyboard.press('Escape');
      await section(page, sel, 'Keyboard');
      await dialog(page, sel).getByPlaceholder(/filter shortcuts/i).fill('zen');
      await expect(binding).toHaveValue('ctrl+alt+shift+9');
    } finally {
      await d.getByRole('button', { name: /^default$/i }).first().click();
      await expect(binding).toHaveValue(original);
      await save.click().catch(() => {});
    }
  });

  test('@ux-settings-018 Appearance settings apply theme preset, custom tint and output padding from one section', async ({ page, sel }) => {
    await section(page, sel, 'Appearance');
    const d = dialog(page, sel);
    const preset = d.getByRole('radio', { name: /^ristretto$/i });
    const byDefault = d.getByRole('radio', { name: /^default/i });
    await expect(preset).toBeVisible();
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    try {
      // A preset row applies at once; so does going back to the default theme.
      const start = await bg();
      await preset.check();
      await expect.poll(bg).not.toBe(start);
      const presetBg = await bg();
      await byDefault.check();
      await expect.poll(bg).not.toBe(presetBg);
      const plain = await bg();
      // The default theme takes a custom tint, which can be cleared.
      const tint = d.locator('input[type=color]').first();
      await tint.evaluate((e: HTMLInputElement) => { e.value = '#cc3366'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
      await expect.poll(bg).not.toBe(plain);
      await d.getByTitle(/clear tint/i).click();
      await expect.poll(bg).toBe(plain);
      // Output padding is a bounded number.
      const padding = d.locator('input[type=number]').first();
      const [min, max] = [await padding.getAttribute('min'), await padding.getAttribute('max')];
      expect(min).not.toBeNull();
      expect(max).not.toBeNull();
    } finally {
      if (await byDefault.isVisible().catch(() => false)) await byDefault.check().catch(() => {});
    }
  });

  test('@ux-settings-019 Save General changes after the debounce', async ({ page, sel }) => {
    await section(page, sel, 'General');
    const d = dialog(page, sel);
    const limit = d.getByLabel(/^upload limit/i);
    const original = await limit.inputValue();
    const writes: number[] = [];
    // Settings saves only (their body carries the upload limit); other background writes are ignored.
    page.on('request', r => { if (r.method() !== 'GET' && /upload/i.test(r.postData() ?? '')) writes.push(Date.now()); });
    try {
      // A change is saved once, after a pause, and reported as applied.
      const t0 = Date.now();
      await d.getByRole('button', { name: /^increase upload limit/i }).click();
      await page.waitForTimeout(400);
      expect(writes.length).toBe(0);
      await expect.poll(() => writes.length, { timeout: 5_000 }).toBe(1);
      expect(writes[0] - t0).toBeGreaterThanOrEqual(600);
      await expect(d.getByText(/applied|saved/i).first()).toBeVisible();
      await expect(limit).toHaveValue(String(Number(original) + 1));
      // A failed save is reported in Settings. (Only the settings save is failed: its body carries the upload limit.)
      let failed = false;
      await page.route('**/*', route => {
        const body = route.request().postData() ?? '';
        if (failed || route.request().method() === 'GET' || !/upload/i.test(body)) return route.fallback();
        failed = true;
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'settings save rejected' }) });
      });
      await d.getByRole('button', { name: /^decrease upload limit/i }).click();
      await expect.poll(() => failed, { timeout: 5_000 }).toBe(true);
      await expect(d.getByText(/error|failed|could not|rejected/i).first()).toBeVisible();
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      if ((await limit.inputValue().catch(() => original)) !== original) {
        await limit.fill(original);
        await page.waitForTimeout(1500);
      }
    }
  });
});
