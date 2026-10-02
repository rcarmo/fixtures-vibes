/** Session picker coherence (features/canonical/shared-ux.feature @ux-shared-014). */
import { test, expect } from '../fixtures';
import { holdReads, holdWrites } from '../net';
import { gateName } from '../runtime';
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

test('@ux-shared-015 Expose only supported session mutations', async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const gate = gateName('busy');
  const current = await runtime.newSession();
  const other = await runtime.newSession();
  const key = other.id.replace(/^[a-z]+:/, '');
  const popup = page.getByTestId('session-popup');
  const openPicker = async () => {
    await page.getByRole('button', { name: /manage sessions/i }).first().click();
    await page.getByRole('searchbox', { name: /search sessions/i }).fill(key);
    await expect(popup.getByRole('option', { name: new RegExp(key) })).toHaveCount(1);
  };
  const pinButton = () => popup.getByRole('button', { name: new RegExp(`^(Pin|Unpin) @${key}`) });
  await page.goto(current.url);

  // A failed pin keeps the picker, the entry and the selection usable.
  const rejected = await holdWrites(page, r => /pin/i.test(new URL(r.url()).pathname), { status: 500, error: `pin-${n}` });
  await openPicker();
  await expect(pinButton()).toHaveAccessibleName(new RegExp(`^Pin @${key}`));
  await pinButton().click();
  await expect.poll(() => rejected.count).toBe(1);
  rejected.release();
  await page.waitForTimeout(1000);
  await expect(popup).toBeVisible();
  await expect(page.getByRole('searchbox', { name: /search sessions/i })).toHaveValue(key);
  await expect(pinButton()).toHaveAccessibleName(new RegExp(`^Pin @${key}`));
  rejected.disarm();

  // Pinning is native: it round-trips and survives a reload.
  await pinButton().click();
  await expect(pinButton()).toHaveAccessibleName(new RegExp(`^Unpin @${key}`));
  await page.reload();
  await openPicker();
  await expect(pinButton()).toHaveAccessibleName(new RegExp(`^Unpin @${key}`));
  await pinButton().click();
  await expect(pinButton()).toHaveAccessibleName(new RegExp(`^Pin @${key}`));
  await page.keyboard.press('Escape');

  // A running session cannot be removed: the request is refused and the session, its turn and the picker stay.
  const input = page.locator(sel('composeInput'));
  await input.fill(`[say:busy-${n}][gate:${gate}] busy ${n}`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);
  page.on('dialog', dialog => void dialog.accept().catch(() => {}));
  await page.getByRole('button', { name: /manage sessions/i }).first().click();
  const remove = popup.getByRole('button', { name: /delete current|archive current/i });
  if (await remove.count() && await remove.isEnabled()) await remove.click();
  await page.waitForTimeout(1500);
  expect((await runtime.gates())[gate]?.waiting).toBe(1);
  await page.keyboard.press('Escape');
  await page.goto(current.url);
  // After a reload the running turn shows as busy; 3.2.5 may not repaint its Draft until new output arrives.
  await expect(page.getByRole('button', { name: /^stop/i })).toBeVisible();
  await runtime.openGate(gate);
  await expect(page.locator(sel('agentPost')).filter({ hasText: `busy-${n}` })).toHaveCount(1);
  await page.getByRole('button', { name: /manage sessions/i }).first().click();
  await page.getByRole('searchbox', { name: /search sessions/i }).fill(current.id.replace(/^[a-z]+:/, ''));
  await expect(popup.getByText(current.id.replace(/^[a-z]+:/, '')).first()).toBeVisible();
});
