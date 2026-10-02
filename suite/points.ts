/** Point selection on the timeline for pointer-driven specs. */
import type { Page } from '@playwright/test';

const INTERACTIVE = 'button, a, input, textarea, select, label, [role=button], [role=menu], [role=menuitem], [contenteditable=true], [tabindex]';

/**
 * A point inside the timeline whose hit target is not a control: no interactive element lies between the target and
 * the timeline. The timeline element itself may be focusable (e.g. a `tabindex=0` conversation region); overlays and
 * points outside the timeline are rejected. Rows are scanned top-down or bottom-up.
 */
export async function quietTimelinePoint(page: Page, timelineSelector: string, order: 'top-down' | 'bottom-up' = 'top-down') {
  // The timeline may still be rendering right after navigation; wait for it, then retry briefly.
  await page.locator(timelineSelector).first().waitFor();
  for (const deadline = Date.now() + 5_000; ;) {
    const point = await scan(page, timelineSelector, order);
    if (point || Date.now() > deadline) return point;
    await page.waitForTimeout(250);
  }
}

function scan(page: Page, timelineSelector: string, order: 'top-down' | 'bottom-up') {
  return page.evaluate(({ selector, interactive, bottomUp }) => {
    const timeline = document.querySelector(selector);
    if (!timeline) return null;
    const b = timeline.getBoundingClientRect();
    const rows = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    for (const fy of bottomUp ? rows.reverse() : rows) for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const [x, y] = [b.x + b.width * fx, b.y + b.height * fy];
      const el = document.elementFromPoint(x, y);
      if (!el || !timeline.contains(el)) continue;
      const control = el.closest(interactive);
      if (control && control !== timeline && timeline.contains(control)) continue;
      return [x, y] as [number, number];
    }
    return null;
  }, { selector: timelineSelector, interactive: INTERACTIVE, bottomUp: order === 'bottom-up' });
}
