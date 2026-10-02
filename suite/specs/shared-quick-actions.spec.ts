/** Shared Quick actions contract (features/canonical/shared-ux.feature @ux-shared-003, 006). */
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

/** Click a timeline point that is not a control, so focus is on noninteractive content. */
async function focusTimeline(page: Page, sel: (k: string) => string) {
  const box = (await page.locator(sel('timeline')).boundingBox())!;
  const point = await page.evaluate(b => {
    for (let fy = 0.5; fy <= 0.9; fy += 0.1) for (let fx = 0.1; fx <= 0.9; fx += 0.2) {
      const [x, y] = [b.x + b.width * fx, b.y + b.height * fy];
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest('button, a, input, textarea, select, label, [role=button], [contenteditable=true], [tabindex]')) return [x, y];
    }
    return null;
  }, box);
  expect(point, 'a non-interactive timeline point').not.toBeNull();
  await page.mouse.click(point![0], point![1]);
}

const searchBox = (page: Page) => page.getByRole('textbox', { name: /jump|quick action|slash command/i });

test('@ux-shared-003 Type on the idle timeline to open Quick actions', async ({ page, runtime, sel }) => {
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  await input.fill('existing draft');
  await focusTimeline(page, sel);
  await page.keyboard.type('S');
  await expect(searchBox(page)).toHaveCount(1);
  await expect(searchBox(page)).toBeFocused();
  await expect(searchBox(page)).toHaveValue('S');

  // An exact title is preferred over a longer prefix match; the highlight wraps in both directions.
  const highlight = page.locator(sel('quickActionHighlight'));
  await searchBox(page).fill('/abort');
  await expect(highlight).toHaveCount(1);
  await expect(highlight).toContainText(/\/abort(?!-)/);
  const text = async () => ((await highlight.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  const first = await text();
  await page.keyboard.press('ArrowDown');
  const second = await text();
  expect(second, 'the "/abort" query matches at least two results').not.toBe(first);
  await page.keyboard.press('ArrowUp');
  expect(await text()).toBe(first);
  await page.keyboard.press('ArrowUp');
  expect(await text(), 'ArrowUp from the first result wraps to the last').not.toBe(first);
  await page.keyboard.press('ArrowDown');
  expect(await text(), 'ArrowDown from the last result wraps to the first').toBe(first);

  // Enter runs the highlighted action once and keeps the composer draft.
  await searchBox(page).fill('Show workspace');
  await expect(highlight).toContainText('Show workspace');
  await page.keyboard.press('Enter');
  await expect(searchBox(page)).toHaveCount(0);
  await expect(page.getByRole('complementary').filter({ hasText: /workspace/i }).first()).toBeVisible();
  await expect(input).toHaveValue('existing draft');
});

for (const dismissal of ['Escape', 'outside pointer'] as const) {
  test(`@ux-shared-006 Dismiss Quick actions without side effects: ${dismissal}`, async ({ page, runtime, sel }) => {
    const session = await runtime.newSession();
    await page.goto(session.url);
    const input = page.locator(sel('composeInput'));
    await input.fill('existing draft');
    await focusTimeline(page, sel);
    await page.keyboard.type('x');
    await expect(searchBox(page)).toBeFocused();
    if (dismissal === 'Escape') await page.keyboard.press('Escape');
    else await page.mouse.click(5, 5);
    await expect(searchBox(page)).toHaveCount(0);
    await expect(input).toHaveValue('existing draft');
    expect(page.url()).toContain(encodeURIComponent(session.id));
    await expect(page.getByRole('complementary').filter({ hasText: /workspace/i }).first()).toBeHidden();
  });
}
