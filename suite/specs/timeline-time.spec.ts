/** Post times in the viewer's time zone (features/classic/timeline/rendering.feature @ux-timeline-029). */
import { test, expect } from '../fixtures';
import { randomUUID } from 'node:crypto';

// +05:45 cannot be matched by a UTC-as-local or whole-hour mistake.
test.use({ timezoneId: 'Asia/Kathmandu' });

test('@ux-timeline-029 Post times are shown in the viewer\'s time zone', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  await page.goto((await runtime.newSession()).url);
  const input = page.locator(sel('composeInput'));
  const sentAt = Date.now();
  await input.fill(`[reply:time-${n}] when ${n}`);
  await input.press('Enter');
  const reply = page.locator(sel('agentPost')).filter({ hasText: `time-${n}` });
  await expect(reply).toHaveCount(1);
  const shownAt = Date.now();
  await expect(reply.getByText(/just now|now|seconds? ago|\d+s ago/i).first()).toBeVisible();

  // Absolute time: an ISO datetime attribute, or a date-bearing title. Parsed in the page: a zone-less
  // title is read in the browser time zone; an ISO title keeps its own Z/offset.
  const parsed = await reply.evaluate(el => {
    const iso = el.querySelector('time[datetime]')?.getAttribute('datetime');
    if (iso) return Date.parse(iso);
    for (const t of Array.from(el.querySelectorAll('[title]')).map(e => e.getAttribute('title') ?? '')) {
      const m = t.match(/(\d{1,2}\/\d{1,2}\/\d{4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/i) ?? t.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)/);
      if (m) return new Date(m[1]).getTime();
    }
    return NaN;
  });
  expect(Number.isNaN(parsed), 'the reply exposes its absolute send time').toBe(false);
  // Titles have second precision; allow the turn's own duration plus clock slack.
  expect(parsed).toBeGreaterThanOrEqual(Math.floor(sentAt / 1000) * 1000 - 60_000);
  expect(parsed).toBeLessThanOrEqual(shownAt + 60_000);
});
