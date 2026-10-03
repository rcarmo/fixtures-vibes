/** Image lightbox dismissal (features/classic/timeline/lightbox-dismissal.feature). */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { png } from '../png';

type Sel = (k: string) => string;

/** A small solid-colour PNG. */

/** Send a message with an image attachment and open that image in the lightbox. */
async function openLightbox(page: Page, runtime: any, sel: Sel) {
  await page.goto((await runtime.newSession()).url);
  const tag = `img-${Math.random().toString(16).slice(2, 8)}`;
  await page.locator(sel('composeBox')).locator('input[type=file]').first().setInputFiles({ name: `${tag}.png`, mimeType: 'image/png', buffer: png(64, 48) });
  await page.locator(sel('composeInput')).fill(`[reply:${tag}] image`);
  await page.locator(sel('sendButton')).click();
  await expect(page.locator(sel('agentPost')).filter({ hasText: tag })).toHaveCount(1, { timeout: 30_000 });
  await page.locator(sel('userPost')).last().locator('img').first().click();
  await expect(page.locator(sel('imageModal'))).toBeVisible();
}

test('@ux-timeline-013 Escape key dismisses the lightbox', async ({ page, runtime, sel }) => {
  await openLightbox(page, runtime, sel);
  await page.keyboard.press('Escape');
  await expect(page.locator(sel('imageModal'))).toBeHidden();
  await expect(page.locator(sel('timeline'))).toBeVisible();
});

test('@ux-timeline-014 Non-Escape keys do not dismiss the lightbox', async ({ page, runtime, sel }) => {
  await openLightbox(page, runtime, sel);
  for (const key of ['Space', 'Enter', 'a', 'ArrowRight']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(200);
    await expect(page.locator(sel('imageModal')), key).toBeVisible();
  }
});

test('@ux-timeline-015 Clicking anywhere inside the modal dismisses the lightbox', async ({ page, runtime, sel }) => {
  await openLightbox(page, runtime, sel);
  // The backdrop: a corner of the modal surface.
  const box = (await page.locator(sel('imageModal')).boundingBox())!;
  await page.mouse.click(box.x + 5, box.y + 5);
  await expect(page.locator(sel('imageModal'))).toBeHidden();
  // The image itself.
  await page.locator(sel('userPost')).last().locator('img').first().click();
  await expect(page.locator(sel('imageModal'))).toBeVisible();
  await page.locator(sel('imageModal')).locator('img').first().click({ force: true });
  await expect(page.locator(sel('imageModal'))).toBeHidden();
});

test('@ux-timeline-016 Tapping the modal surface on a touch device dismisses the lightbox', async ({ page, runtime, sel }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'touch scenario: not applicable without a touch screen');
  await openLightbox(page, runtime, sel);
  const box = (await page.locator(sel('imageModal')).boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 10);
  await expect(page.locator(sel('imageModal'))).toBeHidden();
});
