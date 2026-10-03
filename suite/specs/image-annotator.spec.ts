/**
 * Inline image annotation on iPad-class devices (features/classic/timeline/annotation-highlights.feature
 * @ux-timeline-001..007). The iPad is emulated with Playwright's iPad descriptor in a fresh context on the tablet
 * projects. Strokes are synthetic touch events: Playwright's WebKit cannot construct Touch objects, so the drawing
 * scenarios run on Chromium only.
 */
import { test, expect } from '../fixtures';
import { png } from '../png';
import { devices } from '@playwright/test';
import type { Browser, Page, Locator, TestInfo } from '@playwright/test';

type Sel = (k: string) => string;
const isTablet = (info: TestInfo) => /tablet/.test(info.project.name);
const isWebkit = (info: TestInfo) => /webkit/.test(info.project.name);
const svg = (w: number, h: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#3a7"/></svg>`);

/** An iPad page in session `url` with a posted image attachment. */
async function ipadWithImage(browser: Browser, runtime: any, sel: Sel, file: { name: string; mimeType: string; buffer: Buffer }) {
  const ctx = await browser.newContext({ ...devices['iPad Pro 11'] });
  const page = await ctx.newPage();
  await postImage(page, runtime, sel, file);
  return { ctx, page };
}
async function postImage(page: Page, runtime: any, sel: Sel, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto((await runtime.newSession()).url);
  const tag = file.name.replace(/\.\w+$/, '');
  await page.locator(sel('composeBox')).locator('input[type=file]').first().setInputFiles(file);
  await page.locator(sel('composeInput')).fill(`[reply:${tag}] image`);
  await page.locator(sel('composeInput')).press('Enter');
  await expect(page.locator(sel('agentPost')).filter({ hasText: tag })).toHaveCount(1, { timeout: 30_000 });
  return page.locator(sel('userPost')).last().locator('img').first();
}
const annotator = (page: Page) => page.getByRole('dialog', { name: /annotate/i });
async function openAnnotator(page: Page, sel: Sel) {
  await page.locator(sel('userPost')).last().locator('img').first().tap();
  await expect(annotator(page)).toBeVisible();
  await page.waitForTimeout(600); // a tap that opens the annotator does not also draw
}
/** The canvases in paint order: source raster first, then drawing layers. */
const canvases = (page: Page) => annotator(page).locator('canvas').evaluateAll(es => es.map(e => {
  const c = e as HTMLCanvasElement, d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) ink++;
  return { width: c.width, height: c.height, ink, scale: new DOMMatrix(getComputedStyle(c.parentElement!).transform).a };
}));
const ink = async (page: Page) => (await canvases(page)).slice(1).reduce((n, c) => n + c.ink, 0);
/** Synthetic touch sequence on the drawing surface: each step lists finger positions as fractions of the surface. */
async function touches(page: Page, steps: [number, number][][]) {
  const surface = annotator(page).locator('canvas').nth(1);
  const b = (await surface.boundingBox())!;
  const at = (pts: [number, number][]) => pts.map(([fx, fy]) => [b.x + b.width * fx, b.y + b.height * fy]);
  const send = (type: string, pts: number[][]) => surface.evaluate((c, [type, pts]) => {
    const ts = (pts as number[][]).map(([x, y], i) => new Touch({ identifier: i + 1, target: c, clientX: x, clientY: y, pageX: x, pageY: y }));
    const live = type === 'touchend' ? [] : ts;
    c.dispatchEvent(new TouchEvent(type as string, { touches: live, targetTouches: live, changedTouches: ts, bubbles: true, cancelable: true }));
  }, [type, pts] as const);
  await send('touchstart', at(steps[0]));
  for (const s of steps.slice(1)) await send('touchmove', at(s));
  await send('touchend', at(steps[steps.length - 1]));
  await page.waitForTimeout(200);
}
const stroke = (page: Page) => touches(page, [[[0.2, 0.3]], [[0.4, 0.5]], [[0.6, 0.6]], [[0.8, 0.7]]]);
const tool = (page: Page, name: string) => annotator(page).getByRole('button', { name: new RegExp(`^${name}$`, 'i') });

test.describe('iPad', () => {
  test.beforeEach(({}, info) => test.skip(!isTablet(info), 'iPad scenario: runs on the tablet projects'));

  test('@ux-timeline-001 iPad image tap opens the inline annotator', async ({ browser, runtime, sel }) => {
    const { ctx, page } = await ipadWithImage(browser, runtime, sel, { name: `ann-${Date.now().toString(36)}.png`, mimeType: 'image/png', buffer: png(64, 48) });
    try {
      await openAnnotator(page, sel);
      for (const name of ['Pen', 'Highlighter', 'Arrow', 'Rectangle', 'Text', 'Crop', 'Eraser', 'Undo']) await expect(tool(page, name)).toBeVisible();
    } finally { await ctx.close(); }
  });

  test('@ux-timeline-005 Cancel closes the annotator without queuing a preview', async ({ browser, runtime, sel }) => {
    const { ctx, page } = await ipadWithImage(browser, runtime, sel, { name: `ann-${Date.now().toString(36)}.png`, mimeType: 'image/png', buffer: png(64, 48) });
    try {
      await openAnnotator(page, sel);
      await tool(page, 'Cancel').tap();
      await expect(annotator(page)).toHaveCount(0);
      await page.waitForTimeout(500);
      await expect(page.getByRole('button', { name: /^discard/i })).toHaveCount(0);
    } finally { await ctx.close(); }
  });

  test.describe('drawing', () => {
    test.beforeEach(({}, info) => test.skip(isWebkit(info), "environment limit: Playwright's WebKit cannot construct Touch events"));

    test('@ux-timeline-002 Two-finger gestures pinch instead of drawing', async ({ browser, runtime, sel }) => {
      const { ctx, page } = await ipadWithImage(browser, runtime, sel, { name: `ann-${Date.now().toString(36)}.png`, mimeType: 'image/png', buffer: png(64, 48) });
      try {
        await openAnnotator(page, sel);
        const before = await ink(page);
        await touches(page, [[[0.4, 0.5], [0.6, 0.5]], [[0.3, 0.5], [0.7, 0.5]], [[0.1, 0.5], [0.9, 0.5]]]);
        await page.waitForTimeout(600);
        // Zoomed, and nothing drawn.
        expect((await canvases(page))[0].scale).toBeGreaterThan(1);
        expect(await ink(page)).toBeLessThanOrEqual(before);
        // A single finger still draws afterwards.
        await stroke(page);
        expect(await ink(page)).toBeGreaterThan(before);
      } finally { await ctx.close(); }
    });

    test('@ux-timeline-003 Applying crop reduces the working image and resets crop state', async ({ browser, runtime, sel }) => {
      const { ctx, page } = await ipadWithImage(browser, runtime, sel, { name: `ann-${Date.now().toString(36)}.png`, mimeType: 'image/png', buffer: png(64, 48) });
      try {
        await openAnnotator(page, sel);
        await stroke(page);
        const [src] = await canvases(page);
        await tool(page, 'Crop').tap();
        await touches(page, [[[0.25, 0.25]], [[0.5, 0.5]], [[0.75, 0.75]]]);
        await annotator(page).getByRole('button', { name: /^apply crop$/i }).tap();
        // Source and annotation layers shrink to the crop.
        const after = await canvases(page);
        expect(after[0].width).toBeLessThan(src.width);
        expect(after[0].height).toBeLessThan(src.height);
        for (const c of after) expect([c.width, c.height]).toEqual([after[0].width, after[0].height]);
        // The crop selection is gone and the pen is back: a stroke draws.
        await expect(annotator(page).getByRole('button', { name: /^apply crop$/i })).toHaveCount(0);
        const drawn = await ink(page);
        await stroke(page);
        expect(await ink(page)).toBeGreaterThan(drawn);
      } finally { await ctx.close(); }
    });

    for (const [id, title, file] of [
      ['@ux-timeline-004', 'Done uploads a flattened PNG and queues a preview', { name: `ann-${Date.now().toString(36)}.png`, mimeType: 'image/png', buffer: png(64, 48) }],
      ['@ux-timeline-007', 'SVG sources are rasterized before PNG export', { name: `svg-${Date.now().toString(36)}.svg`, mimeType: 'image/svg+xml', buffer: svg(64, 48) }],
    ] as const) test(`${id} ${title}`, async ({ browser, runtime, sel }) => {
      const { ctx, page } = await ipadWithImage(browser, runtime, sel, { ...file, name: file.name.replace(/(\.\w+)$/, `-${Math.random().toString(16).slice(2, 6)}$1`) });
      try {
        await openAnnotator(page, sel);
        // The source is drawn into a canvas (an SVG included).
        expect((await canvases(page))[0].ink).toBeGreaterThan(0);
        await stroke(page);
        const uploads: string[] = [];
        page.on('request', r => { if (r.method() === 'POST' && /multipart\/form-data/.test(r.headers()['content-type'] ?? '')) uploads.push(r.url()); });
        await tool(page, 'Done').tap();
        await expect(annotator(page)).toHaveCount(0);
        await expect.poll(() => uploads.length).toBeGreaterThan(0);
        const discard = page.getByRole('button', { name: /^discard/i }).first();
        await expect(discard).toBeVisible();
        // The queued preview shows the uploaded result: a PNG.
        const preview = discard.locator('xpath=ancestor::*[.//img][1]//img').first();
        await expect(preview).toBeVisible();
        const res = await page.request.get(new URL((await preview.getAttribute('src'))!, page.url()).href);
        expect((await res.body()).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        await expect(discard.locator('xpath=..').getByRole('button', { name: /^send/i })).toBeVisible();
      } finally { await ctx.close(); }
    });
  });
});

test('@ux-timeline-006 Non-iPad image activation opens the lightbox instead', async ({ page, runtime, sel }) => {
  const img = await postImage(page, runtime, sel, { name: `ann-${Date.now().toString(36)}.png`, mimeType: 'image/png', buffer: png(64, 48) });
  await img.click();
  await expect(page.locator(sel('imageModal'))).toBeVisible();
  await expect(annotator(page)).toHaveCount(0);
});
