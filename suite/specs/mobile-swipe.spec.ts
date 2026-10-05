/**
 * Touch chat swipe (features/classic/mobile/swipe-independence.feature @ux-mobile-001..006, and
 * sessions/session-switching.feature @ux-session-005). An iPhone is emulated in a fresh context on the Chromium phone
 * project: swipes are synthetic touch events, which Playwright's WebKit cannot construct.
 */
import { test, expect } from '../fixtures';
import { nameRe } from '../pickers';
import { devices } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { Browser, Page, Locator } from '@playwright/test';

type Sel = (k: string) => string;
const trigger = (page: Page) => page.getByRole('button', { name: /manage sessions/i }).first();

/** Three sessions whose identifiers sort next to each other (shared random prefix, a < b < c), opened on b. */
async function iphoneOnTrio(browser: Browser, runtime: any, sel: Sel) {
  const p = `fx${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const [a, b, c] = [`${p}a`, `${p}b`, `${p}c`];
  const sessions = { a: await runtime.newSession(a), b: await runtime.newSession(b), c: await runtime.newSession(c) };
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto(sessions.b.url);
  await expect(page.locator(sel('composeInput'))).toBeVisible();
  await expect(trigger(page)).toHaveAccessibleName(nameRe(b));
  await page.waitForTimeout(1000);
  return { ctx, page, names: { a, b, c }, sessions };
}
/** A one-finger gesture starting at the centre of `target` (or a point inside it), moving by dx/dy. */
async function swipe(target: Locator, dx: number, dy = 0) {
  const b = (await target.boundingBox())!;
  const x0 = b.x + b.width / 2, y0 = b.y + Math.min(b.height / 2, 200);
  await target.evaluate((el, [x0, y0, dx, dy]) => {
    const t = (x: number, y: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
    const fire = (type: string, x: number, y: number) => el.dispatchEvent(new TouchEvent(type, {
      touches: type === 'touchend' ? [] : [t(x, y)], targetTouches: type === 'touchend' ? [] : [t(x, y)], changedTouches: [t(x, y)], bubbles: true, cancelable: true }));
    fire('touchstart', x0, y0);
    for (let i = 1; i <= 6; i++) fire('touchmove', x0 + dx * i / 6, y0 + dy * i / 6);
    fire('touchend', x0 + dx, y0 + dy);
  }, [x0, y0, dx, dy]);
}
const stays = async (page: Page, name: string) => { await page.waitForTimeout(1200); await expect(trigger(page)).toHaveAccessibleName(nameRe(name)); };

test.describe('iPhone', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'chromium-phone',
    "touch swipe runs on chromium-phone (iPhone emulation); Playwright's WebKit cannot construct Touch events"));

  for (const [id, title] of [
    ['@ux-mobile-001', 'Swipe on eligible timeline space'],
    ['@ux-mobile-004', 'Keep swipe order stable as the selected chat changes'],
  ] as const) test(`${id} ${title}`, async ({ browser, runtime, sel }) => {
    const { ctx, page, names } = await iphoneOnTrio(browser, runtime, sel);
    try {
      const tl = page.locator(sel('timeline'));
      // Neighbours in identifier order, the same in both directions from each stop.
      await swipe(tl, -150);
      await expect(trigger(page)).toHaveAccessibleName(nameRe(names.c));
      await swipe(tl, 150);
      await expect(trigger(page)).toHaveAccessibleName(nameRe(names.b));
      await swipe(tl, 150);
      await expect(trigger(page)).toHaveAccessibleName(nameRe(names.a));
      await swipe(tl, -150);
      await expect(trigger(page)).toHaveAccessibleName(nameRe(names.b));
      // A text selection blocks navigation.
      await page.locator(sel('composeInput')).fill(`[reply:select me ${names.b}] hi`);
      await page.locator(sel('composeInput')).press('Enter');
      const post = page.locator(sel('agentPost')).filter({ hasText: `select me ${names.b}` });
      await expect(post).toHaveCount(1);
      await post.evaluate(el => { const r = document.createRange(); r.selectNodeContents(el); getSelection()!.removeAllRanges(); getSelection()!.addRange(r); });
      await swipe(tl, -150);
      await stays(page, names.b);
    } finally { await ctx.close(); }
  });

  test('@ux-session-005 Keep touch swipe eligibility independent of picker grouping', async ({ browser, runtime, sel }) => {
    const { ctx, page, names, sessions } = await iphoneOnTrio(browser, runtime, sel);
    try {
      // Archive c (from its own page); swiping from b then skips it.
      await runtime.sessionHeadroom();
      await page.goto(sessions.c.url);
      page.on('dialog', d => void d.accept().catch(() => {}));
      await trigger(page).click();
      await page.getByRole('button', { name: /^(archive|delete) current/i }).click();
      await expect(trigger(page)).not.toHaveAccessibleName(nameRe(names.c));
      await page.goto(sessions.b.url);
      await expect(trigger(page)).toHaveAccessibleName(nameRe(names.b));
      await page.waitForTimeout(1000);
      await swipe(page.locator(sel('timeline')), -150);
      await expect(trigger(page)).not.toHaveAccessibleName(nameRe(names.b));
      await expect(trigger(page)).not.toHaveAccessibleName(nameRe(names.c));
      // Interactive targets are still excluded.
      await page.goto(sessions.b.url);
      await expect(trigger(page)).toHaveAccessibleName(nameRe(names.b));
      await page.waitForTimeout(1000);
      await swipe(page.locator(sel('composeInput')), -150);
      await stays(page, names.b);
    } finally { await ctx.close(); }
  });

  test('@ux-mobile-002 Ignore gestures originating in excluded controls', async ({ browser, runtime, sel }) => {
    const { ctx, page, names } = await iphoneOnTrio(browser, runtime, sel);
    try {
      // Composer input.
      await swipe(page.locator(sel('composeInput')), -150);
      await stays(page, names.b);
      // Session popup.
      await trigger(page).click();
      const popup = page.getByRole('listbox').first();
      await expect(popup).toBeVisible();
      await swipe(popup, -150);
      await stays(page, names.b);
      await page.keyboard.press('Escape');
    } finally { await ctx.close(); }
  });

  test('@ux-mobile-005 Do not treat primarily vertical movement as chat navigation', async ({ browser, runtime, sel }) => {
    const { ctx, page, names } = await iphoneOnTrio(browser, runtime, sel);
    try {
      await swipe(page.locator(sel('timeline')), -90, 160);
      await stays(page, names.b);
    } finally { await ctx.close(); }
  });
});

test('@ux-mobile-006 Limit horizontal wheel navigation to the supported Safari path', async ({ page, runtime, sel }, info) => {
  test.skip(/webkit/.test(info.project.name), 'the WebKit projects present as desktop Safari, the supported wheel path');
  const p = `fx${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  await runtime.newSession(`${p}a`);
  const b = await runtime.newSession(`${p}b`);
  await runtime.newSession(`${p}c`);
  await page.goto(b.url);
  await expect(trigger(page)).toHaveAccessibleName(nameRe(`${p}b`));
  const box = (await page.locator(sel('timeline')).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
  for (const dx of [300, -300]) {
    await page.mouse.wheel(dx, 0).catch(() => {});
    await page.locator(sel('timeline')).dispatchEvent('wheel', { deltaX: dx, deltaY: 0 });
    await stays(page, `${p}b`);
  }
});
