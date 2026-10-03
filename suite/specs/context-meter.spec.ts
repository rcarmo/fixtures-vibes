/** Context meter (features/classic/compose/context-meter-tooltip.feature). Usage comes from the fixture model (128K window). */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

type Sel = (k: string) => string;
const meter = (page: Page) => page.getByRole('button', { name: /^context/i }).first();
const label = async (page: Page) => (await meter(page).getAttribute('aria-label')) ?? (await meter(page).innerText());

async function turn(page: Page, sel: Sel, usage: number, tag: string) {
  await page.locator(sel('composeInput')).fill(`[usage:${usage}][reply:${tag}] go`);
  await page.locator(sel('sendButton')).click();
  await expect(page.locator(sel('agentPost')).filter({ hasText: tag })).toHaveCount(1, { timeout: 30_000 });
}

test('@ux-context-001 Show supplied usage in the context tooltip', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  const n = Math.random().toString(16).slice(2, 8);
  await turn(page, sel, 64000, `half-${n}`);
  await expect.poll(() => label(page)).toMatch(/64K\b.*128K\b.*\b50%/);
  const size = (await meter(page).boundingBox())!;
  // Over capacity: at least 100%, and the meter keeps its size.
  await turn(page, sel, 150000, `over-${n}`);
  await expect.poll(() => label(page)).toMatch(/150K\b.*128K\b/);
  expect(Number((await label(page)).match(/(\d+)%/)?.[1])).toBeGreaterThanOrEqual(100);
  const over = (await meter(page).boundingBox())!;
  expect(Math.abs(over.width - size.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(over.height - size.height)).toBeLessThanOrEqual(1);
});

/** Hue (0-360) of the meter's most saturated stroke: its usage fill. */
async function fillHue(page: Page) {
  const strokes = await meter(page).locator('circle, path').evaluateAll(es => es.map(e => getComputedStyle(e).stroke));
  const hsl = strokes.map(c => {
    const [r, g, b] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(n => Number(n) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { hue: (h * 60 + 360) % 360, sat: d };
  });
  return hsl.sort((x, y) => y.sat - x.sat)[0].hue;
}
const band = (hue: number) => (hue < 20 || hue > 340 ? 'red' : hue < 65 ? 'amber' : hue > 80 && hue < 180 ? 'green' : `hue ${Math.round(hue)}`);

test('@ux-context-005 Apply the coded usage warning colours', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  const n = Math.random().toString(16).slice(2, 8);
  // 128K window: 95000 = 74%, 97280 = 76%, 114000 = 89%, 116480 = 91% (the reply's own tokens add a little, so the
  // points stay clear of the 75% and 90% boundaries).
  for (const [usage, expected] of [[95000, 'green'], [97280, 'amber'], [114000, 'amber'], [116480, 'red']] as const) {
    await turn(page, sel, usage, `u${usage}-${n}`);
    await expect.poll(() => label(page)).toMatch(new RegExp(`\\b${Math.round(usage / 1280)}%`));
    await expect.poll(async () => band(await fillHue(page)), `${usage} tokens`).toBe(expected);
  }
});
