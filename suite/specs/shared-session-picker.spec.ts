/** Session picker (shared-ux.feature @ux-shared-014/015; canonical-ux.feature @ux-original-014/015, same bodies). */
import { entries, modelList, sessionList, nameRe, MODEL_ONE, MODEL_TWO, searchField } from '../pickers';
import { test, expect } from '../fixtures';
import { holdReads, holdWrites } from '../net';
import { gateName } from '../runtime';
import { randomUUID } from 'node:crypto';

for (const [id, name] of [
  ['@ux-shared-014', 'Select one coherent session view'],
  ['@ux-original-014', 'Select another session through the picker'],
] as const) test(`${id} ${name}`, async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const mainName = `fm${n.replace(/-/g, '')}`;
  const researchName = `fr${n.replace(/-/g, '')}`;
  const main = await runtime.newSession(mainName);
  const research = await runtime.newSession(researchName);
  const input = page.locator(sel('composeInput'));
  const modelButton = page.getByRole('button', { name: /model picker/i }).first();
  const reply = (text: string) => page.locator(sel('agentPost')).filter({ hasText: text });

  // "research" runs on the second fixture model; "main" stays on the first.
  await page.goto(research.url);
  await input.fill(`[reply:research-${n}] r ${n}`);
  await input.press('Enter');
  await expect(reply(`research-${n}`)).toHaveCount(1);
  await modelButton.click();
  await page.keyboard.type('fixture-2');
  await entries(modelList(page), MODEL_TWO).first().click();
  await expect(modelButton).toContainText(MODEL_TWO);
  await page.goto(main.url);
  await input.fill(`[reply:main-${n}] m ${n}`);
  await input.press('Enter');
  await expect(reply(`main-${n}`)).toHaveCount(1);
  await expect(modelButton).toContainText(MODEL_ONE);

  // With "main" loaded, every later read that names it is delayed (the page itself and its event streams, which are
  // live connections rather than responses, are left alone). A new turn in "main" makes such reads; then leave for
  // "research" by keyboard alone while they are pending.
  const mainIds = [main.id, encodeURIComponent(main.id), mainName];
  const late = await holdReads(page, r => !r.isNavigationRequest() && mainIds.some(id => r.url().includes(id))
    && !/event-stream/.test(r.headers()['accept'] ?? ''));
  await input.fill(`[reply:late-main-${n}] late ${n}`);
  await input.press('Enter');
  await expect.poll(() => late.count).toBeGreaterThan(0);
  const sessions = page.getByRole('button', { name: /manage sessions/i }).first();
  await sessions.focus();
  await page.keyboard.press('Enter');
  await expect(searchField(page, /search sessions/i)).toBeFocused();
  await page.keyboard.type(researchName);
  await expect(entries(sessionList(page), nameRe(researchName))).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(reply(`research-${n}`)).toHaveCount(1);

  late.release();
  await page.waitForTimeout(2000);
  // Every surface still shows "research" after the late "main" responses.
  await expect(reply(`research-${n}`)).toHaveCount(1);
  await expect(page.getByText(`main-${n}`)).toHaveCount(0);
  await expect(page.getByText(`late-main-${n}`)).toHaveCount(0);
  await expect(modelButton).toContainText(MODEL_TWO);
  await expect(sessions).toHaveAccessibleName(nameRe(researchName));
  // The composer is shared across sessions in 3.2.5 (its text and attachments follow a switch); it must deliver to "research".
  await input.fill(`[reply:after-${n}] after ${n}`);
  await input.press('Enter');
  await expect(reply(`after-${n}`)).toHaveCount(1);
  const turn = (await runtime.modelLog()).filter(e => e.prompt.includes(`after ${n}`));
  expect(turn.map(e => e.model)).toEqual(['fixture-2']);
});

for (const [id, name] of [
  ['@ux-shared-015', 'Expose only supported session mutations'],
  ['@ux-original-015', 'Use the session actions actually supplied by the client'],
] as const) test(`${id} ${name}`, async ({ page, runtime, sel }) => {
  const n = randomUUID().slice(0, 8);
  const gate = gateName('busy');
  // Sessions are found by the names given here, not by runtime-specific identifiers.
  const currentName = `fc${n.replace(/-/g, '')}`;
  const key = `fs${n.replace(/-/g, '')}`;
  const current = await runtime.newSession(currentName);
  await runtime.newSession(key);
  const popup = sessionList(page);
  const openPicker = async () => {
    await page.getByRole('button', { name: /manage sessions/i }).first().click();
    await searchField(page, /search sessions/i).fill(key);
    await expect(entries(popup, nameRe(key))).toHaveCount(1);
  };
  const pinName = (verb: string) => new RegExp(`^${verb}\\b.*${nameRe(key).source}`);
  const pinButton = () => page.getByRole('button', { name: pinName('(?:Pin|Unpin)') });
  await page.goto(current.url);

  // Pinning is checked only where the client offers it for this entry.
  await openPicker();
  const canPin = (await pinButton().count()) > 0;
  test.info().annotations.push({ type: 'pin', description: canPin ? 'offered' : 'not offered; pin clauses not applicable' });
  await page.keyboard.press('Escape');
  if (canPin) {
  // A failed pin keeps the picker, the entry and the selection usable.
  // Runtimes pin through a /pin route or a generic session update whose body names the pin action.
  const isPin = (r: any) => /pin/i.test(new URL(r.url()).pathname) || /"action"\s*:\s*"pin"|"pinned"\s*:\s*true/.test(r.postData() ?? "");
  const rejected = await holdWrites(page, isPin, { status: 500, error: `pin-${n}` });
  await openPicker();
  await expect(pinButton()).toHaveAccessibleName(pinName('Pin'));
  await pinButton().click();
  await expect.poll(() => rejected.count).toBe(1);
  rejected.release();
  await page.waitForTimeout(1000);
  await expect(popup).toBeVisible();
  await expect(searchField(page, /search sessions/i)).toHaveValue(key);
  await expect(pinButton()).toHaveAccessibleName(pinName('Pin'));
  rejected.disarm();

  // Pinning is native: it round-trips and survives a reload.
  await pinButton().click();
  await expect(pinButton()).toHaveAccessibleName(pinName('Unpin'));
  await page.reload();
  await openPicker();
  await expect(pinButton()).toHaveAccessibleName(pinName('Unpin'));
  await pinButton().click();
  await expect(pinButton()).toHaveAccessibleName(pinName('Pin'));
  await page.keyboard.press('Escape');
  }

  // A running session cannot be removed: the request is refused and the session, its turn and the picker stay.
  const input = page.locator(sel('composeInput'));
  await input.fill(`[say:busy-${n}][gate:${gate}] busy ${n}`);
  await input.press('Enter');
  await expect.poll(async () => (await runtime.gates())[gate]?.waiting ?? 0).toBe(1);
  page.on('dialog', dialog => void dialog.accept().catch(() => {}));
  await page.getByRole('button', { name: /manage sessions/i }).first().click();
  const remove = page.getByRole('button', { name: /delete current|archive current/i });
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
  await searchField(page, /search sessions/i).fill(currentName);
  await expect(entries(popup, nameRe(currentName))).toHaveCount(1);
});
