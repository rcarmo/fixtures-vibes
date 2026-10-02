/** Session picker coherence (features/canonical/shared-ux.feature @ux-shared-014). */
import { test, expect } from '../fixtures';
import { holdReads } from '../net';
import { randomUUID } from 'node:crypto';

test('@ux-shared-014 Select one coherent session view', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const main = await runtime.newSession();
  const research = await runtime.newSession();
  const input = page.locator(sel('composeInput'));
  const modelButton = page.getByRole('button', { name: /model picker/i }).first();
  const reply = (text: string) => page.locator(sel('agentPost')).filter({ hasText: text });

  // "research" runs on the second fixture model; "main" stays on the first.
  await page.goto(research.url);
  await input.fill(`[reply:research-${n}] r ${n}`);
  await input.press('Enter');
  await expect(reply(`research-${n}`)).toHaveCount(1);
  await input.fill('/model fixture/fixture-2');
  await input.press('Enter');
  await expect(modelButton).toContainText(/fixture-2|fixture model two/i);
  await page.goto(main.url);
  await input.fill(`[reply:main-${n}] m ${n}`);
  await input.press('Enter');
  await expect(reply(`main-${n}`)).toHaveCount(1);
  await expect(modelButton).toContainText(/fixture-1|fixture model one/i);

  // Reload "main" with its per-session state reads delayed, then leave for "research" by keyboard alone.
  const mainIds = [main.id, encodeURIComponent(main.id)];
  const late = await holdReads(page, r => /\/agent\/(status|queue-state|commands)\b/.test(r.url()) && mainIds.some(id => r.url().includes(id)));
  await page.reload();
  await expect(reply(`main-${n}`)).toHaveCount(1);
  await input.fill(`draft-main-${n}`);
  await expect.poll(() => late.count).toBeGreaterThan(0);
  const sessions = page.getByRole('button', { name: /manage sessions/i }).first();
  await sessions.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('searchbox', { name: /search sessions/i })).toBeFocused();
  await page.keyboard.type(research.id.replace(/^[a-z]+:/, ''));
  await expect(page.getByRole('listbox', { name: /sessions/i }).getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(reply(`research-${n}`)).toHaveCount(1);

  late.release();
  await page.waitForTimeout(2000);
  // Every surface still shows "research" after the late "main" responses.
  await expect(reply(`research-${n}`)).toHaveCount(1);
  await expect(page.getByText(`main-${n}`)).toHaveCount(0);
  await expect(modelButton).toContainText(/fixture-2|fixture model two/i);
  await expect(sessions).toHaveAccessibleName(new RegExp(research.id.replace(/^[a-z]+:/, '')));
  // The composer is shared across sessions in 3.2.5 (its text and attachments follow a switch); it must deliver to "research".
  await input.fill(`[reply:after-${n}] after ${n}`);
  await input.press('Enter');
  await expect(reply(`after-${n}`)).toHaveCount(1);
  const turn = (await runtime.modelLog()).filter(e => e.prompt.includes(`after ${n}`));
  expect(turn.map(e => e.model)).toEqual(['fixture-2']);
});
